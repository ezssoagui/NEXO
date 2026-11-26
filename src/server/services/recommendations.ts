import { computePriority, finalStretchBoost, rankRecommendations, type SubtopicSnapshot } from '@/modules/adaptive-engine/priority';
import type { Difficulty, Relevance } from '@/modules/mastery/params';
import type { MasteryState } from '@/modules/mastery/compute';
import { overdueRatio } from '@/modules/reviews/schedule';
import { one, type Tx } from '@/server/db/types';
import { engineParams, setting } from './core';

const QUEUE_SIZE = 30;

/** Fotografia determinística de todos os subtópicos elegíveis para o estudante. */
export async function buildSnapshots(tx: Tx, userId: string, now = new Date()): Promise<(SubtopicSnapshot & { hasContent: boolean })[]> {
  const subs = await tx.query<{ id: string; name: string; area_code: 'LC' | 'MT' | 'CN' | 'CH'; relevance: Relevance }>(
    `select st.id, st.name, s.area_code, st.relevance from subtopics st
       join topics t on t.id = st.topic_id join subjects s on s.id = t.subject_id
       join curriculum_versions cv on cv.id = st.curriculum_version_id and cv.status = 'active'
      where st.verification_status <> 'retired'`);
  const skills = await tx.query<{ id: string; subtopic_id: string; state: MasteryState | null; d: string | null; r: string | null; c: string | null; t: string | null; m: string | null; details: { resolutionByDifficulty?: { easy?: { accuracy: number | null; independentCount: number } } } | null }>(
    `select k.id, k.subtopic_id, ms.state, ms.d, ms.r, ms.c, ms.t, ms.m, ms.details from skills k
       left join mastery_scores ms on ms.skill_id = k.id and ms.user_id = $1
      where k.eligible and k.verification_status <> 'retired'`, [userId]);
  const attempts = await tx.query<{ subtopic_id: string; is_correct: boolean; difficulty: Difficulty | null }>(
    `select subtopic_id, is_correct, difficulty from (
       select q.primary_subtopic_id as subtopic_id, a.is_correct, q.difficulty,
              row_number() over (partition by q.primary_subtopic_id order by a.submitted_at desc) as rn
         from attempts a join questions q on q.id = a.question_id
        where a.user_id = $1 and a.is_correct is not null) x where rn <= 10 order by subtopic_id, rn`, [userId]);
  const reads = await tx.query<{ subtopic_id: string; n: number }>(
    `select l.subtopic_id, count(*)::int as n from lesson_reads lr join lessons l on l.id = lr.lesson_id where lr.user_id = $1 group by l.subtopic_id`, [userId]);
  const reviews = await tx.query<{ subtopic_id: string; due_at: Date; interval_days: string; ladder_index: number }>(
    `select k.subtopic_id, rs.due_at, rs.interval_days, rs.ladder_index from review_schedules rs join skills k on k.id = rs.skill_id where rs.user_id = $1`, [userId]);
  const conns = await tx.query<{ subtopic_id: string; n: number }>(
    `select k.subtopic_id, count(*)::int as n from skill_connections c join skills k on k.id = c.from_skill_id where c.kind = 'prerequisite' group by k.subtopic_id`);
  const content = await tx.query<{ subtopic_id: string }>(
    `select primary_subtopic_id as subtopic_id from questions where publication_status = 'published' and primary_subtopic_id is not null
     union select subtopic_id from lessons where status = 'published'
     union select k.subtopic_id from concept_activities ca join skills k on k.id = ca.skill_id where ca.status = 'published'
     union select d.subtopic_id from decks d where d.status = 'published' and d.subtopic_id is not null`);
  const maxConn = Math.max(1, ...conns.map((c) => c.n));
  const hasContent = new Set(content.map((c) => c.subtopic_id));
  const group = <T extends { subtopic_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.subtopic_id) ?? m.set(r.subtopic_id, []).get(r.subtopic_id)!).push(r);
    return m;
  };
  const skillsBy = group(skills), attemptsBy = group(attempts), reviewsBy = group(reviews);
  const readsBy = new Map(reads.map((r) => [r.subtopic_id, r.n]));
  const connBy = new Map(conns.map((c) => [c.subtopic_id, c.n]));
  const n = (v: string | null) => (v === null ? null : Number(v));

  return subs.map((s) => {
    const rv = (reviewsBy.get(s.id) ?? []).map((r) => overdueRatio({ dueAt: new Date(r.due_at), intervalDays: Number(r.interval_days), ladderIndex: r.ladder_index }, now));
    const due = rv.filter((x) => x >= 0);
    return {
      subtopicId: s.id, name: s.name, areaCode: s.area_code, relevance: s.relevance,
      skills: (skillsBy.get(s.id) ?? []).map((k) => ({
        skillId: k.id, state: k.state ?? 'not_assessed', d: n(k.d), r: n(k.r), c: n(k.c), t: n(k.t), m: n(k.m),
        easyAccuracy: k.details?.resolutionByDifficulty?.easy?.accuracy ?? null,
        easyIndependentCount: k.details?.resolutionByDifficulty?.easy?.independentCount ?? 0,
      })),
      recentAttempts: (attemptsBy.get(s.id) ?? []).map((a) => ({ isCorrect: a.is_correct, difficulty: a.difficulty })),
      lessonReads: readsBy.get(s.id) ?? 0,
      review: { dueSkills: due.length, maxOverdueRatio: due.length ? Math.max(...due) : -1 },
      connections: (connBy.get(s.id) ?? 0) / maxConn,
      hasContent: hasContent.has(s.id),
    };
  });
}

