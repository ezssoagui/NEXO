"""Extrai redações com notas oficiais por competência de uma cartilha em PDF para o conjunto de benchmark (6.3).

Uso (o PDF e a saída ficam fora do Git):
  py scripts/essay-benchmark/extract_cartilha.py --pdf referencias/privadas/cartilha_ufes_2026.pdf \
     --source ufes2026 --theme "Perspectivas acerca do envelhecimento na sociedade brasileira" --year 2025 --pages 17-24

Formato esperado por bloco: "Autor: <nome>", "Nota: <total>", linhas "C1 - <nota>" … "C5 - <nota>", depois o texto.
Garantias:
  * o nome do autor NUNCA é gravado (identificador sequencial anônimo);
  * a soma das competências precisa bater com a nota total; caso contrário o bloco é descartado
    (não se inventa nota por competência — 6.3);
  * notas fora de {0,20,...,200} descartam o bloco (nota final = média de dois avaliadores; cartilha 2026, p.9);
  * saída marcada como rights_status=restricted e uso exclusivo de benchmark (nunca RAG).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'data', 'private', 'essay-benchmark')
# Nota final oficial por competência = média de dois avaliadores (cartilha 2026, p.9) -> passos de 20.
VALID = set(range(0, 201, 20))

AUTHOR = re.compile(r'^\s*Autor(?:a)?\s*:', re.I)
TOTAL = re.compile(r'^\s*Nota\s*:\s*(\d{1,4})\s*$', re.I)
COMP = re.compile(r'^\s*C\s*([1-5])\s*[-–—:]\s*(\d{1,3})\s*$', re.I)
NOISE = re.compile(r'^\s*(REDAÇÕES|REDACOES|\d{1,3})\s*$', re.I)


def parse_pages(pages: list[tuple[int, str]]) -> tuple[list[dict], list[dict]]:
    """Recebe [(número_da_página, texto)] e devolve (amostras válidas, descartes com motivo)."""
    blocks: list[dict] = []
    cur: dict | None = None
    for pno, text in pages:
        for raw in text.splitlines():
            line = raw.rstrip()
            if AUTHOR.match(line):
                if cur:
                    blocks.append(cur)
                cur = {'page': pno, 'total': None, 'c': {}, 'lines': []}
                continue
            if cur is None:
                continue
            m = TOTAL.match(line)
            if m and cur['total'] is None and not cur['lines']:
                cur['total'] = int(m.group(1))
                continue
            m = COMP.match(line)
            if m and not cur['lines']:
                cur['c'][int(m.group(1))] = int(m.group(2))
                continue
            if NOISE.match(line) or not line.strip():
                if cur['lines'] and not line.strip():
                    cur['lines'].append('')
                continue
            cur['lines'].append(line.strip())
    if cur:
        blocks.append(cur)

    ok, rejected = [], []
    for b in blocks:
        comps = [b['c'].get(i) for i in range(1, 6)]
        reason = None
        if b['total'] is None:
            reason = 'sem_nota_total'
        elif any(c is None for c in comps):
            reason = 'competencias_incompletas'
        elif any(c not in VALID for c in comps):
            reason = 'nota_fora_da_escala'
        elif sum(comps) != b['total']:
            reason = 'soma_difere_do_total'
        text = reflow(b['lines'])
        if not reason and len(text.split()) < 80:
            reason = 'texto_curto_ou_nao_extraido'
        if reason:
            rejected.append({'page': b['page'], 'reason': reason})
            continue
        ok.append({'page': b['page'], 'c': comps, 'total': b['total'], 'text': text})
    return ok, rejected


def reflow(lines: list[str]) -> str:
    """Junta linhas quebradas pelo PDF em parágrafos (parágrafo novo quando a linha começa recuada/maiúscula após ponto)."""
    paras: list[str] = []
    buf: list[str] = []
    for ln in lines:
        if not ln:
            if buf:
                paras.append(' '.join(buf)); buf = []
            continue
        if buf and re.search(r'[.!?…]["”»)]?$', buf[-1]) and re.match(r'^[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ"“]', ln) and len(buf[-1]) < 70:
            paras.append(' '.join(buf)); buf = []
        buf.append(ln)
    if buf:
        paras.append(' '.join(buf))
    text = '\n\n'.join(p.strip() for p in paras if p.strip())
    return re.sub(r'(\w)- (\w)', r'\1\2', text)  # hifenização de quebra de linha


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--source', required=True, help='código curto da fonte, ex.: ufes2026')
    ap.add_argument('--theme', required=True)
    ap.add_argument('--year', type=int, required=True)
    ap.add_argument('--pages', required=True, help='intervalo, ex.: 17-24')
    args = ap.parse_args()
    from pypdf import PdfReader

    a, b = (int(x) for x in args.pages.split('-'))
    reader = PdfReader(args.pdf)
    pages = [(p, reader.pages[p - 1].extract_text() or '') for p in range(a, b + 1)]
    ok, rejected = parse_pages(pages)
    with open(args.pdf, 'rb') as fh:
        sha = hashlib.sha256(fh.read()).hexdigest()
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f'{args.source}.jsonl')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        for i, s in enumerate(ok, 1):
            f.write(json.dumps({
                'id': f'{args.source}-{i:02d}', 'source': args.source, 'source_sha256': sha, 'source_locator': f"p.{s['page']}",
                'theme': args.theme, 'year': args.year, 'human': {'c': s['c'], 'total': s['total']},
                'text': s['text'], 'rights_status': 'restricted', 'usage': 'benchmark',
            }, ensure_ascii=False) + '\n')
    print(json.dumps({'written': len(ok), 'rejected': rejected, 'out': os.path.relpath(out, ROOT)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
