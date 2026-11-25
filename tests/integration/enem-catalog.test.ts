import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../../server/db';
import { EnemRepository, type OfficialEnemQuestionRow } from '../../server/repositories/enem';
import { createEnemRoutes } from '../../server/routes/enem';
import { UsersRepository } from '../../server/repositories/users';

function makeQuestion(overrides: Partial<OfficialEnemQuestionRow> & { id: string; year: number; questionIndex: number }): OfficialEnemQuestionRow {
  return {
    bookletColor: 'AZUL',
    area: 'MT',
    discipline: 'matematica',
    language: null,
    skillId: 'MT-H01',
    inepItemCode: null,
    triA: 1.0,
    triB: 0.2,
    triC: 0.2,
    contextMd: `Enunciado da questão ${overrides.questionIndex} (${overrides.year}).`,
    alternativesIntro: 'Assinale a correta:',
    alternatives: [
      { letter: 'A', text: 'Alternativa A', assetUrl: null },
      { letter: 'B', text: 'Alternativa B', assetUrl: null },
    ],
    correctAlternative: 'A',
    assets: [],
    status: 'active',
    source: 'official_enem',
    ...overrides,
  };
}

describe('US1/US3: Catálogo paginado de 25 questões/página, anos dinâmicos e sinalização de imagens', () => {
  let db: DB;
  let repo: EnemRepository;
  let routes: ReturnType<typeof createEnemRoutes>;
  let user: any;

  beforeEach(() => {
    db = openDb(':memory:');
    repo = new EnemRepository(db);
    repo.seedOfficialSkills();
    routes = createEnemRoutes(db);
    const users = new UsersRepository(db);
    const reg = users.register({
      email: 'catalogo@nexo.edu.br',
      password: 'Password123',
      nickname: 'CatalogoUser',
      isMinor: false,
      lgpdConsent: true,
    });
    if (!reg.ok) throw new Error(reg.message);
    user = reg.user;

    // 63 questões ativas distribuídas em 3 anos (2023: 25, 2022: 20, 2021: 18) + 2 anuladas
    const years: [number, number][] = [
      [2023, 25],
      [2022, 20],
      [2021, 18],
    ];
    for (const [year, count] of years) {
      for (let i = 1; i <= count; i++) {
        const area = i % 2 === 0 ? 'CN' : 'MT';
        const hasInlineImg = year === 2023 && i === 1;
        const hasAssetImg = year === 2023 && i === 2;
        const hasAltImg = year === 2023 && i === 3;
        repo.upsertQuestion(
          makeQuestion({
            id: `enem-${year}-${area}-${String(i).padStart(3, '0')}`,
            year,
            questionIndex: i,
            area,
            skillId: `${area}-H01`,
            contextMd: hasInlineImg
              ? 'Observe o gráfico:\n\n![Gráfico](/api/assets/1111111111111111111111111111111111111111111111111111111111111111.png)'
              : `Texto da questão ${i} de ${year}`,
            assets: hasAssetImg
              ? ['/api/assets/2222222222222222222222222222222222222222222222222222222222222222.png']
              : [],
            alternatives: [
              {
                letter: 'A',
                text: 'Alt A',
                assetUrl: hasAltImg
                  ? '/api/assets/3333333333333333333333333333333333333333333333333333333333333333.png'
                  : null,
              },
              { letter: 'B', text: 'Alt B', assetUrl: null },
            ],
          }),
        );
      }
    }
    repo.upsertQuestion(
      makeQuestion({ id: 'enem-2023-MT-901', year: 2023, questionIndex: 901, status: 'annulled', correctAlternative: 'ANULADA' }),
    );
    repo.upsertQuestion(
      makeQuestion({ id: 'enem-2021-MT-902', year: 2021, questionIndex: 902, status: 'annulled', correctAlternative: 'ANULADA' }),
    );
  });

  it('lista anos disponíveis em ordem decrescente excluindo questões anuladas', () => {
    const res = routes.listYears();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      years: [
        { year: 2023, count: 25 },
        { year: 2022, count: 20 },
        { year: 2021, count: 18 },
      ],
      total: 63,
      withSkillCount: 63,
      withTriCount: 63,
    });
  });

  it('pagina estritamente em 25 questões por página e normaliza páginas fora do intervalo', () => {
    const p1 = routes.listQuestions(user, new URLSearchParams('page=1')).body as any;
    expect(p1.page).toBe(1);
    expect(p1.pageSize).toBe(25);
    expect(p1.total).toBe(63);
    expect(p1.totalPages).toBe(3);
    expect(p1.items).toHaveLength(25);
    expect(p1.items[0].year).toBe(2023);
    expect(p1.items[0].questionIndex).toBe(1);

    const p2 = routes.listQuestions(user, new URLSearchParams('page=2')).body as any;
    expect(p2.page).toBe(2);
    expect(p2.items).toHaveLength(25);
    expect(p2.items[0].year).toBe(2022);

    const p3 = routes.listQuestions(user, new URLSearchParams('page=3')).body as any;
    expect(p3.page).toBe(3);
    expect(p3.items).toHaveLength(13);

    // Páginas inválidas / fora do intervalo
    const pZero = routes.listQuestions(user, new URLSearchParams('page=0')).body as any;
    expect(pZero.page).toBe(1);
    const pNeg = routes.listQuestions(user, new URLSearchParams('page=-4')).body as any;
    expect(pNeg.page).toBe(1);
    const pHuge = routes.listQuestions(user, new URLSearchParams('page=999')).body as any;
    expect(pHuge.page).toBe(3);
    expect(pHuge.items).toHaveLength(13);
  });

  it('sinaliza hasImages corretamente para imagem inline, anexo e alternativa', () => {
    const p1 = routes.listQuestions(user, new URLSearchParams('page=1')).body as any;
    expect(p1.items[0].hasImages).toBe(true); // inline Markdown
    expect(p1.items[1].hasImages).toBe(true); // assets[]
    expect(p1.items[2].hasImages).toBe(true); // alternative assetUrl
    expect(p1.items[3].hasImages).toBe(false); // somente texto
  });

  it('filtra por ano e área recalculando total e totalPages corretamente', () => {
    const filtered = routes.listQuestions(user, new URLSearchParams('year=2022&area=CN')).body as any;
    expect(filtered.total).toBe(10);
    expect(filtered.totalPages).toBe(1);
    expect(filtered.items).toHaveLength(10);
    expect(filtered.items.every((q: any) => q.year === 2022 && q.area === 'CN')).toBe(true);
  });
});
