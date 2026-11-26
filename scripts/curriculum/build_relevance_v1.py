"""Gera supabase/seed/relevance_v1.json (relevância curricular de referência — proposta, ADR-018).

Uso:
  py scripts/curriculum/build_relevance_v1.py                      # usa o cache privado, se existir
  py scripts/curriculum/build_relevance_v1.py --checklist-pdf "referencias/privadas/Checklist+160++2024.pdf"

O cache com o nível de cada item do Checklist fica em data/private/relevance/ (ignorado pelo Git).
Requer pdfplumber apenas para (re)extrair do PDF. Regra (3.4/3.5, experimental):
  C = média arredondada dos níveis dos itens do Checklist mapeados (baixa=1, média=2, alta=3; .5 sobe)
  D = faixa da participação somada no dossiê por disciplina (maior entre disciplinas): >=8% alta, >=3% média, senão baixa
  nível = max(C, D); piso 'medium' para itens de Sociologia/Filosofia do Checklist (nota da p.25);
  sem C nem D -> 'unknown' (ausência não é baixa relevância).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import relevance_v1_data as data  # noqa: E402

LEVELS = ('low', 'medium', 'high')
SCORE = {'low': 1, 'medium': 2, 'high': 3}
CACHE = os.path.join(ROOT, 'data', 'private', 'relevance', 'checklist160_2024_items.json')
OUT = os.path.join(ROOT, 'supabase', 'seed', 'relevance_v1.json')
CURRICULUM = os.path.join(ROOT, 'supabase', 'seed', 'curriculum_matriz_v0.json')
VERSION = 'relevance-v1-proposta'


def load_json(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def norm(s: str) -> str:
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'(\s+X)+\b', ' ', s)  # marcas "X" das colunas do cronograma
    return re.sub(r'\s+', ' ', s).strip().casefold()


# ----------------------------------------------------------------- regra (pura, testada)
def mean_level(levels: list[str]) -> str | None:
    vals = [SCORE[x] for x in levels if x in SCORE]
    if not vals:
        return None
    m = sum(vals) / len(vals)
    return 'high' if m >= 2.5 else 'medium' if m >= 1.5 else 'low'


def band(share_pct: float, bands=data.DOSSIE_BANDS) -> str:
    return 'high' if share_pct >= bands['high'] else 'medium' if share_pct >= bands['medium'] else 'low'


def combine(c: str | None, d: str | None, floor: str | None = None) -> str:
    present = [x for x in (c, d) if x]
    if not present:
        return floor or 'unknown'
    level = max(present, key=lambda x: SCORE[x])
    if floor and SCORE[floor] > SCORE[level]:
        level = floor
    return level


# ----------------------------------------------------------------- Checklist
def extract_checklist(pdf_path: str) -> list[dict]:
    """Extrai (página, seção, rótulo, nível) pela cor do texto/realce (legenda da p.1)."""
    import pdfplumber  # import tardio: só necessário para reextrair

    blue, red, yellow = (0.191895, 0.517578, 0.607422), (1.0, 0.0, 0.0), (1.0, 1.0, 0.0)

    def rgb(c):
        if c is None:
            return None
        c = (c,) if isinstance(c, (int, float)) else tuple(float(x) for x in c)
        return c * 3 if len(c) == 1 else c

    def close(a, b):
        return a is not None and len(a) == 3 and all(abs(x - y) < 0.02 for x, y in zip(a, b))

    rows, area, prev_area, section = [], None, None, None
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            full = (page.extract_text() or '').replace('\n', ' ')
            if re.search(r'CIÊNCIAS\s+DA\s+NATUREZA', full): area = 'CN'
            if re.search(r'MATEMÁTICA e Suas', full): area = 'MT'
            if re.search(r'CIÊNCIAS\s+HUMANAS', full): area = 'CH'
            if re.search(r'LINGUAGENS,\s+CÓDIGOS', full): area = 'LC'
            if pno < 4 or area is None:
                continue
            if prev_area != area:
                section = None
            prev_area = area
            ylw = [r for r in page.rects if close(rgb(r.get('non_stroking_color')), yellow)]
            borders = sorted({round(r['top'], 1) for r in page.rects if r['height'] < 1 and r['x0'] < 120 and r['width'] > 30})
            lines = [l for l in page.extract_text_lines() if l['x0'] < 150 and 'Licensed' not in l['text']]
            cells: dict[float, list] = {}
            for l in lines:
                mid = (l['top'] + l['bottom']) / 2
                above = [b for b in borders if b <= mid]
                cells.setdefault(above[-1] if above else -1, []).append(l)
            for key in sorted(cells):
                ls = cells[key]
                text = re.sub(r'\s+', ' ', ' '.join(l['text'] for l in ls)).strip()
                if not text:
                    continue
                if 'ESTUDO' in text and 'EXERC' in text:
                    section = text.split(' ESTUDO')[0].strip()
                    continue
                chars = [c for l in ls for c in l['chars'] if c['text'].strip() and c['x0'] < 150]
                n = max(1, len(chars))
                fb = sum(close(rgb(c.get('non_stroking_color')), blue) for c in chars) / n
                fr = sum(close(rgb(c.get('non_stroking_color')), red) for c in chars) / n
                x0 = min(l['x0'] for l in ls); x1 = max(l['x1'] for l in ls)
                top = min(l['top'] for l in ls); bottom = max(l['bottom'] for l in ls)
                hl = any(not (r['x1'] < x0 or r['x0'] > x1 or r['bottom'] < top or r['top'] > bottom) for r in ylw)
                level = 'high' if fr > 0.5 else 'low' if fb > 0.5 else 'medium' if hl else 'unmarked'
                label = re.sub(r'(\s+X)+(\s|$)', ' ', text).strip()
                if section is None or (level == 'unmarked' and label.isupper()):
                    continue
                rows.append({'page': pno, 'area': area, 'section': section, 'label': label, 'level': level})
    return rows


def resolve(items: list[dict], page: int, label: str) -> dict:
    cands = [i for i in items if i['page'] == page]
    key = norm(label)
    exact = [i for i in cands if norm(i['label']) == key]
    if len(exact) == 1:
        return exact[0]
    pref = [i for i in cands if norm(i['label']).startswith(key)]
    if len(pref) == 1:
        return pref[0]
    raise ValueError(f'Referência ao Checklist ambígua ou inexistente: p.{page} "{label}" ({len(exact)} exatas, {len(pref)} por prefixo)')


# ----------------------------------------------------------------- dossiê
def dossie_share(refs: list[tuple[str, str]]) -> tuple[dict[str, float], list[dict]]:
    by_disc: dict[str, float] = {}
    detail = []
    for disc, label in refs:
        d = data.D[disc]
        if label not in d['e']:
            raise ValueError(f'Entrada inexistente no dossiê: {disc} / {label}')
        count, page, parent = d['e'][label]
        share = 100.0 * count / d['N']
        by_disc[disc] = by_disc.get(disc, 0.0) + share
        detail.append({'discipline': disc, 'label': label, 'count': count, 'n': d['N'], 'page': page})
    # nunca somar um tema com o seu próprio subtema
    for disc, label in refs:
        parent = data.D[disc]['e'][label][2]
        if parent and (disc, parent) in refs:
            raise ValueError(f'Tema e subtema somados no mesmo subtópico: {disc} / {parent} > {label}')
    return {k: round(v, 2) for k, v in by_disc.items()}, detail


# ----------------------------------------------------------------- build
def curriculum_codes() -> list[tuple[str, str]]:
    cur = load_json(CURRICULUM)
    out = []
    for a in cur['areas']:
        for s in a['subjects']:
            for t in s['topics']:
                for st in t['subtopics']:
                    out.append((st['code'], st['name']))
    return out


def build(items: list[dict], pdf_sha: str | None) -> dict:
    codes = curriculum_codes()
    known = {c for c, _ in codes}
    extra = set(data.M) - known
    missing = known - set(data.M)
    if extra or missing:
        raise ValueError(f'Mapeamento incompleto: ausentes={sorted(missing)[:5]}… extras={sorted(extra)[:5]}…')
    out_items, divergences = [], []
    for code, name in codes:
        m = data.M[code]
        cl_items = [resolve(items, p, lab) for p, lab in m['cl']]
        colored = [i['level'] for i in cl_items if i['level'] in SCORE]
        c = mean_level(colored)
        floor = 'medium' if any(i['page'] == data.SOC_FIL_PAGE for i in cl_items) else None
        shares, dz_detail = dossie_share(m['dz'])
        d = band(max(shares.values())) if shares else None
        level = combine(c, d, floor)
        flags = []
        if c and d and abs(SCORE[c] - SCORE[d]) == 2:
            flags.append('divergencia_checklist_dossie')
            divergences.append({'code': code, 'name': name, 'checklist': c, 'dossie': d})
        if floor and (not c or SCORE[floor] > SCORE[c]):
            flags.append('piso_soc_fil')
        locs = []
        if cl_items:
            pages = sorted({i['page'] for i in cl_items})
            locs.append('Checklist 160+ p.' + ','.join(map(str, pages)))
        if dz_detail:
            pages = sorted({(x['discipline'], x['page']) for x in dz_detail})
            locs.append('Dossiê 2025 ' + '; '.join(f'{dd} p.{pp}' for dd, pp in pages))
        out_items.append({
            'code': code,
            'level': level,
            'checklist': {'level': c, 'refs': [{'page': p, 'label': lab} for p, lab in m['cl']], 'uncolored_refs': len(cl_items) - len(colored)},
            'dossie': {'level': d, 'share_pct_by_discipline': shares, 'refs': dz_detail},
            'primary_source': data.CHECKLIST['code'] if c else (data.DOSSIE['code'] if d else None),
            'locator': f'{VERSION} · ' + ' | '.join(locs) if locs else None,
            'flags': flags,
            'note': m['note'],
        })
    summary = {lv: sum(1 for i in out_items if i['level'] == lv) for lv in ('high', 'medium', 'low', 'unknown')}
    return {
        'version': VERSION,
        'status': 'proposed',
        'generated_by': 'scripts/curriculum/build_relevance_v1.py',
        'curriculum_version': load_json(CURRICULUM)['version'],
        'rule': {
            'checklist': 'média dos níveis dos itens mapeados (baixa=1, média=2, alta=3), arredondada (>=2,5 alta; >=1,5 média)',
            'dossie': f"participação somada por disciplina; >= {data.DOSSIE_BANDS['high']}% alta, >= {data.DOSSIE_BANDS['medium']}% média, senão baixa",
            'combination': 'max(checklist, dossiê); piso média para itens de Sociologia/Filosofia do Checklist (p.25); sem base -> unknown',
            'experimental': True,
        },
        'sources': [
            {'code': data.CHECKLIST['code'], 'title': data.CHECKLIST['title'], 'kind': 'private_reference', 'edition': data.CHECKLIST['edition'],
             'rights_status': 'restricted', 'sha256': pdf_sha,
             'notes': f"Uso: taxonomia/relevância de referência; não reproduzir o material. Legenda: {data.CHECKLIST['legend_locator']}. "
                      f"{data.CHECKLIST['note_soc_fil_locator']}."},
            {'code': data.DOSSIE['code'], 'title': data.DOSSIE['title'], 'kind': 'private_reference', 'edition': data.DOSSIE['edition'],
             'rights_status': 'restricted', 'sha256': None,
             'notes': f"{data.DOSSIE['publisher']}. {data.DOSSIE['scope_locator']}. Proporções não são probabilidade do próximo exame."},
        ],
        'dossie_denominators': {k: {'discipline': v['name'], 'n': v['N'], 'overview_page': v['overview'], 'derivation': v['derivation']} for k, v in data.D.items()},
        'summary': summary,
        'divergences': divergences,
        'items': out_items,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--checklist-pdf')
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    pdf_sha = None
    if args.checklist_pdf:
        with open(args.checklist_pdf, 'rb') as fh:
            pdf_sha = hashlib.sha256(fh.read()).hexdigest()
        items = extract_checklist(args.checklist_pdf)
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE, 'w', encoding='utf-8') as fh:
            json.dump({'sha256': pdf_sha, 'items': items}, fh, ensure_ascii=False, indent=1)
    elif os.path.exists(CACHE):
        cache = load_json(CACHE)
        items, pdf_sha = cache['items'], cache['sha256']
    else:
        print('Cache privado ausente: informe --checklist-pdf (arquivo em referencias/privadas).', file=sys.stderr)
        return 2
    result = build(items, pdf_sha)
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps({'summary': result['summary'], 'divergences': len(result['divergences'])}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
