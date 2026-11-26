"""Pipeline de importação do acervo oficial do ENEM (15.4) — biblioteca.

Etapas:
  1. download(): baixa fontes oficiais listadas em sources.json (somente domínios *.inep.gov.br),
     grava manifesto com SHA-256, tamanho e data. Idempotente.
  2. extract_items_csv(): lê APENAS ITENS_PROVA_<ano>.csv de dentro do zip de microdados —
     nunca extrai/armazena dados individuais de participantes.
  3. parse_items(): CO_ITEM, CO_PROVA, CO_POSICAO, área, gabarito, NU_PARAM_A/B/C, habilidade,
     anulação (IN_ITEM_ABAN), língua (TP_LINGUA), adaptação.
  4. extract_questions_from_pdf(): extração HEURÍSTICA de enunciado/alternativas por posição.
     Resultado sempre marcado para revisão visual (figuras, fórmulas, tabelas).
  5. build_staging(): junta itens + textos, deduplica por CO_ITEM entre cadernos, calcula
     dificuldade por tercis de NU_PARAM_B por área (ADR-009) e gera o JSON aceito por
     POST /api/admin/import. Nada é publicado: tudo entra como 'staging'.
Nunca inventa enunciados, gabaritos ou parâmetros: itens sem texto extraído ficam fora do
lote e aparecem no relatório.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import statistics
import subprocess
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ALLOWED_HOST_SUFFIX = '.inep.gov.br'
AREA_MAP = {'LC': 'LC', 'CH': 'CH', 'CN': 'CN', 'MT': 'MT'}
LANG_MAP = {'0': 'en', '1': 'es'}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def assert_official(url: str) -> None:
    host = urlparse(url).hostname or ''
    if urlparse(url).scheme != 'https' or not (host == 'inep.gov.br' or host.endswith(ALLOWED_HOST_SUFFIX)):
        raise ValueError(f'URL fora do domínio oficial do Inep: {url}')


def download(sources: list[dict], raw_dir: Path, manifest_path: Path, fetch=None) -> list[dict]:
    """Baixa cada fonte (curl, que usa o repositório de certificados do sistema). Idempotente por SHA-256."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(manifest_path.read_text('utf-8')) if manifest_path.exists() else []
    known = {m['url']: m for m in manifest}
    for src in sources:
        url = src['url']
        assert_official(url)
        target = raw_dir / src['filename']
        if target.exists() and url in known and known[url]['sha256'] == sha256_file(target):
            continue
        if fetch:
            fetch(url, target)
        else:
            subprocess.run(['curl', '-sSLf', '--max-time', '1800', '-A', 'nexo-acervo/1.0', '-o', str(target), url], check=True)
        entry = {**src, 'sha256': sha256_file(target), 'bytes': target.stat().st_size,
                 'downloaded_at': datetime.now(timezone.utc).isoformat(), 'status': 'downloaded_pending_review'}
        known[url] = entry
    out = list(known.values())
    manifest_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), 'utf-8')
    return out


