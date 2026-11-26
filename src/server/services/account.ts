import { z } from 'zod';
import { currentStreak, levelFor, longestStreak } from '@/modules/gamification/levels';
import { curricularIndicators, type MasteryState } from '@/modules/mastery/compute';
import { localDate } from '@/modules/quotas/period';
import { randomToken, sha256 } from '@/server/auth/crypto';
import { asService, asUser } from '@/server/db';
import { one, type Tx, type UserClaims } from '@/server/db/types';
import { AppError, conflict, notFound } from '@/server/http/errors';
import { audit } from './core';

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  enemTargetYear: z.number().int().min(2024).max(2100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  foreignLanguage: z.enum(['en', 'es']).nullable().optional(),
  courseGoal: z.string().max(120).optional(),
  universityGoal: z.string().max(120).optional(),
  currentInstitution: z.string().max(120).optional(),
  acceptedDocumentIds: z.array(z.string().uuid()).max(10),
  guardianEmail: z.string().email().optional(),
});

export function ageOn(birth: string, at = new Date()): number {
  const b = new Date(`${birth}T12:00:00Z`);
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  const m = at.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** Documentos legais vigentes que exigem aceite (13.10). */
export async function requiredDocuments(tx: Tx) {
  return tx.query<{ id: string; kind: string; version: string; title: string }>(
    `select id, kind, version, title from legal_documents where status = 'published' and requires_acceptance order by kind`);
}

/**
 * Cadastro inicial (4.1/13.1/13.2): dados mínimos, idade para proteção de menores.
 * Menor de 18 anos: consentimento do responsável fica pendente (fluxo e base legal a validar
 * juridicamente antes do piloto — não se presume que autodeclaração basta).
 */
export async function completeOnboarding(userId: string, input: z.infer<typeof onboardingSchema>) {
  const age = ageOn(input.birthDate);
  if (age < 10 || age > 100) throw new AppError(422, 'invalid_birth_date', 'Data de nascimento inválida.');
  const minor = age < 18;
  if (minor && !input.guardianEmail) throw new AppError(422, 'guardian_required', 'Para menores de 18 anos, informe o e-mail de um responsável.');
  return asService(async (tx) => {
    const required = await requiredDocuments(tx);
    const missing = required.filter((d) => !input.acceptedDocumentIds.includes(d.id));
    if (missing.length) throw new AppError(422, 'acceptance_required', 'É necessário aceitar os documentos vigentes.', { missing: missing.map((m) => m.kind) });
    await tx.query(
      `insert into profiles (id, display_name, enem_target_year, birth_date, foreign_language, course_goal, university_goal, current_institution, guardian_consent_status, onboarding_completed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       on conflict (id) do update set display_name = excluded.display_name, enem_target_year = excluded.enem_target_year, birth_date = excluded.birth_date,
         foreign_language = excluded.foreign_language, course_goal = excluded.course_goal, university_goal = excluded.university_goal,
         current_institution = excluded.current_institution, onboarding_completed_at = coalesce(profiles.onboarding_completed_at, now())`,
      [userId, input.displayName, input.enemTargetYear, input.birthDate, input.foreignLanguage ?? null, input.courseGoal || null, input.universityGoal || null,
        input.currentInstitution || null, minor ? 'pending' : 'not_required']);
    await tx.query(`insert into preferences (user_id) values ($1) on conflict do nothing`, [userId]);
    await tx.query(`insert into user_roles (user_id, role) values ($1, 'student') on conflict do nothing`, [userId]);
    for (const id of input.acceptedDocumentIds) {
      await tx.query('insert into legal_acceptances (user_id, document_id) values ($1,$2) on conflict do nothing', [userId, id]);
    }
    let guardianToken: string | null = null;
    if (minor && input.guardianEmail) {
      guardianToken = randomToken();
      await tx.query(`insert into guardian_consents (user_id, guardian_email, token_hash, expires_at) values ($1,$2,$3, now() + interval '14 days')`,
        [userId, input.guardianEmail.toLowerCase(), sha256(guardianToken)]);
    }
    return { minor, guardianToken };
  });
}

export async function decideGuardianConsent(token: string, decision: 'granted' | 'revoked') {
  return asService(async (tx) => {
    const g = await one<{ id: string; user_id: string }>(tx,
      `update guardian_consents set status = $2, decided_at = now() where token_hash = $1 and status = 'pending' and expires_at > now() returning id, user_id`, [sha256(token), decision]);
    if (!g) throw new AppError(410, 'invalid_token', 'Link inválido ou expirado.');
    await tx.query('update profiles set guardian_consent_status = $2 where id = $1', [g.user_id, decision]);
    await audit(tx, null, 'guardian', `guardian_consent_${decision}`, 'profile', g.user_id);
    return { ok: true };
  });
}

export async function getProfile(claims: UserClaims) {
  return asUser(claims, async (tx) => {
    const p = await one(tx, `select display_name, enem_target_year, birth_date, foreign_language, course_goal, university_goal, current_institution,
      guardian_consent_status, ranking_opt_in, ranking_display_name, onboarding_completed_at from profiles where id = $1`, [claims.sub]);
    const prefs = await one(tx, 'select theme, question_layout, show_question_timer from preferences where user_id = $1', [claims.sub]);
    return { profile: p ?? null, preferences: prefs ?? { theme: 'system', question_layout: 'vertical', show_question_timer: false } };
  });
}

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  foreignLanguage: z.enum(['en', 'es']).nullable().optional(),
  courseGoal: z.string().max(120).nullable().optional(),
  universityGoal: z.string().max(120).nullable().optional(),
  currentInstitution: z.string().max(120).nullable().optional(),
});