/**
 * Gera a fila única de recomendações (4.3). Determinística, auditável (fatores e versão
 * gravados) e sem IA. Recomendações adiadas respeitam a data; dispensadas só retornam com
 * nova evidência no subtópico. Subtópicos sem acervo publicado não entram na fila.
 */
export async function generateRecommendations(tx: Tx, userId: string, now = new Date()): Promise<number> {
  const { version, params } = await engineParams(tx);
  const prof = await one<{ enem_target_year: number }>(tx, 'select enem_target_year from profiles where id = $1', [userId]);
  const dates = await setting<Record<string, { day1?: string; day2?: string }>>(tx, 'enem_exam_dates', {});
  const d = prof ? dates[String(prof.enem_target_year)] : undefined;
  const day1 = d?.day1 ? new Date(d.day1) : null;
  const day2 = d?.day2 ? new Date(d.day2) : null;
  const ctx = { daysToExam: day1 ? Math.ceil((day1.getTime() - now.getTime()) / 86_400_000) : null, areaBoost: finalStretchBoost(now, day1, day2) };

  const blocked = await tx.query<{ subtopic_id: string }>(
    `select r.subtopic_id from recommendations r where r.user_id = $1 and (
        (r.status = 'postponed' and r.postponed_until > $2)
     or (r.status = 'dismissed' and not exists (
          select 1 from skill_evidence se join skills k on k.id = se.skill_id
           where se.user_id = $1 and k.subtopic_id = r.subtopic_id and se.occurred_at > r.generated_at)))`, [userId, now]);
  const blockedSet = new Set(blocked.map((b) => b.subtopic_id));
  const snaps = (await buildSnapshots(tx, userId, now)).filter((s) => s.hasContent && !blockedSet.has(s.subtopicId));
  const ranked = rankRecommendations(snaps.map((s) => computePriority(s, ctx, params))).slice(0, QUEUE_SIZE);
  await tx.query(`update recommendations set status = 'superseded' where user_id = $1 and status = 'active'`, [userId]);
  for (const r of ranked) {
    await tx.query(
      `insert into recommendations (user_id, subtopic_id, category, focus, priority, factors, reason, rule_version, generated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, r.subtopicId, r.category, r.focus, r.priority, JSON.stringify({ factors: r.factors, weights: r.weights, level: r.level }), r.reason, version, now]);
  }
  return ranked.length;
}

/** Fila atual; regenera se houver evento mais recente que a última geração (sem custo de IA). */
export async function currentRecommendations(tx: Tx, userId: string, category?: 'learn' | 'improve' | 'deepen' | 'review') {
  const stale = await one<{ stale: boolean }>(tx,
    `select coalesce((select max(occurred_at) from learning_events where user_id = $1), 'epoch'::timestamptz) >
            coalesce((select max(generated_at) from recommendations where user_id = $1 and status = 'active'), 'epoch'::timestamptz - interval '1 second')
         or not exists (select 1 from recommendations where user_id = $1 and status = 'active') as stale`, [userId]);
  if (stale?.stale) await generateRecommendations(tx, userId);
  return tx.query<{ id: string; subtopic_id: string; subtopic_name: string; topic_name: string; subject_name: string; area_code: string; category: string; focus: string; priority: string; reason: string; factors: unknown }>(
    `select r.id, r.subtopic_id, st.name as subtopic_name, t.name as topic_name, s.name as subject_name, s.area_code, r.category, r.focus, r.priority, r.reason, r.factors
       from recommendations r join subtopics st on st.id = r.subtopic_id join topics t on t.id = st.topic_id join subjects s on s.id = t.subject_id
      where r.user_id = $1 and r.status = 'active' and ($2::text is null or r.category = $2)
      order by r.priority desc, st.code`, [userId, category ?? null]);
}

export async function updateRecommendationStatus(tx: Tx, userId: string, id: string, action: 'postpone' | 'dismiss', days = 3): Promise<boolean> {
  const rows = await tx.query(
    `update recommendations set status = $3, postponed_until = case when $3 = 'postponed' then now() + make_interval(days => $4) else null end
      where id = $1 and user_id = $2 and status = 'active' returning id`,
    [id, userId, action === 'postpone' ? 'postponed' : 'dismissed', days]);
  return rows.length > 0;
}
