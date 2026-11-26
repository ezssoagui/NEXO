import type { Tx } from './types';

/** Estrutura gerada por scripts/curriculum/build_matriz_v0.py (fonte oficial Inep). */
export interface CurriculumFile {
  version: string;
  status: string;
  source: { code: string; title: string; kind: string; url: string; sha256: string; rights_status: string };
  official: Record<string, { competencies: { number: number; description: string }[]; skills: { number: number; competency: number; description: string }[] }>;
  areas: {
    code: string;
    subjects: { code: string; name: string; topics: { code: string; name: string; subtopics: { code: string; name: string; skills: { code: string; name: string }[] }[] }[] }[];
  }[];
}

/**
 * Importa o currículo de forma idempotente (upsert por código). Nunca exclui registros:
 * itens ausentes em nova versão devem ser aposentados explicitamente (3.11).
 */
export async function loadCurriculum(tx: Tx, file: CurriculumFile, opts: { activate: boolean }): Promise<{ subtopics: number; skills: number }> {
  const [src] = await tx.query<{ id: string }>(
    `insert into content_sources (code, title, kind, url, sha256, rights_status)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (code) do update set sha256 = excluded.sha256, url = excluded.url
     returning id`,
    [file.source.code, file.source.title, file.source.kind, file.source.url, file.source.sha256, file.source.rights_status],
  );
  const sourceId = src!.id;
  const [ver] = await tx.query<{ id: string }>(
    `insert into curriculum_versions (code, status, notes) values ($1, 'draft', $2)
     on conflict (code) do update set notes = excluded.notes returning id`,
    [file.version, 'Gerado da Matriz de Referência oficial; pendente de validação pedagógica.'],
  );
  const versionId = ver!.id;

  for (const [area, data] of Object.entries(file.official)) {
    for (const c of data.competencies) {
      await tx.query(
        `insert into official_competencies (area_code, number, description, source_id) values ($1,$2,$3,$4)
         on conflict (area_code, number) do update set description = excluded.description`,
        [area, c.number, c.description, sourceId],
      );
    }
    for (const s of data.skills) {
      await tx.query(
        `insert into official_skills (area_code, number, competency_id, description, source_id)
         select $1, $2, oc.id, $4, $5 from official_competencies oc where oc.area_code = $1 and oc.number = $3
         on conflict (area_code, number) do update set description = excluded.description, competency_id = excluded.competency_id`,
        [area, s.number, s.competency, s.description, sourceId],
      );
    }
  }

  let nSub = 0, nSkill = 0;
  for (const area of file.areas) {
    let sSort = 0;
    for (const subj of area.subjects) {
      const [subject] = await tx.query<{ id: string }>(
        `insert into subjects (area_code, code, name, sort) values ($1,$2,$3,$4)
         on conflict (code) do update set name = excluded.name, sort = excluded.sort returning id`,
        [area.code, subj.code, subj.name, sSort++],
      );
      let tSort = 0;
      for (const t of subj.topics) {
        const [topic] = await tx.query<{ id: string }>(
          `insert into topics (subject_id, curriculum_version_id, code, name, sort, source_id, source_locator, verification_status)
           values ($1,$2,$3,$4,$5,$6,'Objetos de conhecimento','draft')
           on conflict (code) do update set name = excluded.name, sort = excluded.sort returning id`,
          [subject!.id, versionId, t.code, t.name, tSort++, sourceId],
        );
        let stSort = 0;
        for (const st of t.subtopics) {
          const [sub] = await tx.query<{ id: string }>(
            `insert into subtopics (topic_id, curriculum_version_id, code, name, sort, relevance, source_id, source_locator, verification_status)
             values ($1,$2,$3,$4,$5,'unknown',$6,'Objetos de conhecimento','draft')
             on conflict (code) do update set name = excluded.name, sort = excluded.sort returning id`,
            [topic!.id, versionId, st.code, st.name, stSort++, sourceId],
          );
          nSub++;
          let kSort = 0;
          for (const k of st.skills) {
            await tx.query(
              `insert into skills (subtopic_id, curriculum_version_id, code, name, sort, verification_status)
               values ($1,$2,$3,$4,$5,'draft')
               on conflict (code) do update set name = excluded.name`,
              [sub!.id, versionId, k.code, k.name, kSort++],
            );
            nSkill++;
          }
        }
      }
    }
  }
  if (opts.activate) {
    await tx.query(`update curriculum_versions set status = 'retired' where status = 'active' and id <> $1`, [versionId]);
    await tx.query(`update curriculum_versions set status = 'active', activated_at = coalesce(activated_at, now()) where id = $1`, [versionId]);
  }
  await tx.query(
    `insert into curriculum_change_log (curriculum_version_id, entity, change, details) values ($1, 'curriculum_version', 'update', $2)`,
    [versionId, JSON.stringify({ subtopics: nSub, skills: nSkill, source: file.source.code })],
  );
  return { subtopics: nSub, skills: nSkill };
}
