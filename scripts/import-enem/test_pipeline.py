"""Testes do pipeline (unittest, sem rede). Dados SINTÉTICOS de formato — não são itens oficiais.
Executar: py -m unittest discover -s scripts/import-enem -p "test_*.py"
"""
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import assert_official, build_staging, download, extract_items_csv, parse_items, split_questions, terciles  # noqa: E402

CSV = """CO_POSICAO;SG_AREA;CO_ITEM;NU_PARAM_A;NU_PARAM_B;NU_PARAM_C;TX_COR;CO_PROVA;TX_GABARITO;CO_HABILIDADE;IN_ITEM_ABAN;TX_MOTIVO_ABAN;IN_ITEM_ADAPTADO;NO_ADAPTACAO;TP_LINGUA
136;MT;900001;2,1;-0,5;0,15;AZUL;1001;B;3;0;;0;;
137;MT;900002;1,9;1,2;0,20;AZUL;1001;D;21;0;;0;;
138;MT;900003;2,4;2,8;0,18;AZUL;1001;A;25;0;;0;;
140;MT;900001;2,1;-0,5;0,15;AMARELA;1002;B;3;0;;0;;
139;MT;900004;2,0;0,9;0,17;AZUL;1001;X;10;1;Anulada;0;;
1;LC;900010;1,1;0,1;0,2;AZUL;2001;C;5;0;;0;;0
"""

PDF_TEXT = """Cabeçalho
QUESTÃO 136
Enunciado sintético de teste com informação suficiente para formar um texto.
A 10
B 20
C 30
D 40
E 50
QUESTÃO 137
Outro enunciado sintético de teste com informação suficiente.
A) um
B) dois
C) três
D) quatro
E) cinco
QUESTÃO 138
Figura apenas
"""


class PipelineTests(unittest.TestCase):
    def test_only_official_domains(self):
        assert_official('https://download.inep.gov.br/x.zip')
        with self.assertRaises(ValueError):
            assert_official('https://exemplo.com/x.zip')
        with self.assertRaises(ValueError):
            assert_official('http://download.inep.gov.br/x.zip')

    def test_extracts_only_items_file(self):
        with tempfile.TemporaryDirectory() as d:
            zp = Path(d) / 'm.zip'
            with zipfile.ZipFile(zp, 'w') as z:
                z.writestr('DADOS/ITENS_PROVA_2023.csv', CSV.encode('latin-1'))
                z.writestr('DADOS/MICRODADOS_ENEM_2023.csv', 'NU_INSCRICAO;...\n')
            text = extract_items_csv(zp, 2023)
            self.assertIn('CO_ITEM', text)
            self.assertNotIn('NU_INSCRICAO', text)

    def test_parse_items(self):
        items = parse_items(CSV)
        self.assertEqual(len(items), 6)
        anul = next(i for i in items if i.co_item == 900004)
        self.assertTrue(anul.annulled)
        self.assertIsNone(anul.answer)
        lc = next(i for i in items if i.area == 'LC')
        self.assertEqual(lc.language, 'en')
        self.assertAlmostEqual(items[0].param_b, -0.5)

    def test_split_questions(self):
        qs = {q.position: q for q in split_questions(PDF_TEXT)}
        self.assertEqual(qs[136].alternatives['C'], '30')
        self.assertEqual(qs[137].alternatives['E'], 'cinco')
        self.assertEqual(qs[138].alternatives, {})
        self.assertTrue(all(q.needs_visual_review for q in qs.values()))

    def test_build_staging_dedup_and_difficulty(self):
        items = parse_items(CSV)
        texts = {1001: {q.position: q for q in split_questions(PDF_TEXT)}}
        staged, report = build_staging(year=2023, application='regular', items=items, texts=texts, day_by_area={'LC': 1, 'CH': 1, 'CN': 2, 'MT': 2}, source_code='INEP_PROVAS_ENEM')
        keys = {s['co_item']: s for s in staged}
        self.assertEqual(set(keys), {900001, 900002})
        self.assertEqual(len(keys[900001]['booklets']), 2)  # mesmo item em dois cadernos
        self.assertEqual(keys[900001]['difficulty'], 'easy')
        self.assertEqual(keys[900001]['rights_status'], 'official_public_pending_review')
        self.assertIn(900003, report['missing_text'])  # nunca inventa enunciado
        self.assertEqual(report['annulled'], 1)

    def test_terciles(self):
        self.assertIsNone(terciles([1.0, 2.0]))
        lo, hi = terciles([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])
        self.assertLess(lo, hi)

    def test_download_idempotent_manifest(self):
        calls = []
        def fake_fetch(url, target):
            calls.append(url)
            target.write_bytes(b'conteudo')
        with tempfile.TemporaryDirectory() as d:
            raw, man = Path(d) / 'raw', Path(d) / 'raw' / 'manifest.json'
            src = [{'url': 'https://download.inep.gov.br/a.zip', 'filename': 'a.zip'}]
            download(src, raw, man, fetch=fake_fetch)
            download(src, raw, man, fetch=fake_fetch)
            self.assertEqual(len(calls), 1)
            m = json.loads(man.read_text('utf-8'))
            self.assertEqual(len(m[0]['sha256']), 64)


if __name__ == '__main__':
    unittest.main()
