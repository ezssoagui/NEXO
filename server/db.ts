import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';
import { createRequire } from 'node:module';
// Carregado via require para funcionar também sob o Vitest/Vite (que reescreve o prefixo node:).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncT };
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * ADR-0001: PERSISTÊNCIA LOCAL-FIRST — SQLite nativo do Node (node:sqlite).
 * Esquema ANSI compatível com PostgreSQL (chaves UUID/TEXT, foreign keys explícitas,
 * índices e transações ACID). Acesso encapsulado pelos repositórios em server/repositories/.
 */
export type DB = ReturnType<typeof openDb>;
export type RawDB = DatabaseSyncT;

export function openDb(path = process.env.NEXO_DB_PATH || 'server/data/nexo.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;

    -- 1. Contas, sessões, recuperação de senha e perfil pedagógico (SEM CPF — LGPD FR-003)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE COLLATE NOCASE,
      nickname TEXT UNIQUE NOT NULL COLLATE NOCASE,
      pass_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      lgpd_consent_at INTEGER NOT NULL DEFAULT 0,
      is_minor INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      target_course TEXT,
      weekly_hours INTEGER NOT NULL DEFAULT 10,
      exam_year INTEGER NOT NULL DEFAULT 2026,
      perceived_difficulties TEXT NOT NULL DEFAULT '[]',
      weekly_goal_questions INTEGER NOT NULL DEFAULT 30,
      onboarding_completed_at INTEGER,
      updated_at INTEGER NOT NULL
    );

    -- 2. Pagadores (separados do perfil pedagógico), Assinaturas e Idempotência Financeira
    CREATE TABLE IF NOT EXISTS payers (
      id TEXT PRIMARY KEY,
      external_customer_id TEXT UNIQUE,
      financial_email TEXT NOT NULL,
      payer_name TEXT NOT NULL,
      is_guardian INTEGER NOT NULL DEFAULT 0,
      document_last4 TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payer_id TEXT NOT NULL REFERENCES payers(id),
      plan_code TEXT NOT NULL CHECK (plan_code IN ('nexo_monthly', 'nexo_annual')),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('credit_card', 'pix')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'grace_period', 'canceled_until_end', 'suspended', 'refunded')),
      current_period_start INTEGER NOT NULL,
      current_period_end INTEGER NOT NULL,
      cdc_deadline_at INTEGER NOT NULL,
      grace_until INTEGER,
      external_subscription_id TEXT UNIQUE,
      last_event_ts INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS payment_events (
      event_id TEXT PRIMARY KEY,
      subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      event_ts INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at INTEGER NOT NULL
    );

    -- 3. Carteira de Cotas de IA (mensal sem acúmulo + avulsos + ledger atômico)
    CREATE TABLE IF NOT EXISTS ai_quota_cycles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cycle_start INTEGER NOT NULL,
      cycle_end INTEGER NOT NULL,
      essay_limit INTEGER NOT NULL,
      essay_used INTEGER NOT NULL DEFAULT 0,
      tutor_limit INTEGER NOT NULL,
      tutor_used INTEGER NOT NULL DEFAULT 0,
      question_gen_limit INTEGER NOT NULL,
      question_gen_used INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_quota_cycles_user ON ai_quota_cycles(user_id, cycle_end DESC);

    CREATE TABLE IF NOT EXISTS ai_addon_balances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('essay', 'tutor', 'question_gen')),
      credits_total INTEGER NOT NULL,
      credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
      payment_event_id TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_addon_user_kind ON ai_addon_balances(user_id, kind, expires_at ASC);

    CREATE TABLE IF NOT EXISTS ai_quota_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('essay', 'tutor', 'question_gen')),
      source TEXT NOT NULL CHECK (source IN ('monthly_cycle', 'addon', 'admin_grant')),
      source_id TEXT,
      delta INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('reserved', 'committed', 'refunded')),
      operation_id TEXT UNIQUE NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quota_ledger_user ON ai_quota_ledger(user_id, created_at DESC);

    -- 4. Banco Oficial ENEM (2009+), H1-H30 e Parâmetros TRI
    CREATE TABLE IF NOT EXISTS enem_skills (
      id TEXT PRIMARY KEY,
      area TEXT NOT NULL CHECK (area IN ('LC', 'CH', 'CN', 'MT')),
      competency_num INTEGER NOT NULL,
      skill_num INTEGER NOT NULL CHECK (skill_num BETWEEN 1 AND 30),
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enem_questions (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL CHECK (year >= 2009),
      question_index INTEGER NOT NULL,
      booklet_color TEXT NOT NULL,
      area TEXT NOT NULL CHECK (area IN ('LC', 'CH', 'CN', 'MT')),
      discipline TEXT NOT NULL,
      language TEXT CHECK (language IN ('ingles', 'espanhol') OR language IS NULL),
      skill_id TEXT REFERENCES enem_skills(id),
      inep_item_code INTEGER,
      tri_a REAL,
      tri_b REAL,
      tri_c REAL,
      context_md TEXT NOT NULL,
      alternatives_intro TEXT NOT NULL,
      alternatives_json TEXT NOT NULL,
      correct_alternative TEXT NOT NULL CHECK (correct_alternative IN ('A', 'B', 'C', 'D', 'E', 'ANULADA')),
      assets_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'annulled', 'under_review')),
      source TEXT NOT NULL DEFAULT 'official_enem' CHECK (source IN ('official_enem', 'ai_generated_fallback'))
    );
    CREATE INDEX IF NOT EXISTS idx_enem_q_filter ON enem_questions(area, discipline, skill_id, year, status);
    CREATE INDEX IF NOT EXISTS idx_enem_q_skill_tri ON enem_questions(skill_id, status, tri_b);
    CREATE INDEX IF NOT EXISTS idx_enem_q_catalog_order ON enem_questions(status, year DESC, question_index ASC);

    -- 5. Aprendizagem, Redações, Flashcards, Simulados, Gamificação Individual e Operação
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      qid TEXT,
      skill_id TEXT,
      correct INTEGER,
      confidence TEXT,
      cause TEXT,
      intervention TEXT,
      payload TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_user_ts ON attempts(user_id, ts);

    CREATE TABLE IF NOT EXISTS state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mastery_cycles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL,
      origin_question_id TEXT NOT NULL,
      situation TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      proof_question_id TEXT,
      proof_source TEXT,
      history_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS essay_themes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      year INTEGER,
      source TEXT NOT NULL DEFAULT 'official_enem',
      motivating_texts_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS essays (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme_id TEXT NOT NULL REFERENCES essay_themes(id),
      draft_text TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS essay_versions (
      id TEXT PRIMARY KEY,
      essay_id TEXT NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      submitted_text TEXT NOT NULL,
      line_count INTEGER NOT NULL CHECK (line_count <= 30),
      total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 1000),
      competencies_json TEXT NOT NULL,
      highlights_json TEXT NOT NULL DEFAULT '[]',
      intervention_json TEXT NOT NULL,
      general_comment TEXT NOT NULL,
      provider_engine TEXT NOT NULL,
      quota_ledger_id TEXT REFERENCES ai_quota_ledger(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      origin TEXT NOT NULL CHECK (origin IN ('curated', 'error_auto', 'manual_private')),
      area TEXT NOT NULL CHECK (area IN ('LC', 'CH', 'CN', 'MT', 'RED')),
      skill_id TEXT,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      source_ref_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_flashcards_owner ON flashcards(owner_user_id, origin);

    CREATE TABLE IF NOT EXISTS flashcard_reviews (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      flashcard_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
      box INTEGER NOT NULL DEFAULT 1,
      ease REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 1,
      due_at INTEGER NOT NULL,
      lapses INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at INTEGER,
      PRIMARY KEY (user_id, flashcard_id)
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      areas_json TEXT NOT NULL,
      question_ids_json TEXT NOT NULL,
      answers_json TEXT NOT NULL DEFAULT '{}',
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      estimated_tri_scores_json TEXT,
      recovery_plan_json TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_streaks (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, event_key)
    );

    CREATE TABLE IF NOT EXISTS ai_operation_logs (
      id TEXT PRIMARY KEY,
      pseudo_user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      primary_provider TEXT NOT NULL,
      final_provider TEXT,
      used_fallback INTEGER NOT NULL DEFAULT 0,
      model TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      quota_action TEXT NOT NULL CHECK (quota_action IN ('committed', 'refunded', 'blocked')),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_reports (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES enem_questions(id) ON DELETE CASCADE,
      reporter_pseudo_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
      resolution_note TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
  `);

  // Migração leve para bancos existentes do protótipo (colunas opcionais em users)
  const cols = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((c) => c.name);
  if (!cols.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  if (!cols.includes('lgpd_consent_at')) db.exec('ALTER TABLE users ADD COLUMN lgpd_consent_at INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('is_minor')) db.exec('ALTER TABLE users ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('deleted_at')) db.exec('ALTER TABLE users ADD COLUMN deleted_at INTEGER');

  return {
    raw: db,
    // Métodos de compatibilidade com módulos legados/testes existentes
    createUser: (u: { id: string; nickname: string; pass_hash: string; salt: string; role: string; email?: string | null; lgpd_consent_at?: number; is_minor?: number }) =>
      db
        .prepare('INSERT INTO users (id, email, nickname, pass_hash, salt, role, lgpd_consent_at, is_minor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(u.id, u.email ?? null, u.nickname, u.pass_hash, u.salt, u.role, u.lgpd_consent_at ?? Date.now(), u.is_minor ?? 0, Date.now()),
    userByNick: (n: string) => db.prepare('SELECT * FROM users WHERE nickname = ?').get(n) as any,
    userByEmail: (e: string) => db.prepare('SELECT * FROM users WHERE email = ?').get(e.trim().toLowerCase()) as any,
    userById: (id: string) => db.prepare('SELECT id, email, nickname, role, is_minor, lgpd_consent_at, created_at FROM users WHERE id = ?').get(id) as any,
    addSession: (hash: string, userId: string, expires: number) => db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expires),
    sessionUser: (hash: string) =>
      db.prepare('SELECT u.id, u.email, u.nickname, u.role, u.is_minor FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?').get(hash, Date.now()) as any,
    dropSession: (hash: string) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash),
    saveState: (userId: string, json: string) =>
      db.prepare('INSERT INTO state VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at').run(userId, json, Date.now()),
    getState: (userId: string) => db.prepare('SELECT json, updated_at FROM state WHERE user_id = ?').get(userId) as any,
    upsertAttempts: (userId: string, list: any[]) => {
      const st = db.prepare(
        'INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET cause = excluded.cause, intervention = excluded.intervention, payload = excluded.payload',
      );
      db.exec('BEGIN');
      try {
        for (const a of list)
          st.run(String(a.id), userId, +a.ts || 0, a.qid ?? null, a.skillId ?? null, a.correct ? 1 : 0, a.confidence ?? null, a.cause ?? null, a.intervention ?? null, JSON.stringify(a));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    attemptsOf: (userId: string) => (db.prepare('SELECT payload FROM attempts WHERE user_id = ? ORDER BY ts').all(userId) as any[]).map((r) => JSON.parse(r.payload)),
    deleteUser: (userId: string) => db.prepare('DELETE FROM users WHERE id = ?').run(userId),
    metrics: () => {
      const one = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as any).n as number;
      const causes = Object.fromEntries(
        (db.prepare('SELECT cause, COUNT(*) n FROM attempts WHERE correct = 0 AND cause IS NOT NULL GROUP BY cause').all() as any[]).map((r) => [r.cause, r.n]),
      );
      return {
        users: one('SELECT COUNT(*) n FROM users'),
        active7d: one('SELECT COUNT(DISTINCT user_id) n FROM attempts WHERE ts > ?', Date.now() - 7 * 86400000),
        attempts: one('SELECT COUNT(*) n FROM attempts'),
        correct: one('SELECT COUNT(*) n FROM attempts WHERE correct = 1'),
        causes,
      };
    },
  };
}