def extract_items_csv(zip_path: Path, year: int) -> str:
    """Retorna o conteúdo de ITENS_PROVA_<ano>.csv sem tocar nos microdados de participantes."""
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if re.search(rf'ITENS_PROVA_{year}\.csv$', n, re.I)]
        if not names:
            raise FileNotFoundError(f'ITENS_PROVA_{year}.csv não encontrado no zip')
        raw = z.read(names[0])
    for enc in ('utf-8', 'latin-1'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError('Codificação desconhecida')


@dataclass
class Item:
    co_item: int
    co_prova: int
    position: int
    area: str
    answer: str | None
    param_a: float | None
    param_b: float | None
    param_c: float | None
    official_skill: int | None
    annulled: bool
    language: str | None
    color: str | None
    adapted: bool


def _num(v: str | None) -> float | None:
    if v is None or v.strip() == '':
        return None
    try:
        return float(v.replace(',', '.'))
    except ValueError:
        return None


def parse_items(text: str) -> list[Item]:
    sample = text[:2048]
    delim = ';' if sample.count(';') > sample.count(',') else ','
    out: list[Item] = []
    for row in csv.DictReader(io.StringIO(text), delimiter=delim):
        area = AREA_MAP.get((row.get('SG_AREA') or '').strip())
        if not area or not row.get('CO_ITEM'):
            continue
        gab = (row.get('TX_GABARITO') or '').strip().upper()
        out.append(Item(
            co_item=int(row['CO_ITEM']), co_prova=int(row['CO_PROVA']), position=int(row['CO_POSICAO']), area=area,
            answer=gab if gab in {'A', 'B', 'C', 'D', 'E'} else None,
            param_a=_num(row.get('NU_PARAM_A')), param_b=_num(row.get('NU_PARAM_B')), param_c=_num(row.get('NU_PARAM_C')),
            official_skill=int(row['CO_HABILIDADE']) if (row.get('CO_HABILIDADE') or '').strip().isdigit() else None,
            annulled=(row.get('IN_ITEM_ABAN') or '0').strip() == '1',
            language=LANG_MAP.get((row.get('TP_LINGUA') or '').strip()) if area == 'LC' else None,
            color=(row.get('TX_COR') or '').strip() or None,
            adapted=(row.get('IN_ITEM_ADAPTADO') or '0').strip() == '1',
        ))
    return out


@dataclass
class Extracted:
    position: int
    statement: str
    alternatives: dict[str, str]
    needs_visual_review: bool = True
    warnings: list[str] = field(default_factory=list)


QUESTION_RE = re.compile(r'QUEST[ÃA]O\s+(\d{1,3})', re.I)
ALT_RE = re.compile(r'(?m)^\s*([A-E])\s*[\)\.\-–]?\s+(?=\S)')


def split_questions(text: str) -> list[Extracted]:
    """Divide o texto de um caderno em questões por marcador 'QUESTÃO N' e alternativas A–E."""
    marks = list(QUESTION_RE.finditer(text))
    out: list[Extracted] = []
    for i, m in enumerate(marks):
        body = text[m.end(): marks[i + 1].start() if i + 1 < len(marks) else len(text)].strip()
        alts = list(ALT_RE.finditer(body))
        last_five = alts[-5:] if len(alts) >= 5 else []
        warnings: list[str] = []
        if [a.group(1) for a in last_five] != list('ABCDE'):
            warnings.append('alternativas não identificadas com segurança')
            out.append(Extracted(int(m.group(1)), body, {}, True, warnings))
            continue
        statement = body[: last_five[0].start()].strip()
        alternatives = {}
        for j, a in enumerate(last_five):
            end = last_five[j + 1].start() if j + 1 < 5 else len(body)
            alternatives[a.group(1)] = re.sub(r'\s+', ' ', body[a.end(): end]).strip()
        if len(statement) < 20:
            warnings.append('enunciado curto: possível figura/tabela')
        out.append(Extracted(int(m.group(1)), statement, alternatives, True, warnings))
    return out


def extract_questions_from_pdf(pdf_path: Path) -> list[Extracted]:
    from pypdf import PdfReader  # dependência opcional (pip install pypdf)

    reader = PdfReader(str(pdf_path))
    text = '\n'.join((p.extract_text() or '') for p in reader.pages)
    return split_questions(text)


def terciles(values: list[float]) -> tuple[float, float] | None:
    xs = sorted(v for v in values if v is not None)
    if len(xs) < 3:
        return None
    q = statistics.quantiles(xs, n=3, method='inclusive')
    return q[0], q[1]


def difficulty(b: float | None, cuts: tuple[float, float] | None) -> tuple[str | None, str | None]:
    if b is None or cuts is None:
        return None, None
    return ('easy' if b <= cuts[0] else 'medium' if b <= cuts[1] else 'hard'), 'official_param_b'


def build_staging(*, year: int, application: str, items: list[Item], texts: dict[int, dict[int, Extracted]],
                  day_by_area: dict[str, int], source_code: str) -> tuple[list[dict], dict]:
    """texts: {co_prova: {posição: Extracted}}. Deduplica por CO_ITEM reunindo cadernos."""
    cuts = {a: terciles([i.param_b for i in items if i.area == a and i.param_b is not None]) for a in AREA_MAP}
    by_item: dict[int, list[Item]] = {}
    for it in items:
        by_item.setdefault(it.co_item, []).append(it)
    staged: list[dict] = []
    report = {'items_in_microdata': len(by_item), 'staged': 0, 'missing_text': [], 'annulled': 0, 'warnings': []}
    for co_item, group in sorted(by_item.items()):
        first = group[0]
        ext = next((texts.get(g.co_prova, {}).get(g.position) for g in group if texts.get(g.co_prova, {}).get(g.position)), None)
        if first.annulled:
            report['annulled'] += 1
        if not ext or len(ext.alternatives) != 5:
            report['missing_text'].append(co_item)
            continue
        diff, diff_src = difficulty(first.param_b, cuts[first.area])
        staged.append({
            'external_key': f'enem:{year}:{application}:{co_item}',
            'co_item': co_item, 'area_code': first.area, 'year': year, 'application': application, 'day': day_by_area[first.area],
            'booklets': [{'co_prova': g.co_prova, 'color': g.color, 'position': g.position} for g in group],
            'language': first.language,
            'statement_md': ext.statement,
            'alternatives': [{'letter': k, 'body_md': ext.alternatives[k]} for k in 'ABCDE'],
            'correct_alternative': first.answer, 'is_annulled': first.annulled,
            'param_a': first.param_a, 'param_b': first.param_b, 'param_c': first.param_c,
            'difficulty': diff, 'difficulty_source': diff_src,
            'skill_code': None, 'official_skill_number': first.official_skill,
            'source_code': source_code, 'rights_status': 'official_public_pending_review',
        })
        if ext.warnings:
            report['warnings'].append({'co_item': co_item, 'warnings': ext.warnings})
    report['staged'] = len(staged)
    return staged, report
