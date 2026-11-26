import { z } from 'zod';
import type { Tx } from './types';

/**
 * Relevância curricular de referência (3.4/3.5; ADR-018) gerada por scripts/curriculum/build_relevance_v1.py.
 * Estática e versionada; prioridade individual continua dinâmica no motor. Status "proposed" até validação dos sócios.
 */
const level = z.enum(['low', 'medium', 'high', 'unknown']);

export const RelevanceFileSchema = z.object({
  version: z.string().regex(/^relevance-v\d+/),
  status: z.enum(['proposed', 'approved']),
  curriculum_version: z.string(),
  sources: z.array(z.object({
    code: z.string(),
    title: z.string(),
    kind: z.literal('private_reference'),
    edition: z.string().nullable(),
    rights_status: z.literal('restricted'),
    sha256: z.string().nullable(),
    notes: z.string(),
  })).min(1),
  summary: z.record(level, z.number().int().nonnegative()),
  items: z.array(z.object({
    code: z.string(),
    level,
    primary_source: z.string().nullable(),
    locator: z.string().max(400).nullable(),
  }).refine((i) => (i.level === 'unknown') === (i.primary_source === null), { message: 'Nível classificado exige fonte; unknown não tem fonte.' })).min(1),
});
export type RelevanceFile = z.infer<typeof RelevanceFileSchema>;

export interface RelevanceLoadResult { applied: number; preserved: number; missing: string[]; version: string }

/**
 * Aplica a relevância de forma idempotente. Nunca sobrescreve uma decisão manual registrada no painel
 * (linha em curriculum_change_log com autor e campo "relevance").
 */
export async function loadRelevance(tx: Tx, input: unknown): Promise<RelevanceLoadResult> {
  const file = RelevanceFileSchema.parse(input);
  const sourceIds = new Map<string, string>();
  for (const s of file.sources) {
    const [row] = await tx.query<{ id: string }>(
      `insert into content_sources (code, title, kind, edition, sha256, rights_status, notes) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (code) do update set title = excluded.title, edition = excluded.edition,
         sha256 = coalesce(excluded.sha256, content_sources.sha256), notes = excluded.notes
       returning id`,
      [s.code, s.title, s.kind, s.edition, s.sha256, s.rights_status, s.notes]);
    sourceIds.set(s.code, row!.id);
  }
  const manual = new Set((await tx.query<{ code: string }>(
    `select distinct st.code from curriculum_change_log l join subtopics st on st.id = l.entity_id
      where l.entity = 'subtopic' and l.created_by is not null and l.details ? 'relevance'`)).map((r) => r.code));

  let applied = 0, preserved = 0;
  const missing: string[] = [];
  for (const it of file.items) {
    if (manual.has(it.code)) { preserved++; continue; }
    const src = it.primary_source ? sourceIds.get(it.primary_source) : null;
    if (it.primary_source && !src) throw new Error(`Fonte desconhecida na relevância: ${it.primary_source}`);
    const rows = await tx.query<{ id: string }>(
      `update subtopics set relevance = $2, relevance_source_id = $3, relevance_locator = $4 where code = $1 returning id`,
      [it.code, it.level, src ?? null, it.locator]);
    if (rows.length) applied++; else missing.push(it.code);
  }
  await tx.query(
    `insert into curriculum_change_log (curriculum_version_id, entity, change, details)
     select cv.id, 'relevance', 'update', $1 from curriculum_versions cv where cv.code = $2`,
    [JSON.stringify({ version: file.version, status: file.status, applied, preserved, missing: missing.length, summary: file.summary }), file.curriculum_version]);
  return { applied, preserved, missing, version: file.version };
}
