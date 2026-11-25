import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../../server/db';
import { LocalAssetStorage } from '../../server/gateways/assets';
import { EnemRepository } from '../../server/repositories/enem';
import {
  discoverAvailableYears,
  ingestAllYearsFromApi,
  ingestEnemBatch,
  parseInepItemsCsv,
  parseYearsArg,
  type RawEnemQuestion,
} from '../../scripts/ingest-enem';

describe('US2: Pipeline offline de ingestão ENEM + cruzamento INEP H1–H30/TRI + AssetStorage', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it('cruza questões com ITENS_PROVA CSV, marca anuladas, espelha imagens com deduplicação SHA-256 e é idempotente', async () => {
    const db = openDb(':memory:');
    const tmp = mkdtempSync(join(tmpdir(), 'nexo-assets-'));
    dirs.push(tmp);
    const storage = new LocalAssetStorage(tmp);

    const csv = [
      'CO_POSICAO;SG_AREA;CO_ITEM;TX_GABARITO;CO_HABILIDADE;IN_ITEM_ABAN;NU_PARAM_A;NU_PARAM_B;NU_PARAM_C;TX_COR;TP_LINGUA',
      '136;MT;90001;C;19;0;1,42;0,65;0,18;AZUL;',
      '137;MT;90002;X;19;1;0,0;0,0;0,0;AZUL;',
      '1;LC;80001;A;5;0;1,10;-0,40;0,20;AZUL;0',
    ].join('\n');

    const inepMeta = parseInepItemsCsv(csv);
    const sampleImg = Buffer.from('fake-png-binary-content');

    const questions: RawEnemQuestion[] = [
      {
        index: 136,
        year: 2023,
        discipline: 'matematica',
        bookletColor: 'Azul',
        context: 'Uma função linear modela o custo de produção.',
        alternativesIntroduction: 'Qual expressão representa o custo?',
        correctAlternative: 'C',
        files: ['https://enem.dev/2023/q136.png'],
        alternatives: [
          { letter: 'A', text: '2x' },
          { letter: 'B', text: '3x' },
          { letter: 'C', text: '2x + 10', isCorrect: true },
          { letter: 'D', text: 'x + 10' },
          { letter: 'E', text: '10x' },
        ],
      },
      {
        index: 137,
        year: 2023,
        discipline: 'matematica',
        bookletColor: 'Azul',
        context: 'Questão anulada pelo INEP.',
        alternativesIntroduction: 'Marque a correta.',
        correctAlternative: 'A',
        alternatives: [
          { letter: 'A', text: '1' },
          { letter: 'B', text: '2' },
          { letter: 'C', text: '3' },
          { letter: 'D', text: '4' },
          { letter: 'E', text: '5' },
        ],
      },
      {
        index: 1,
        year: 2023,
        discipline: 'linguagens',
        language: 'ingles',
        bookletColor: 'Azul',
        context: 'English reading passage.',
        alternativesIntroduction: 'The main idea is:',
        correctAlternative: 'A',
        alternatives: [
          { letter: 'A', text: 'Education', isCorrect: true },
          { letter: 'B', text: 'Sports' },
          { letter: 'C', text: 'Travel' },
          { letter: 'D', text: 'Music' },
          { letter: 'E', text: 'Cooking' },
        ],
      },
    ];

    const summary = await ingestEnemBatch({
      db,
      questions,
      inepMeta,
      assetStorage: storage,
      fetchAsset: async () => ({ buffer: sampleImg, contentType: 'image/png' }),
    });

    expect(summary.imported).toBe(3);
    expect(summary.enrichedWithInep).toBe(3);
    expect(summary.annulled).toBe(1);
    expect(summary.mirroredAssets).toBe(1);

    const repo = new EnemRepository(db);
    expect(repo.listSkills()).toHaveLength(120);

    // Questões ativas excluem automaticamente a anulada (137)
    const active = repo.listQuestions({});
    expect(active.total).toBe(2);

    const q136 = repo.getById('enem-2023-MT-136')!;
    expect(q136.skillId).toBe('MT-H19');
    expect(q136.triB).toBe(0.65);
    expect(q136.assets[0]).toMatch(/^\/api\/assets\/[a-f0-9]{64}\.png$/);

    // Imagem recuperável via LocalAssetStorage
    const key = q136.assets[0].replace('/api/assets/', '');
    expect(await storage.exists(key)).toBe(true);

    // Reexecução idempotente não duplica registros
    await ingestEnemBatch({ db, questions, inepMeta, assetStorage: storage });
    expect(repo.listQuestions({ includeAnnulled: true }).total).toBe(3);
  });

  it('reescreve imagens Markdown em contextMd, deduplica com files[], espelha alternativas e distingue Inglês/Espanhol', async () => {
    const db = openDb(':memory:');
    const tmp = mkdtempSync(join(tmpdir(), 'nexo-assets-md-'));
    dirs.push(tmp);
    const storage = new LocalAssetStorage(tmp);

    let fetchCount = 0;
    const fetchAsset = async (url: string) => {
      fetchCount++;
      return { buffer: Buffer.from(`img-bytes:${url}`), contentType: 'image/png' };
    };

    const questions: RawEnemQuestion[] = [
      {
        index: 91,
        year: 2022,
        discipline: 'ciencias-natureza',
        context: 'Observe o esquema:\n\n![Esquema](https://enem.dev/2022/q91.png)\n\nAnalise o circuito.',
        alternativesIntroduction: 'Qual figura representa o resultado?',
        correctAlternative: 'B',
        files: ['https://enem.dev/2022/q91.png', 'https://enem.dev/2022/q91-extra.png'],
        alternatives: [
          { letter: 'A', text: '', file: 'https://enem.dev/2022/q91-a.png' },
          { letter: 'B', text: 'Opção correta', file: 'https://enem.dev/2022/q91-b.png', isCorrect: true },
        ],
      },
      {
        index: 1,
        year: 2022,
        discipline: 'linguagens',
        language: 'ingles',
        context: 'English text.',
        alternativesIntroduction: 'Choose:',
        correctAlternative: 'A',
        alternatives: [{ letter: 'A', text: 'Yes', isCorrect: true }],
      },
      {
        index: 1,
        year: 2022,
        discipline: 'linguagens',
        language: 'espanhol',
        context: 'Texto en español.',
        alternativesIntroduction: 'Elige:',
        correctAlternative: 'A',
        alternatives: [{ letter: 'A', text: 'Sí', isCorrect: true }],
      },
    ];

    const summary = await ingestEnemBatch({ db, questions, assetStorage: storage, fetchAsset });
    expect(summary.imported).toBe(3);
    // q91.png aparece em contextMd e files[], mas deve ser baixado apenas 1 vez (total 4 URLs distintas)
    expect(fetchCount).toBe(4);
    expect(summary.mirroredAssets).toBe(4);

    const repo = new EnemRepository(db);
    const q91 = repo.getById('enem-2022-CN-091')!;
    expect(q91.contextMd).not.toContain('https://enem.dev');
    expect(q91.contextMd).toMatch(/!\[Esquema\]\(\/api\/assets\/[a-f0-9]{64}\.png\)/);
    expect(q91.assets).toHaveLength(2);
    expect(q91.alternatives[0].assetUrl).toMatch(/^\/api\/assets\/[a-f0-9]{64}\.png$/);
    expect(q91.hasImages).toBe(true);

    // Inglês e Espanhol armazenados separadamente
    expect(repo.getById('enem-2022-LC-001-ingles')).not.toBeNull();
    expect(repo.getById('enem-2022-LC-001-espanhol')).not.toBeNull();
  });

  it('descobre todos os anos disponíveis e mantém resiliência quando um ano falha durante a ingestão', async () => {
    const mockExamsFetch = (async () =>
      new Response(JSON.stringify([{ year: 2023 }, { year: 2009 }, { year: 2021 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;

    const discovered = await discoverAvailableYears(mockExamsFetch);
    expect(discovered).toEqual([2009, 2021, 2023]);
    expect(parseYearsArg('all', discovered)).toEqual([2009, 2021, 2023]);
    expect(parseYearsArg('2020-2022', discovered)).toEqual([2020, 2021, 2022]);
    expect(parseYearsArg('2019,2023', discovered)).toEqual([2019, 2023]);

    const db = openDb(':memory:');
    const tmp = mkdtempSync(join(tmpdir(), 'nexo-assets-multi-'));
    dirs.push(tmp);
    const storage = new LocalAssetStorage(tmp);

    const apiFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/exams/2021/')) {
        return new Response('unavailable', { status: 500 });
      }
      const year = url.includes('/exams/2009/') ? 2009 : 2023;
      return new Response(
        JSON.stringify({
          metadata: { hasMore: false },
          questions: [
            {
              index: 10,
              year,
              discipline: 'matematica',
              context: `Questão do ENEM ${year}`,
              alternativesIntroduction: 'Marque:',
              correctAlternative: 'A',
              alternatives: [{ letter: 'A', text: '1', isCorrect: true }],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const result = await ingestAllYearsFromApi({
      db,
      years: [2009, 2021, 2023],
      assetStorage: storage,
      fetchFn: apiFetch,
      throttleMs: 0,
      baseDelayMs: 1,
    });

    expect(result.failedYears).toEqual([2021]);
    expect(result.totals.imported).toBe(2);

    const repo = new EnemRepository(db);
    expect(repo.listYears().years).toEqual([
      { year: 2023, count: 1 },
      { year: 2009, count: 1 },
    ]);
  });
});
