import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadCurriculum, type CurriculumFile } from './curriculum-loader';
import { loadRelevance } from './relevance-loader';
import type { Tx } from './types';

interface RubricFile {
  source: { code: string; title: string; kind: string; url: string; rights_status: string; notes: string };
  competencies: { number: number; title: string; locator: string; levels: Record<string, string> }[];
  zero_rules: { locator: string; items: string[] };
}

/** Rubrica oficial da redação como documentos RAG (6.1/6.3). Idempotente. */
export async function loadEssayRubric(tx: Tx, file: RubricFile): Promise<number> {
  const [src] = await tx.query<{ id: string }>(
    `insert into content_sources (code, title, kind, url, rights_status, notes) values ($1,$2,$3,$4,$5,$6)
     on conflict (code) do update set title = excluded.title returning id`,
    [file.source.code, file.source.title, file.source.kind, file.source.url, file.source.rights_status, file.source.notes]);
  const exists = await tx.query(`select 1 from rag_documents where source_id = $1 limit 1`, [src!.id]);
  if (exists.length) return 0;
  let n = 0;
  for (const c of file.competencies) {
    for (const [level, body] of Object.entries(c.levels)) {
      await tx.query(
        `insert into rag_documents (kind, usage, competency, level, title, body, source_id, source_locator, rights_status, status)
         values ('rubric','rag',$1,$2,$3,$4,$5,$6,$7,'pending_validation')`,
        [c.number, Number(level), `Competência ${c.number} — ${c.title}`, body, src!.id, c.locator, file.source.rights_status]);
      n++;
    }
  }
  await tx.query(
    `insert into rag_documents (kind, usage, title, body, source_id, source_locator, rights_status, status) values ('zero_rule','rag',$1,$2,$3,$4,$5,'pending_validation')`,
    ['Critérios de nota zero', file.zero_rules.items.map((i) => `- ${i}`).join('\n'), src!.id, file.zero_rules.locator, file.source.rights_status]);
  return n + 1;
}

/**
 * Carrega dados de referência: currículo-base (oficial), rubrica (oficial) e relevância de referência
 * (proposta derivada de fontes privadas autorizadas, sem reproduzir o material; ADR-018).
 * Usado em dev e via POST /api/jobs/load-reference em outros ambientes.
 */
export async function loadReferenceData(tx: Tx, opts: { activateCurriculum: boolean; root?: string }) {
  const root = opts.root ?? process.cwd();
  const curriculum = JSON.parse(readFileSync(path.join(root, 'supabase/seed/curriculum_matriz_v0.json'), 'utf8')) as CurriculumFile;
  const rubric = JSON.parse(readFileSync(path.join(root, 'supabase/seed/essay_rubric_inep_2026.json'), 'utf8')) as RubricFile;
  const relevance: unknown = JSON.parse(readFileSync(path.join(root, 'supabase/seed/relevance_v1.json'), 'utf8'));
  const c = await loadCurriculum(tx, curriculum, { activate: opts.activateCurriculum });
  const r = await loadEssayRubric(tx, rubric);
  const rel = await loadRelevance(tx, relevance);
  if (rel.missing.length) throw new Error(`Relevância referencia subtópicos inexistentes: ${rel.missing.slice(0, 5).join(', ')}`);
  return { ...c, rubricDocs: r, relevance: { version: rel.version, applied: rel.applied, preserved: rel.preserved } };
}
