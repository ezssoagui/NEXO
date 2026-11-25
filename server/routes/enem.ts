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

    listQuestions: (user: AuthUserV1, query: URLSearchParams): RouteResult => {
      const res = enem.listQuestions({
        area: (query.get('area') || undefined) as EnemAreaCode | undefined,
        discipline: query.get('discipline') || undefined,
        skillId: query.get('skillId') || undefined,
        year: query.get('year') ? Number(query.get('year')) : undefined,
        difficultyBand: (query.get('difficultyBand') || undefined) as 'facil' | 'media' | 'dificil' | undefined,
        status: (query.get('status') || undefined) as 'unanswered' | 'wrong' | 'fragile' | undefined,
        includeAnnulled: query.get('includeAnnulled') === 'true',
        userId: user.id,
        limit: query.get('limit') ? Number(query.get('limit')) : 20,
        offset: query.get('offset') ? Number(query.get('offset')) : 0,
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
