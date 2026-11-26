"""Gera o currículo-base v0 (rascunho) a partir da Matriz de Referência oficial do ENEM (Inep).

Fonte única: referencias/inep/matriz_referencia_enem.pdf (baixada de download.inep.gov.br, ver
matriz_manifest.json). O script NÃO inventa conteúdos: transcreve competências, habilidades H1–H30
e "Objetos de conhecimento" e os divide mecanicamente em tópicos/subtópicos.

Decisões (ADR-005): status 'draft'; relevância 'unknown' (dados de incidência autorizados ainda não
processados); uma habilidade interna por subtópico como ponto de partida, a refinar pelos sócios.
Uso: py scripts/curriculum/build_matriz_v0.py   (requer: pip install pypdf)
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / 'referencias' / 'inep' / 'matriz_referencia_enem.pdf'
OUT = ROOT / 'supabase' / 'seed' / 'curriculum_matriz_v0.json'


def read_text() -> str:
    from pypdf import PdfReader  # import tardio: dependência opcional

    reader = PdfReader(str(PDF))
    return '\n'.join(page.extract_text() or '' for page in reader.pages)


def clean(s: str) -> str:
    s = s.replace('–', '-').replace('—', '-')
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.replace(' ,', ',').replace(' .', '.').replace('.;', ';').replace(';.', ';')
    return s.strip(' .;:-')


def split_top(text: str, seps: str) -> list[str]:
    """Divide por separadores fora de parênteses."""
    out, depth, cur = [], 0, ''
    for ch in text:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        if ch in seps and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    out.append(cur)
    items = []
    for item in out:
        item = clean(item)
        if len(item) >= 3:
            items.append(item[0].upper() + item[1:])
    return items


def slug(s: str) -> str:
    s = unicodedata.normalize('NFD', s)
    return re.sub(r'[^A-Za-z0-9]+', '', s.encode('ascii', 'ignore').decode())[:6].upper()


def parse_official(text: str) -> dict:
    sections = [
        ('LC', 'Matriz de Referência de Linguagens', 'Matriz de Referência de Matemática'),
        ('MT', 'Matriz de Referência de Matemática', 'Matriz de Referência de Ciências da Natureza'),
        ('CN', 'Matriz de Referência de Ciências da Natureza', 'Matriz de Referência de Ciências Humanas'),
        ('CH', 'Matriz de Referência de Ciências Humanas', 'Objetos de conhecimento'),
    ]
    result = {}
    for area, start, end in sections:
        chunk = text[text.index(start):text.index(end)]
        flat = re.sub(r'\s+', ' ', chunk)
        comps = []
        for m in re.finditer(r'Competência de área (\d+)\s*[-–]\s*(.+?)(?=\s+H\d+\s*[-–]|\s+Competência de área|$)', flat):
            comps.append({'number': int(m.group(1)), 'description': clean(m.group(2)).rstrip('*')})
        skills = []
        comp_positions = [(m.start(), int(m.group(1))) for m in re.finditer(r'Competência de área (\d+)', flat)]
        for m in re.finditer(r'\bH(\d+)\s*[-–]\s*(.+?)(?=\s+H\d+\s*[-–]|\s+Competência de área|\s+ANEXO|$)', flat):
            comp = max((c for c in comp_positions if c[0] < m.start()), default=(0, 1))[1]
            skills.append({'number': int(m.group(1)), 'competency': comp, 'description': clean(m.group(2)).rstrip('*')})
        result[area] = {'competencies': comps, 'skills': skills}
    return result


def bullets(chunk: str) -> list[str]:
    parts = chunk.split('•')[1:]
    return [re.sub(r'\s+', ' ', p).strip() for p in parts]


def head_body(b: str, seps=(' - ', ' – ')) -> tuple[str, str]:
    found = [(b.find(s), s) for s in seps if b.find(s) > 0]
    idx, sep = min(found) if found else (-1, '')
    colon = b.find(':')
    if idx < 0 or (0 < colon < idx):
        return clean(b[:colon]), b[colon + 1:]
    return clean(b[:idx]), b[idx + len(sep):]


def build(text: str) -> dict:
    obj = text[text.index('Objetos de conhecimento associados'):]
    lc = obj[obj.index('1. Linguagem'):obj.index('2. Matemática')]
    mt = obj[obj.index('2. Matemática'):obj.index('3. Ciências da Natureza')]
    fis = obj[obj.index('3.1 Física'):obj.index('3.2 Química')]
    qui = obj[obj.index('3.2 Química'):obj.index('3.3 Biologia')]
    bio = obj[obj.index('3.3 Biologia'):obj.index('4. Ciências Humanas')]
    ch = obj[obj.index('4. Ciências Humanas'):]

    areas = []

    def topic_list(chunk: str, seps: str, subject_prefix: str, split_head=True):
        topics = []
        for i, b in enumerate(bullets(chunk), 1):
            title, body = head_body(b) if split_head else (b, '')
            subs = split_top(body, seps) if body else [title]
            topics.append({'code': f'{subject_prefix}.T{i:02d}', 'name': title, 'subtopics': subs})
        return topics

    # Linguagens: mapeamento direto dos títulos oficiais para disciplinas.
    lc_map = {
        'Estudo do texto': 'LP', 'Estudo das práticas corporais': 'EF', 'Produção e recepção de textos artísticos': 'AR',
        'Estudo do texto literário': 'LIT', 'Estudo dos aspectos linguísticos em diferentes textos': 'LP',
        'Estudo do texto argumentativo, seus gêneros e recursos linguísticos': 'LP',
        'Estudo dos aspectos linguísticos da língua portuguesa': 'LP', 'Estudo dos gêneros digitais': 'LP',
    }
    lc_names = {'LP': 'Língua Portuguesa', 'LIT': 'Literatura', 'AR': 'Artes', 'EF': 'Educação Física', 'LEM': 'Língua Estrangeira Moderna'}
    lc_subjects: dict[str, list] = {k: [] for k in lc_names}
    for b in bullets(lc):
        title, body = head_body(b)
        title_main = title.split(':')[0].strip()
        subject = next((lc_map[k] for k in sorted(lc_map, key=len, reverse=True) if title_main.startswith(k)), 'LP')
        lc_subjects[subject].append({'name': title_main, 'subtopics': split_top(body, ';')})
    # LEM: a matriz não lista objetos; usa-se a Competência de área 2 (H5–H8) como tópico oficial.
    lc_subjects['LEM'].append({'name': 'Leitura e compreensão em língua estrangeira (Competência de área 2)', 'subtopics': [
        'Vocabulário e expressões associados ao tema do texto', 'Uso da língua estrangeira para acesso a informações e culturas',
        'Estruturas linguísticas, função e uso social do texto', 'Produção cultural em língua estrangeira e diversidade']})
    areas.append(('LC', [(code, lc_names[code], topics) for code, topics in lc_subjects.items()]))

    mt_topics = []
    for b in bullets(mt):
        title, body = head_body(b, seps=(':',))
        mt_topics.append({'name': title, 'subtopics': split_top(body, ',;')})
    areas.append(('MT', [('MAT', 'Matemática', mt_topics)]))

    def cn_topics(chunk: str):
        out = []
        for b in bullets(chunk):
            title, body = head_body(b)
            out.append({'name': title, 'subtopics': split_top(body, '.;')})
        return out

    areas.append(('CN', [('FIS', 'Física', cn_topics(fis)), ('QUI', 'Química', cn_topics(qui)), ('BIO', 'Biologia', cn_topics(bio))]))

    # Humanas: a matriz agrupa por eixos temáticos (não por disciplina) — preservado no v0.
    ch_subjects = []
    for b in ch.split('•')[1:]:
        lines = b.split('\n')
        title = clean(lines[0])
        rest = '\n'.join(lines[1:])
        items = [clean(x) for x in re.split(r'\n\s*o\s+', '\n' + rest) if clean(x)]
        topics = []
        for it in items:
            topics.append({'name': it.split('.')[0].split(';')[0][:140], 'subtopics': split_top(it, '.;')})
        ch_subjects.append((slug(title), title, topics))
    areas.append(('CH', ch_subjects))

    out_areas = []
    for area, subjects in areas:
        subj_out = []
        for sidx, (scode, sname, topics) in enumerate(subjects, 1):
            subject_code = f'{area}.{scode}' if area != 'CH' else f'CH.E{sidx:02d}'
            t_out = []
            for tidx, t in enumerate(topics, 1):
                tcode = f'{subject_code}.T{tidx:02d}'
                subs = []
                for kidx, sname2 in enumerate(t['subtopics'], 1):
                    scode2 = f'{tcode}.S{kidx:02d}'
                    subs.append({'code': scode2, 'name': sname2[:200], 'skills': [{'code': f'{scode2}.K1', 'name': sname2[:200]}]})
                t_out.append({'code': tcode, 'name': t['name'][:160], 'subtopics': subs})
            subj_out.append({'code': subject_code, 'name': sname, 'topics': t_out})
        out_areas.append({'code': area, 'subjects': subj_out})
    return {'areas': out_areas}


def main() -> None:
    if not PDF.exists():
        sys.exit('Matriz ausente: execute scripts/referencias/baixar_matriz_inep.py')
    text = read_text()
    data = {
        'version': 'matriz-v0-draft',
        'status': 'draft',
        'generated_by': 'scripts/curriculum/build_matriz_v0.py',
        'source': {
            'code': 'INEP_MATRIZ_ENEM', 'title': 'Matriz de Referência ENEM (Inep)', 'kind': 'official',
            'url': 'https://download.inep.gov.br/download/enem/matriz_referencia.pdf',
            'sha256': hashlib.sha256(PDF.read_bytes()).hexdigest(), 'rights_status': 'official_public_pending_review',
        },
        'notes': 'Rascunho mecânico da matriz oficial. Relevância desconhecida; habilidades internas a refinar e validar pelos sócios (3.10/A.2).',
        'official': parse_official(text),
        **build(text),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    n_sub = sum(len(t['subtopics']) for a in data['areas'] for s in a['subjects'] for t in s['topics'])
    n_sk = sum(len(v['skills']) for v in data['official'].values())
    print(f'OK: {OUT.relative_to(ROOT)} — {n_sub} subtópicos; {n_sk} habilidades oficiais')


if __name__ == '__main__':
    main()
