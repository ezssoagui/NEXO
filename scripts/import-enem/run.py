"""CLI do pipeline de acervo oficial do ENEM. Uso (na raiz do projeto):

  py scripts/import-enem/run.py download --sources scripts/import-enem/sources.json
  py scripts/import-enem/run.py stage --year 2023 --application regular \
      --microdata data/raw/microdados_enem_2023.zip --pdf 1234:data/raw/2023_PV_D1_CD1.pdf [--pdf ...] \
      --out data/staging/enem_2023_regular.json

O arquivo gerado em data/staging/ é enviado em Administração → Importação. Nada é publicado
automaticamente: revisão técnica, pedagógica e de direitos é obrigatória (12.5/13.9).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import build_staging, download, extract_items_csv, extract_questions_from_pdf, parse_items  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('download')
    d.add_argument('--sources', required=True)
    s = sub.add_parser('stage')
    s.add_argument('--year', type=int, required=True)
    s.add_argument('--application', default='regular', choices=['regular', 'ppl', 'reaplicacao', 'digital', 'outra'])
    s.add_argument('--microdata', required=True)
    s.add_argument('--pdf', action='append', default=[], help='CO_PROVA:caminho.pdf (um por caderno)')
    s.add_argument('--source-code', default='INEP_PROVAS_ENEM')
    s.add_argument('--out', required=True)
    a = ap.parse_args()

    if a.cmd == 'download':
        sources = json.loads(Path(a.sources).read_text('utf-8'))['sources']
        out = download(sources, ROOT / 'data' / 'raw', ROOT / 'data' / 'raw' / 'manifest.json')
        print(f'{len(out)} fonte(s) no manifesto data/raw/manifest.json')
        return

    items = parse_items(extract_items_csv(Path(a.microdata), a.year))
    texts = {}
    for spec in a.pdf:
        co_prova, path = spec.split(':', 1)
        texts[int(co_prova)] = {e.position: e for e in extract_questions_from_pdf(Path(path))}
    staged, report = build_staging(year=a.year, application=a.application, items=items, texts=texts,
                                   day_by_area={'LC': 1, 'CH': 1, 'CN': 2, 'MT': 2}, source_code=a.source_code)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest = {'year': a.year, 'application': a.application, 'microdata': Path(a.microdata).name, 'pdfs': a.pdf, 'report': report}
    out.write_text(json.dumps({'manifest': manifest, 'items': staged}, ensure_ascii=False, indent=1), 'utf-8')
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in report.items()}, ensure_ascii=False))


if __name__ == '__main__':
    main()
