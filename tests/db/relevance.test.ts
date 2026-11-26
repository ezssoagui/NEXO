import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAuthUser, freshDb } from './helpers';
import { loadReferenceData } from '@/server/db/reference-loader';
import { loadRelevance, RelevanceFileSchema } from '@/server/db/relevance-loader';

const file = JSON.parse(readFileSync(path.join(process.cwd(), 'supabase/seed/relevance_v1.json'), 'utf8')) as {
  summary: Record<string, number>; items: { code: string; level: string; locator: string | null }[];
};

describe('relevância de referência v1 (3.4, ADR-018)', () => {
  it('aplica a todos os subtópicos com fonte e localizador; unknown fica sem fonte', async () => {
    const db = await freshDb();
    const res = await db.transaction((tx) => loadReferenceData(tx, { activateCurriculum: true }));
    expect(res.relevance.applied).toBe(file.items.length);
    const counts = await db.query<{ relevance: string; n: number }>(`select relevance, count(*)::int as n from subtopics group by 1`);
    for (const [lv, n] of Object.entries(file.summary)) expect(counts.find((c) => c.relevance === lv)?.n ?? 0).toBe(n);
    const orphans = await db.query(`select code from subtopics where relevance <> 'unknown' and (relevance_source_id is null or relevance_locator is null)`);
    expect(orphans).toEqual([]);
    const unknownWithSource = await db.query(`select code from subtopics where relevance = 'unknown' and relevance_source_id is not null`);
    expect(unknownWithSource).toEqual([]);
    const sources = await db.query<{ code: string; kind: string; rights_status: string }>(
      `select code, kind, rights_status from content_sources where code like 'ref.%' order by code`);
    expect(sources).toEqual([
      { code: 'ref.checklist160.2024', kind: 'private_reference', rights_status: 'restricted' },
      { code: 'ref.dossie.enem2025', kind: 'private_reference', rights_status: 'restricted' },
    ]);
    await db.close();
  });

  it('é idempotente e preserva decisão manual registrada no painel', async () => {
    const db = await freshDb();
    await db.transaction((tx) => loadReferenceData(tx, { activateCurriculum: true }));
    const admin = await createAuthUser(db, 'admin-rel@nexo.test');
    const target = file.items.find((i) => i.level === 'high')!;
    const [st] = await db.query<{ id: string }>(`select id from subtopics where code = $1`, [target.code]);
    await db.query(`update subtopics set relevance = 'low', relevance_locator = 'decisão dos sócios' where id = $1`, [st!.id]);
    await db.query(`insert into curriculum_change_log (curriculum_version_id, entity, entity_id, change, details, created_by)
      select curriculum_version_id, 'subtopic', id, 'update', $2, $3 from subtopics where id = $1`,
      [st!.id, JSON.stringify({ relevance: 'low' }), admin]);
    const again = await db.transaction((tx) => loadRelevance(tx, file));
    expect(again.preserved).toBe(1);
    expect(again.applied).toBe(file.items.length - 1);
    const [row] = await db.query<{ relevance: string; relevance_locator: string }>(`select relevance, relevance_locator from subtopics where id = $1`, [st!.id]);
    expect(row).toEqual({ relevance: 'low', relevance_locator: 'decisão dos sócios' });
    await db.close();
  });

  it('rejeita arquivo com nível classificado sem fonte ou fonte não restrita', () => {
    const bad1 = { ...file, items: [{ code: 'X', level: 'high', primary_source: null, locator: null }] };
    expect(RelevanceFileSchema.safeParse(bad1).success).toBe(false);
    const bad2 = { ...file, items: [{ code: 'X', level: 'unknown', primary_source: 'ref.checklist160.2024', locator: null }] };
    expect(RelevanceFileSchema.safeParse(bad2).success).toBe(false);
    const parsed = RelevanceFileSchema.safeParse(file);
    expect(parsed.success).toBe(true);
    const bad3 = JSON.parse(JSON.stringify(file)) as { sources: { rights_status: string }[] };
    bad3.sources[0]!.rights_status = 'authorized';
    expect(RelevanceFileSchema.safeParse(bad3).success).toBe(false);
  });
});
