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
  hasImages?: boolean;
  status: 'active' | 'annulled' | 'under_review';
  source: 'official_enem' | 'ai_generated_fallback';
}

export interface QuestionFilter {
  area?: EnemAreaCode;
  discipline?: string;
  skillId?: string;
  year?: number;
  language?: 'ingles' | 'espanhol';
  search?: string;
  difficultyBand?: 'facil' | 'media' | 'dificil';
  status?: 'unanswered' | 'wrong' | 'fragile';
  includeAnnulled?: boolean;
  userId?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface EnemCatalogPage {
  items: OfficialEnemQuestionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EnemYearsSummary {
  years: { year: number; count: number }[];
  total: number;
  withSkillCount: number;
  withTriCount: number;
}

const MARKDOWN_IMG_URL_RE = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;

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

  listYears(): EnemYearsSummary {
    const rows = this.db.raw
      .prepare("SELECT year, COUNT(*) AS count FROM enem_questions WHERE status = 'active' GROUP BY year ORDER BY year DESC")
      .all() as { year: number; count: number }[];
    const meta = this.db.raw
      .prepare(
        `SELECT
           SUM(CASE WHEN skill_id IS NOT NULL THEN 1 ELSE 0 END) AS with_skill,
           SUM(CASE WHEN tri_b IS NOT NULL THEN 1 ELSE 0 END) AS with_tri
         FROM enem_questions
         WHERE status = 'active'`,
      )
      .get() as { with_skill: number | null; with_tri: number | null };
    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    return {
      years: rows.map((r) => ({ year: Number(r.year), count: Number(r.count) })),
      total,
      withSkillCount: Number(meta?.with_skill ?? 0),
      withTriCount: Number(meta?.with_tri ?? 0),
    };
  }

  listQuestions(filter: QuestionFilter = {}): EnemCatalogPage {
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
    if (filter.language) {
      where.push('q.language = ?');
      params.push(filter.language);
    }
    if (filter.search && filter.search.trim()) {
      const like = `%${filter.search.trim()}%`;
      where.push('(q.context_md LIKE ? OR q.alternatives_intro LIKE ?)');
      params.push(like, like);
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
    const rawLimit = filter.limit !== undefined && Number.isFinite(filter.limit) ? Math.floor(filter.limit) : 25;
    const pageSize = Math.max(1, Math.min(100, rawLimit));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    let page: number;
    let offset: number;
    if (filter.page !== undefined) {
      const requested = Number.isFinite(filter.page) ? Math.floor(filter.page) : 1;
      page = Math.max(1, Math.min(totalPages, requested));
      offset = (page - 1) * pageSize;
    } else {
      offset = Math.max(0, Number.isFinite(filter.offset) ? Math.floor(filter.offset!) : 0);
      page = Math.min(totalPages, Math.floor(offset / pageSize) + 1);
    }

    const rows = this.db.raw
      .prepare(`SELECT q.* FROM enem_questions q ${whereSql} ORDER BY q.year DESC, q.question_index ASC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset) as any[];

    return { items: rows.map((r) => this.mapQuestion(r)), total, page, pageSize, totalPages };
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
    const alternatives: EnemAlternative[] = JSON.parse(r.alternatives_json || '[]');
    const assets: string[] = JSON.parse(r.assets_json || '[]').filter(
      (u: string) => typeof u === 'string' && !u.includes('broken-image.svg'),
    );
    const contextMd = String(r.context_md ?? '');
    const hasInlineRealImage = [...contextMd.matchAll(MARKDOWN_IMG_URL_RE)].some(
      (m) => m[1] && !m[1].includes('broken-image.svg'),
    );
    const hasImages =
      assets.length > 0 ||
      alternatives.some((a) => Boolean(a.assetUrl && !a.assetUrl.includes('broken-image.svg'))) ||
      hasInlineRealImage;

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
      contextMd,
      alternativesIntro: r.alternatives_intro,
      alternatives,
      correctAlternative: r.correct_alternative,
      assets,
      hasImages,
      status: r.status,
      source: r.source,
    };
  }
}