/** Correção de dados pelo titular (13.6), sob RLS e com colunas permitidas. */
export async function updateProfile(claims: UserClaims, input: z.infer<typeof profileUpdateSchema>) {
  await asUser(claims, (tx) => tx.query(
    `update profiles set display_name = coalesce($2, display_name),
       foreign_language = case when $3::boolean then $4 else foreign_language end,
       course_goal = case when $5::boolean then $6 else course_goal end,
       university_goal = case when $7::boolean then $8 else university_goal end,
       current_institution = case when $9::boolean then $10 else current_institution end
     where id = $1`,
    [claims.sub, input.displayName ?? null, input.foreignLanguage !== undefined, input.foreignLanguage ?? null, input.courseGoal !== undefined, input.courseGoal ?? null,
      input.universityGoal !== undefined, input.universityGoal ?? null, input.currentInstitution !== undefined, input.currentInstitution ?? null]));
  return getProfile(claims);
}

export const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  questionLayout: z.enum(['vertical', 'split']).optional(),
  showQuestionTimer: z.boolean().optional(),
});

export async function updatePreferences(claims: UserClaims, input: z.infer<typeof preferencesSchema>) {
  await asUser(claims, (tx) => tx.query(
    `insert into preferences (user_id, theme, question_layout, show_question_timer) values ($1, coalesce($2,'system'), coalesce($3,'vertical'), coalesce($4,false))
     on conflict (user_id) do update set theme = coalesce($2, preferences.theme), question_layout = coalesce($3, preferences.question_layout),
       show_question_timer = coalesce($4, preferences.show_question_timer)`,
    [claims.sub, input.theme ?? null, input.questionLayout ?? null, input.showQuestionTimer ?? null]));
  return getProfile(claims);
}

/** Ranking opt-in (9.6): nome de exibição próprio; menores somente com consentimento do responsável. */
export async function setRanking(userId: string, input: { optIn: boolean; displayName?: string }) {
  return asService(async (tx) => {
    const p = await one<{ birth_date: string; guardian_consent_status: string }>(tx, `select to_char(birth_date, 'YYYY-MM-DD') as birth_date, guardian_consent_status from profiles where id = $1`, [userId]);
    if (!p) throw notFound('Perfil');
    if (input.optIn && ageOn(p.birth_date) < 18 && p.guardian_consent_status !== 'granted') {
      throw new AppError(403, 'guardian_consent_required', 'Para participar do ranking, é necessário o consentimento do responsável.');
    }
    if (input.optIn && (!input.displayName || !/^[A-Za-z0-9_\-. ]{3,24}$/.test(input.displayName))) {
      throw new AppError(422, 'invalid_display_name', 'Use um apelido de 3 a 24 caracteres (letras, números, espaço, ponto, hífen ou sublinhado), sem seu nome completo.');
    }
    await tx.query('update profiles set ranking_opt_in = $2, ranking_display_name = case when $2 then $3 else ranking_display_name end where id = $1', [userId, input.optIn, input.displayName ?? null]);
    await tx.query(`insert into consents (user_id, purpose, granted) values ($1, 'ranking_public_name', $2)`, [userId, input.optIn]);
    return { ok: true };
  });
}

