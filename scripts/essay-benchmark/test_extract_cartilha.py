"""Testes do extrator do conjunto de benchmark com texto SINTÉTICO (nenhum dado real)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract_cartilha as ex  # noqa: E402

PARA = 'Parágrafo sintético de teste com argumentação e coesão suficientes para o extrator. ' * 6

PAGE_OK = f"""REDAÇÕES
Autor: Pessoa Fictícia Um
Nota: 960
C1  -  180
C2 - 200
C3 -200
C4 - 200
C5 -  180
    {PARA}
    {PARA}
17
"""

PAGE_BAD_SUM = f"""Autor: Pessoa Fictícia Dois
Nota: 1000
C1 - 200
C2 - 200
C3 - 200
C4 - 200
C5 - 180
{PARA}
"""

PAGE_BAD_SCALE = f"""Autor: Pessoa Fictícia Três
Nota: 970
C1 - 190
C2 - 200
C3 - 200
C4 - 200
C5 - 180
{PARA}
"""


class ExtractTests(unittest.TestCase):
    def test_valid_block_is_anonymised_and_scores_kept(self):
        ok, rejected = ex.parse_pages([(17, PAGE_OK)])
        self.assertEqual(rejected, [])
        self.assertEqual(len(ok), 1)
        self.assertEqual(ok[0]['c'], [180, 200, 200, 200, 180])
        self.assertEqual(ok[0]['total'], 960)
        self.assertNotIn('Fictícia', ok[0]['text'])
        self.assertNotIn('Nota', ok[0]['text'])
        self.assertNotIn('REDAÇÕES', ok[0]['text'])
        self.assertFalse(ok[0]['text'].rstrip().endswith('17'))

    def test_rejects_sum_mismatch_and_off_scale(self):
        ok, rejected = ex.parse_pages([(18, PAGE_BAD_SUM), (19, PAGE_BAD_SCALE)])
        self.assertEqual(ok, [])
        self.assertEqual([r['reason'] for r in rejected], ['soma_difere_do_total', 'nota_fora_da_escala'])

    def test_multiple_blocks_split_by_author_lines(self):
        ok, rejected = ex.parse_pages([(17, PAGE_OK + PAGE_BAD_SUM)])
        self.assertEqual(len(ok), 1)
        self.assertEqual(len(rejected), 1)

    def test_scale_accepts_steps_of_20(self):
        self.assertIn(180, ex.VALID)
        self.assertNotIn(190, ex.VALID)


if __name__ == '__main__':
    unittest.main()
