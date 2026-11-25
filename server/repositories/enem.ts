import { randomUUID } from 'node:crypto';
import type { DB } from '../db';
import { OFFICIAL_ENEM_SKILLS, type EnemAreaCode } from '../../src/data/enemSkills';

/**
 * Repositório do Acervo Oficial ENEM (2009+, H1–H30 e parâmetros TRI).
 * FR-020 a FR-022 e FR-025 (exclusão automática de anuladas e filtros).
 */
export interface EnemAlternative {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  assetUrl?: string | null;
}

export interface OfficialEnemQuestionRow {
  id: string;
  year: number;
  questionIndex: number;
  bookletColor: string;
  area: EnemAreaCode;
  discipline: string;
  language: 'ingles' | 'espanhol' | null;
  skillId: string | null;
  inepItemCode: number | null;
  triA: number | null;
  triB: number | null;
  triC: number | null;
  contextMd: string;
  alternativesIntro: string;
  alternatives: EnemAlternative[];
  correctAlternative: 'A' | 'B' | 'C' | 'D' | 'E' | 'ANULADA';
  assets: string[];
  status: 'active' | 'annulled' | 'under_review';
  source: 'official_enem' | 'ai_generated_fallback';
}

export interface QuestionFilter {
  area?: EnemAreaCode;
  discipline?: string;
  skillId?: string;
  year?: number;
  difficultyBand?: 'facil' | 'media' | 'dificil';
  status?: 'unanswered' | 'wrong' | 'fragile';
  includeAnnulled?: boolean;
  userId?: string;
  limit?: number;
  offset?: number;
}

export class EnemRepository {
  constructor(private db: DB) {}

  seedOfficialSkills() {
    const st = this.db.raw.prepare(
      `INSERT INTO enem_skills (id, area, competency_num, skill_num, description)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET description = excluded.description, competency_num = excluded.competency_num`,
    );
    this.db.raw.exec('BEGIN');
    try {
      for (const s of OFFICIAL_ENEM_SKILLS) {
        st.run(s.id, s.area, s.competencyNum, s.skillNum, s.description);
      }
      this.db.raw.exec('COMMIT');
    } catch (e) {
      this.db.raw.exec('ROLLBACK');
      throw e;
    }
    return OFFICIAL_ENEM_SKILLS.length;
  }

  listSkills(area?: EnemAreaCode) {
    if (area) {
      return this.db.raw.prepare('SELECT * FROM enem_skills WHERE area = ? ORDER BY skill_num ASC').all(area) as any[];
    }
    return this.db.raw.prepare('SELECT * FROM enem_skills ORDER BY area ASC, skill_num ASC').all() as any[];
  }

  upsertQuestion(q: OfficialEnemQuestionRow) {
    this.db.raw
      .prepare(
        `INSERT INTO enem_questions (
          id, year, question_index, booklet_color, area, discipline, language, skill_id,
          inep_item_code, tri_a, tri_b, tri_c, context_md, alternatives_intro,
          alternatives_json, correct_alternative, assets_json, status, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          booklet_color = excluded.booklet_color,
          skill_id = COALESCE(excluded.skill_id, enem_questions.skill_id),
          inep_item_code = COALESCE(excluded.inep_item_code, enem_questions.inep_item_code),
          tri_a = COALESCE(excluded.tri_a, enem_questions.tri_a),
          tri_b = COALESCE(excluded.tri_b, enem_questions.tri_b),
          tri_c = COALESCE(excluded.tri_c, enem_questions.tri_c),
          context_md = excluded.context_md,
          alternatives_intro = excluded.alternatives_intro,
          alternatives_json = excluded.alternatives_json,
          correct_alternative = excluded.correct_alternative,
          assets_json = excluded.assets_json,
          status = excluded.status`,
      )
      .run(
        q.id,
        q.year,
        q.questionIndex,
        q.bookletColor,
        q.area,
        q.discipline,
        q.language,
        q.skillId,
        q.inepItemCode,
        q.triA,
        q.triB,
        q.triC,
        q.contextMd,
        q.alternativesIntro,
        JSON.stringify(q.alternatives),
        q.correctAlternative,
        JSON.stringify(q.assets),
        q.status,
        q.source,
      );
  }