export async function gamificationSummary(tx: Tx, userId: string) {
  const [x] = await tx.query<{ total: number }>('select coalesce(sum(xp), 0)::int as total from xp_events where user_id = $1', [userId]);
  const days = await tx.query<{ day: string }>(`select to_char(day, 'YYYY-MM-DD') as day from study_days where user_id = $1`, [userId]);
  const list = days.map((d) => d.day);
  const achievements = await tx.query(
    `select a.code, a.title, a.description, ua.earned_at from achievements a left join user_achievements ua on ua.achievement_code = a.code and ua.user_id = $1 order by ua.earned_at nulls last, a.code`, [userId]);
  return { xp: x!.total, ...levelFor(x!.total), streak: currentStreak(list, localDate(new Date())), longestStreak: longestStreak(list), achievements };
}

export async function ranking(tx: Tx, period: 'week' | 'month' | 'all', userId: string) {
  const since = period === 'week' ? "date_trunc('week', now())" : period === 'month' ? "date_trunc('month', now())" : "'epoch'::timestamptz";
  const rows = await tx.query<{ position: number; name: string; xp: number; me: boolean }>(
    `select row_number() over (order by sum(x.xp) desc, min(x.created_at))::int as position, p.ranking_display_name as name, sum(x.xp)::int as xp, (p.id = $1) as me
       from xp_events x join profiles p on p.id = x.user_id
      where p.ranking_opt_in and p.ranking_display_name is not null and p.suspended_at is null and x.created_at >= ${since}
      group by p.id, p.ranking_display_name order by xp desc limit 100`, [userId]);
  return rows; // somente apelido e XP: sem notas, escola ou dados pessoais (9.6)
}

// ---------------------------------------------------------------------------
// Desempenho (4.8/8.7–8.10)
// ---------------------------------------------------------------------------
export async function performanceOverview(tx: Tx, userId: string, period: 'recent' | 'all') {
  const since = period === 'recent' ? "now() - interval '30 days'" : "'epoch'::timestamptz";
  const [acc] = await tx.query<{ answered: number; correct: number }>(
    `select count(*)::int as answered, count(*) filter (where is_correct)::int as correct from attempts where user_id = $1 and is_correct is not null and submitted_at >= ${since}`, [userId]);
  const byArea = await tx.query<{ area_code: string; answered: number; correct: number }>(
    `select q.area_code, count(*)::int as answered, count(*) filter (where a.is_correct)::int as correct from attempts a join questions q on q.id = a.question_id
      where a.user_id = $1 and a.is_correct is not null and a.submitted_at >= ${since} group by q.area_code order by q.area_code`, [userId]);
  const byDifficulty = await tx.query(
    `select coalesce(q.difficulty, 'sem classificação') as difficulty, count(*)::int as answered, count(*) filter (where a.is_correct)::int as correct
       from attempts a join questions q on q.id = a.question_id where a.user_id = $1 and a.is_correct is not null and a.submitted_at >= ${since} group by 1 order by 1`, [userId]);
  const errorTypes = await tx.query(
    `select cause, count(*)::int as n from error_classifications where user_id = $1 and created_at >= ${since} group by cause order by n desc`, [userId]);
  const states = await tx.query<{ state: MasteryState | null }>(
    `select ms.state from skills k join subtopics st on st.id = k.subtopic_id join curriculum_versions cv on cv.id = k.curriculum_version_id and cv.status = 'active'
       left join mastery_scores ms on ms.skill_id = k.id and ms.user_id = $1 where k.eligible and k.verification_status <> 'retired'`, [userId]);
  const evolution = await tx.query(
    `select to_char(date_trunc('week', computed_at), 'YYYY-MM-DD') as week, count(*) filter (where state = 'consolidated')::int as consolidated_events, count(*)::int as updates
       from mastery_history where user_id = $1 and computed_at >= ${since} group by 1 order by 1`, [userId]);
  const ind = curricularIndicators(states.map((s) => s.state ?? 'not_assessed'));
  return {
    accuracy: acc!.answered ? Math.round((acc!.correct / acc!.answered) * 1000) / 10 : null,
    answered: acc!.answered, correct: acc!.correct, byArea, byDifficulty, errorTypes, evolution,
    coverage: ind.coverage, curricularMastery: ind.curricularMastery, skills: ind,
  };
}

