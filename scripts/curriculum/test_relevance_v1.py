"""Testes da relevância v1 (3.4/3.5; ADR-018). Rodam sem as fontes privadas.

Integridade do JSON publicado e da regra; a conferência contra o PDF privado só ocorre se o cache local existir.
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_relevance_v1 as b  # noqa: E402
import relevance_v1_data as data  # noqa: E402

OUT = b.load_json(b.OUT)


class RuleTests(unittest.TestCase):
    def test_mean_level_rounds_half_up_and_ignores_unmarked(self):
        self.assertEqual(b.mean_level(['high', 'medium']), 'high')        # 2,5
        self.assertEqual(b.mean_level(['low', 'medium']), 'medium')       # 1,5
        self.assertEqual(b.mean_level(['low', 'low', 'medium']), 'low')   # 1,33
        self.assertEqual(b.mean_level(['unmarked', 'low']), 'low')
        self.assertIsNone(b.mean_level([]))
        self.assertIsNone(b.mean_level(['unmarked']))

    def test_band_thresholds(self):
        self.assertEqual(b.band(8.0), 'high')
        self.assertEqual(b.band(7.99), 'medium')
        self.assertEqual(b.band(3.0), 'medium')
        self.assertEqual(b.band(2.99), 'low')
        self.assertEqual(b.band(0), 'low')

    def test_combine_is_union_with_floor_and_unknown(self):
        self.assertEqual(b.combine('low', 'high'), 'high')
        self.assertEqual(b.combine('high', 'low'), 'high')   # base importante por conexões não é rebaixada
        self.assertEqual(b.combine(None, 'medium'), 'medium')
        self.assertEqual(b.combine('low', None, floor='medium'), 'medium')
        self.assertEqual(b.combine(None, None), 'unknown')   # ausência não é baixa relevância
        self.assertEqual(b.combine(None, None, floor='medium'), 'medium')

    def test_dossie_share_rejects_parent_and_child_together(self):
        with self.assertRaises(ValueError):
            b.dossie_share([('BIO', 'Ecologia'), ('BIO', 'Impactos Ambientais')])
        with self.assertRaises(ValueError):
            b.dossie_share([('BIO', 'Inexistente')])
        shares, _ = b.dossie_share([('FIS', 'Eletrodinâmica')])
        self.assertAlmostEqual(shares['FIS'], 100 * 37 / 175, places=2)

    def test_resolve_prefers_exact_and_rejects_ambiguous(self):
        items = [{'page': 1, 'label': 'Osmose', 'level': 'medium'}, {'page': 1, 'label': 'Osmose reversa', 'level': 'medium'},
                 {'page': 1, 'label': 'Eletrostática I - Carga', 'level': 'low'}, {'page': 1, 'label': 'Eletrostática II - Trabalho', 'level': 'high'}]
        self.assertEqual(b.resolve(items, 1, 'Osmose')['label'], 'Osmose')
        self.assertEqual(b.resolve(items, 1, 'Eletrostática II -')['level'], 'high')
        with self.assertRaises(ValueError):
            b.resolve(items, 1, 'Eletrostática I')
        with self.assertRaises(ValueError):
            b.resolve(items, 2, 'Osmose')


class PublishedFileTests(unittest.TestCase):
    def test_covers_every_curriculum_subtopic_exactly_once(self):
        codes = [c for c, _ in b.curriculum_codes()]
        self.assertEqual(len(codes), len(set(codes)))
        self.assertEqual(sorted(i['code'] for i in OUT['items']), sorted(codes))
        self.assertEqual(set(data.M), set(codes))

    def test_levels_valid_and_summary_consistent(self):
        allowed = {'low', 'medium', 'high', 'unknown'}
        self.assertTrue(all(i['level'] in allowed for i in OUT['items']))
        for lv in allowed:
            self.assertEqual(OUT['summary'][lv], sum(1 for i in OUT['items'] if i['level'] == lv))

    def test_every_classified_item_has_source_and_locator(self):
        for i in OUT['items']:
            if i['level'] == 'unknown':
                self.assertIsNone(i['primary_source'], i['code'])
                continue
            self.assertIn(i['primary_source'], {s['code'] for s in OUT['sources']}, i['code'])
            self.assertTrue(i['locator'] and i['locator'].startswith(b.VERSION), i['code'])

    def test_level_is_reproducible_from_recorded_components(self):
        for i in OUT['items']:
            floor = 'medium' if 'piso_soc_fil' in i['flags'] or any(r['page'] == data.SOC_FIL_PAGE for r in i['checklist']['refs']) else None
            self.assertEqual(b.combine(i['checklist']['level'], i['dossie']['level'], floor), i['level'], i['code'])
            shares = i['dossie']['share_pct_by_discipline']
            if shares:
                self.assertEqual(b.band(max(shares.values())), i['dossie']['level'], i['code'])

    def test_marked_proposed_and_restricted_and_without_personal_data(self):
        self.assertEqual(OUT['status'], 'proposed')
        self.assertTrue(OUT['rule']['experimental'])
        self.assertTrue(all(s['rights_status'] == 'restricted' and s['kind'] == 'private_reference' for s in OUT['sources']))
        raw = json.dumps(OUT, ensure_ascii=False)
        for forbidden in ('Licensed', '@', 'CPF'):
            self.assertNotIn(forbidden, raw)

    @unittest.skipUnless(os.path.exists(b.CACHE), 'cache privado do Checklist ausente (esperado no CI)')
    def test_matches_private_checklist_cache(self):
        cache = b.load_json(b.CACHE)
        rebuilt = b.build(cache['items'], cache['sha256'])
        self.assertEqual([(i['code'], i['level']) for i in rebuilt['items']], [(i['code'], i['level']) for i in OUT['items']])


if __name__ == '__main__':
    unittest.main()