  getById(id: string): OfficialEnemQuestionRow | null {
    const r = this.db.raw.prepare('SELECT * FROM enem_questions WHERE id = ?').get(id) as any;
    return r ? this.mapQuestion(r) : null;
  }

  listQuestions(filter: QuestionFilter = {}): { items: OfficialEnemQuestionRow[]; total: number } {
    const where: string[] = [];
    const params: any[] = [];

    if (!filter.includeAnnulled) {
      where.push("q.status = 'active'");
    }
    if (filter.area) {
      where.push('q.area = ?');
      params.push(filter.area);
    }
    if (filter.discipline) {
      where.push('q.discipline = ?');
      params.push(filter.discipline);
    }
    if (filter.skillId) {
      where.push('q.skill_id = ?');
      params.push(filter.skillId);
    }
    if (filter.year) {
      where.push('q.year = ?');
      params.push(filter.year);
    }
    if (filter.difficultyBand === 'facil') {
      where.push('q.tri_b IS NOT NULL AND q.tri_b < -0.5');
    } else if (filter.difficultyBand === 'media') {
      where.push('q.tri_b IS NOT NULL AND q.tri_b >= -0.5 AND q.tri_b <= 1.0');
    } else if (filter.difficultyBand === 'dificil') {
      where.push('q.tri_b IS NOT NULL AND q.tri_b > 1.0');
    }

    if (filter.userId && filter.status === 'unanswered') {
      where.push('NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.qid = q.id)');
      params.push(filter.userId);
    } else if (filter.userId && filter.status === 'wrong') {
      where.push('EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.qid = q.id AND a.correct = 0)');
      params.push(filter.userId);
    } else if (filter.userId && filter.status === 'fragile') {
      where.push("EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.qid = q.id AND a.correct = 1 AND a.confidence IN ('duvida', 'chute'))");
      params.push(filter.userId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (this.db.raw.prepare(`SELECT COUNT(*) AS n FROM enem_questions q ${whereSql}`).get(...params) as any).n as number;
    const limit = Math.max(1, Math.min(100, filter.limit ?? 20));
    const offset = Math.max(0, filter.offset ?? 0);

    const rows = this.db.raw
      .prepare(`SELECT q.* FROM enem_questions q ${whereSql} ORDER BY q.year DESC, q.question_index ASC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as any[];

    return { items: rows.map((r) => this.mapQuestion(r)), total };
  }

  /**
   * Busca candidatas oficiais ativas e inéditas para o aluno na mesma habilidade H1–H30 (FR-025).
   */
  listOfficialProofCandidates(skillId: string, userId: string, excludeIds: string[] = []): OfficialEnemQuestionRow[] {
    const excludePlaceholders = excludeIds.length ? `AND q.id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';
    const rows = this.db.raw
      .prepare(
        `SELECT q.* FROM enem_questions q
         WHERE q.skill_id = ?
           AND q.status = 'active'
           AND q.source = 'official_enem'
           AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = ? AND a.qid = q.id)
           ${excludePlaceholders}
         ORDER BY q.year DESC, q.question_index ASC`,
      )
      .all(skillId, userId, ...excludeIds) as any[];
    return rows.map((r) => this.mapQuestion(r));
  }

  createReport(questionId: string, reporterPseudoId: string, reason: string) {
    const id = randomUUID();
    this.db.raw
      .prepare("INSERT INTO question_reports (id, question_id, reporter_pseudo_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)")
      .run(id, questionId, reporterPseudoId, reason.trim().slice(0, 500), Date.now());
    return id;
  }

  private mapQuestion(r: any): OfficialEnemQuestionRow {
    return {
      id: r.id,
      year: r.year,
      questionIndex: r.question_index,
      bookletColor: r.booklet_color,
      area: r.area,
      discipline: r.discipline,
      language: r.language ?? null,
      skillId: r.skill_id ?? null,
      inepItemCode: r.inep_item_code ?? null,
      triA: r.tri_a ?? null,
      triB: r.tri_b ?? null,
      triC: r.tri_c ?? null,
      contextMd: r.context_md,
      alternativesIntro: r.alternatives_intro,
      alternatives: JSON.parse(r.alternatives_json || '[]'),
      correctAlternative: r.correct_alternative,
      assets: JSON.parse(r.assets_json || '[]'),
      status: r.status,
      source: r.source,
    };
  }
}