/** Mapa hierárquico (10.1/8.9): % de habilidades consolidadas (peso visual igual), cobertura e acertos. */
export async function masteryMap(tx: Tx, userId: string) {
  const rows = await tx.query<{ area_code: string; subject_id: string; subject: string; topic_id: string; topic: string; subtopic_id: string; subtopic: string; skills: number; assessed: number; consolidated: number; answered: number; correct: number }>(
    `select s.area_code, s.id as subject_id, s.name as subject, t.id as topic_id, t.name as topic, st.id as subtopic_id, st.name as subtopic,
            count(k.id)::int as skills,
            count(ms.skill_id) filter (where ms.state <> 'not_assessed')::int as assessed,
            count(ms.skill_id) filter (where ms.state = 'consolidated')::int as consolidated,
            coalesce((select count(*)::int from attempts a join questions q on q.id = a.question_id where a.user_id = $1 and q.primary_subtopic_id = st.id and a.is_correct is not null), 0) as answered,
            coalesce((select count(*)::int from attempts a join questions q on q.id = a.question_id where a.user_id = $1 and q.primary_subtopic_id = st.id and a.is_correct), 0) as correct
       from subjects s join topics t on t.subject_id = s.id join subtopics st on st.topic_id = t.id
       join curriculum_versions cv on cv.id = st.curriculum_version_id and cv.status = 'active'
       join skills k on k.subtopic_id = st.id and k.eligible and k.verification_status <> 'retired'
       left join mastery_scores ms on ms.skill_id = k.id and ms.user_id = $1
      where st.verification_status <> 'retired'
      group by s.area_code, s.id, s.name, s.sort, t.id, t.name, t.sort, st.id, st.name, st.sort
      order by s.area_code, s.sort, t.sort, st.sort`, [userId]);
  return rows;
}

export async function subtopicDetail(tx: Tx, userId: string, subtopicId: string) {
  const st = await one(tx, `select st.id, st.name, st.relevance, t.name as topic, s.name as subject, s.area_code from subtopics st join topics t on t.id = st.topic_id
    join subjects s on s.id = t.subject_id where st.id = $1`, [subtopicId]);
  if (!st) throw notFound('Conteúdo');
  const skills = await tx.query(
    `select k.id, k.name, ms.state, ms.r, ms.c, ms.t, ms.m, ms.d, ms.evidence_count, ms.details->>'stateReason' as reason, ms.rule_version
       from skills k left join mastery_scores ms on ms.skill_id = k.id and ms.user_id = $1 where k.subtopic_id = $2 order by k.sort`, [userId, subtopicId]);
  const officialSkills = await tx.query(`select os.area_code, os.number, os.description, l.confidence from skill_official_links l join official_skills os on os.id = l.official_skill_id
    join skills k on k.id = l.skill_id where k.subtopic_id = $1`, [subtopicId]);
  return { ...st, skills, officialSkills };
}

