import type { DB } from '../db';
import { EnemRepository } from '../repositories/enem';
import { selectProofQuestion } from '../../src/engine/proofSelector';
import { pseudonymize } from '../privacy';
import type { EnemAreaCode } from '../../src/data/enemSkills';
import type { AuthUserV1 } from '../repositories/users';
import type { RouteResult } from './auth';

export function createEnemRoutes(db: DB) {
  const enem = new EnemRepository(db);
  enem.seedOfficialSkills();

  return {
    listSkills: (query: URLSearchParams): RouteResult => {
      const area = (query.get('area') || undefined) as EnemAreaCode | undefined;
      return { status: 200, body: { skills: enem.listSkills(area) } };
    },

    listYears: (): RouteResult => {
      return { status: 200, body: enem.listYears() };
    },

    listQuestions: (user: AuthUserV1, query: URLSearchParams): RouteResult => {
      const pageParam = query.get('page');
      const offsetParam = query.get('offset');
      const limitParam = query.get('limit');
      const res = enem.listQuestions({
        area: (query.get('area') || undefined) as EnemAreaCode | undefined,
        discipline: query.get('discipline') || undefined,
        skillId: query.get('skillId') || undefined,
        year: query.get('year') ? Number(query.get('year')) : undefined,
        language: (query.get('language') || undefined) as 'ingles' | 'espanhol' | undefined,
        search: query.get('search') || undefined,
        difficultyBand: (query.get('difficultyBand') || undefined) as 'facil' | 'media' | 'dificil' | undefined,
        status: (query.get('status') || undefined) as 'unanswered' | 'wrong' | 'fragile' | undefined,
        includeAnnulled: query.get('includeAnnulled') === 'true',
        userId: user.id,
        page: pageParam !== null ? Number(pageParam) : undefined,
        limit: limitParam !== null ? Number(limitParam) : 25,
        offset: offsetParam !== null ? Number(offsetParam) : undefined,
      });
      return { status: 200, body: res };
    },

    getQuestion: (id: string): RouteResult => {
      const q = enem.getById(id);
      if (!q) return { status: 404, body: { error: 'not_found', message: 'Questão não encontrada.' } };
      return { status: 200, body: { question: q } };
    },

    reportQuestion: (user: AuthUserV1, id: string, body: any): RouteResult => {
      const q = enem.getById(id);
      if (!q) return { status: 404, body: { error: 'not_found', message: 'Questão não encontrada.' } };
      const reason = String(body?.reason ?? '').trim();
      if (reason.length < 5) return { status: 400, body: { error: 'bad_request', message: 'Descreva o problema encontrado (mínimo 5 caracteres).' } };
      const reportId = enem.createReport(id, pseudonymize(user.id), reason);
      return { status: 201, body: { reportId, status: 'open' } };
    },

    proofQuestion: (user: AuthUserV1, body: any): RouteResult => {
      const skillId = String(body?.skillId ?? '').trim();
      if (!skillId) return { status: 400, body: { error: 'bad_request', message: 'skillId obrigatório.' } };
      const excludeIds = Array.isArray(body?.excludeIds) ? body.excludeIds.map(String) : [];
      const targetTriB = body?.targetTriB !== undefined && body?.targetTriB !== null ? Number(body.targetTriB) : null;

      const candidates = enem.listOfficialProofCandidates(skillId, user.id, excludeIds);
      const selected = selectProofQuestion(candidates, targetTriB);
      return { status: 200, body: selected };
    },
  };
}