// ---------------------------------------------------------------------------
// Direitos do titular (13.6)
// ---------------------------------------------------------------------------
export async function exportMyData(claims: UserClaims) {
  // Lido sob RLS: somente o que pertence ao titular.
  return asUser(claims, async (tx) => {
    const q = (sql: string) => tx.query(sql, [claims.sub]);
    return {
      generated_at: new Date().toISOString(),
      profile: await q('select * from profiles where id = $1'),
      preferences: await q('select * from preferences where user_id = $1'),
      consents: await q('select purpose, granted, created_at from consents where user_id = $1'),
      legal_acceptances: await q('select document_id, accepted_at from legal_acceptances where user_id = $1'),
      attempts: await q('select question_id, selected_alternative, is_correct, mode, submitted_at from attempts where user_id = $1'),
      mastery: await q('select skill_id, r, c, t, m, d, state, computed_at from mastery_scores where user_id = $1'),
      concept_responses: await q('select activity_id, response_text, score, feedback, created_at from concept_responses where user_id = $1'),
      essays: await q('select id, theme_id, custom_theme_title, status, created_at from essays where user_id = $1'),
      essay_versions: await tx.query('select v.essay_id, v.version, v.kind, v.body, v.submitted_at from essay_versions v join essays e on e.id = v.essay_id where e.user_id = $1', [claims.sub]),
      essay_evaluations: await tx.query('select ev.* from essay_evaluations ev join essay_versions v on v.id = ev.essay_version_id join essays e on e.id = v.essay_id where e.user_id = $1', [claims.sub]),
      discursive: await q('select exercise_id, response_text, evaluation, created_at from discursive_responses where user_id = $1'),
      flashcard_reviews: await q('select flashcard_id, rating, reviewed_at from review_logs where user_id = $1'),
      exams: await q('select exam_id, status, started_at, finished_at, result from exam_attempts where user_id = $1'),
      xp: await q('select activity_type, xp, created_at from xp_events where user_id = $1'),
      subscriptions: await q('select plan_code, cycle, status, current_period_end, created_at from subscriptions where user_id = $1'),
      payments: await q('select amount_cents, status, due_date, paid_at from payments where user_id = $1'),
      feedback: await q('select kind, message, status, created_at from feedback where user_id = $1'),
    };
  });
}

export async function createDataRequest(userId: string, kind: 'access' | 'export' | 'correction' | 'deletion', details?: string) {
  return asService(async (tx) => {
    const [r] = await tx.query<{ id: string }>('insert into data_requests (user_id, kind, details) values ($1,$2,$3) returning id', [userId, kind, details ?? null]);
    return { id: r!.id };
  });
}

/**
 * Exclusão de conta (13.6): remove dados pessoais e pedagógicos (cascata); registros financeiros
 * são retidos sem vínculo pessoal (obrigação legal). Exige assinatura sem renovação ativa.
 */
export async function deleteAccount(userId: string, deleteAuthUser: (id: string) => Promise<void>) {
  const live = await asService((tx) => one(tx, `select 1 from subscriptions where user_id = $1 and status in ('active','past_due') and not cancel_at_period_end`, [userId]));
  if (live) throw conflict('Cancele a renovação da assinatura antes de excluir a conta.', 'active_subscription');
  await asService(async (tx) => {
    const [fin] = await tx.query<{ n: number }>('select count(*)::int as n from payments where user_id = $1', [userId]);
    await tx.query(`insert into account_deletions (user_id_hash, requested_at, retained) values ($1, now(), $2)`,
      [sha256(userId), JSON.stringify({ payments_anonymized: fin!.n, note: 'Pagamentos retidos sem vínculo pessoal por obrigação fiscal/contábil.' })]);
    await audit(tx, null, 'system', 'account_deleted', 'user', sha256(userId));
  });
  await deleteAuthUser(userId);
  // Garantia para ambientes em que a exclusão do Auth não propague em cascata.
  await asService((tx) => tx.query('delete from profiles where id = $1', [userId]));
  return { ok: true };
}

export async function submitFeedback(userId: string, input: { kind: 'question_error' | 'evaluation_issue' | 'technical' | 'suggestion'; entityType?: string; entityId?: string; message: string }) {
  return asService(async (tx) => {
    const [r] = await tx.query<{ id: string }>('insert into feedback (user_id, kind, entity_type, entity_id, message) values ($1,$2,$3,$4,$5) returning id',
      [userId, input.kind, input.entityType ?? null, input.entityId ?? null, input.message]);
    return { id: r!.id };
  });
}
