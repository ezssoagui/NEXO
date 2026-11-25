import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, type DB } from '../server/db';
import { EnemRepository, type OfficialEnemQuestionRow } from '../server/repositories/enem';
import { LocalAssetStorage, type AssetStorage } from '../server/gateways/assets';
import { formatEnemSkillId, type EnemAreaCode } from '../src/data/enemSkills';

/**
 * ADR-0004: Pipeline CLI offline idempotente de ingestão do acervo oficial do ENEM (2009+).
 * - Lê provas de dump JSON local (--source-dir) ou da API aberta enem.dev (com throttle 1 req/s).
 * - Cruza com ITENS_PROVA_{ANO}.csv dos Microdados do INEP para anexar CO_HABILIDADE (H01–H30),
 *   CO_ITEM e parâmetros TRI (NU_PARAM_A, NU_PARAM_B, NU_PARAM_C) + detecção de questões anuladas.
 * - Espelha imagens via AssetStorage (LocalAssetStorage no V1 -> R2/S3 em produção).
 */
export interface RawEnemQuestion {
  index: number;
  year: number;
  discipline: string;
  language?: string | null;
  context?: string | null;
  alternativesIntroduction?: string | null;
  correctAlternative?: string | null;
  files?: string[];
  bookletColor?: string;
  alternatives: { letter: string; text?: string | null; file?: string | null; isCorrect?: boolean }[];
}

export interface InepItemMetadata {
  position: number;
  area: EnemAreaCode;
  bookletColor: string;
  language: 'ingles' | 'espanhol' | null;
  itemCode: number | null;
  skillNum: number | null;
  triA: number | null;
  triB: number | null;
  triC: number | null;
  annulled: boolean;
}

export function mapDisciplineToArea(discipline: string): EnemAreaCode {
  const d = discipline.toLowerCase();
  if (d.includes('linguag') || d === 'lc') return 'LC';
  if (d.includes('human') || d === 'ch') return 'CH';
  if (d.includes('natur') || d === 'cn') return 'CN';
  return 'MT';
}

function normalizeColor(c: string): string {
  return c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function parseNum(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Faz parse do arquivo oficial ITENS_PROVA_{ANO}.csv do INEP (delimitado por `;` ou `,`).
 */
export function parseInepItemsCsv(csvContent: string): Map<string, InepItemMetadata> {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const map = new Map<string, InepItemMetadata>();
  if (lines.length < 2) return map;

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, '').trim().toUpperCase());
  const idx = (name: string) => headers.indexOf(name);

  const iPos = idx('CO_POSICAO');
  const iArea = idx('SG_AREA');
  const iItem = idx('CO_ITEM');
  const iHab = idx('CO_HABILIDADE');
  const iA = idx('NU_PARAM_A');
  const iB = idx('NU_PARAM_B');
  const iC = idx('NU_PARAM_C');
  const iColor = idx('TX_COR');
  const iLang = idx('TP_LINGUA');
  const iAband = idx('IN_ITEM_ABAN');
  const iGab = idx('TX_GABARITO');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const pos = Number(cols[iPos]);
    const area = (cols[iArea] || '').toUpperCase() as EnemAreaCode;
    if (!Number.isFinite(pos) || !['LC', 'CH', 'CN', 'MT'].includes(area)) continue;

    const color = normalizeColor(cols[iColor] || 'AZUL');
    const langCode = iLang >= 0 ? cols[iLang] : '';
    const language: 'ingles' | 'espanhol' | null = langCode === '0' ? 'ingles' : langCode === '1' ? 'espanhol' : null;
    const annulled = (iAband >= 0 && cols[iAband] === '1') || (iGab >= 0 && cols[iGab].toUpperCase() === 'X');

    const meta: InepItemMetadata = {
      position: pos,
      area,
      bookletColor: color,
      language,
      itemCode: parseNum(cols[iItem]),
      skillNum: parseNum(cols[iHab]),
      triA: parseNum(cols[iA]),
      triB: parseNum(cols[iB]),
      triC: parseNum(cols[iC]),
      annulled,
    };

    const key = `${area}:${color}:${pos}:${language ?? 'none'}`;
    map.set(key, meta);
  }
  return map;
}

export interface IngestSummary {
  imported: number;
  enrichedWithInep: number;
  annulled: number;
  mirroredAssets: number;
}

export async function ingestEnemBatch(opts: {
  db: DB;
  questions: RawEnemQuestion[];
  inepMeta?: Map<string, InepItemMetadata>;
  assetStorage: AssetStorage;
  fetchAsset?: (url: string) => Promise<{ buffer: Buffer; contentType: string } | null>;
}): Promise<IngestSummary> {
  const repo = new EnemRepository(opts.db);
  repo.seedOfficialSkills();

  const summary: IngestSummary = { imported: 0, enrichedWithInep: 0, annulled: 0, mirroredAssets: 0 };

  const mirror = async (url: string): Promise<string> => {
    if (!opts.fetchAsset) return url;
    const fetched = await opts.fetchAsset(url);
    if (!fetched) return url;
    const ext = url.split('?')[0].split('.').pop();
    const stored = await opts.assetStorage.put(fetched.buffer, fetched.contentType, ext);
    summary.mirroredAssets++;
    return stored.publicUrl;
  };

  for (const raw of opts.questions) {
    const area = mapDisciplineToArea(raw.discipline);
    const bookletColor = normalizeColor(raw.bookletColor || 'AZUL');
    const language: 'ingles' | 'espanhol' | null =
      raw.language === 'ingles' || raw.language === 'espanhol' ? raw.language : null;

    const metaKey = `${area}:${bookletColor}:${raw.index}:${language ?? 'none'}`;
    const meta = opts.inepMeta?.get(metaKey) ?? opts.inepMeta?.get(`${area}:AZUL:${raw.index}:${language ?? 'none'}`);

    const isAnnulled = meta?.annulled || !raw.correctAlternative || raw.correctAlternative.toUpperCase() === 'ANULADA';
    const correctAlt = isAnnulled ? 'ANULADA' : (raw.correctAlternative!.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E');
    const skillId = meta?.skillNum && meta.skillNum >= 1 && meta.skillNum <= 30 ? formatEnemSkillId(area, meta.skillNum) : null;

    if (meta) summary.enrichedWithInep++;
    if (isAnnulled) summary.annulled++;

    const mirroredAssets: string[] = [];
    for (const f of raw.files ?? []) {
      mirroredAssets.push(await mirror(f));
    }

    const alternatives = [];
    for (const a of raw.alternatives) {
      alternatives.push({
        letter: a.letter.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E',
        text: String(a.text ?? ''),
        assetUrl: a.file ? await mirror(a.file) : null,
      });
    }

    const id = `enem-${raw.year}-${area}-${String(raw.index).padStart(3, '0')}${language ? `-${language}` : ''}`;
    const row: OfficialEnemQuestionRow = {
      id,
      year: raw.year,
      questionIndex: raw.index,
      bookletColor,
      area,
      discipline: raw.discipline,
      language,
      skillId,
      inepItemCode: meta?.itemCode ?? null,
      triA: meta?.triA ?? null,
      triB: meta?.triB ?? null,
      triC: meta?.triC ?? null,
      contextMd: String(raw.context ?? ''),
      alternativesIntro: String(raw.alternativesIntroduction ?? ''),
      alternatives,
      correctAlternative: correctAlt,
      assets: mirroredAssets,
      status: isAnnulled ? 'annulled' : 'active',
      source: 'official_enem',
    };

    repo.upsertQuestion(row);
    summary.imported++;
  }

  return summary;
}

// Execução direta via CLI (`npm run ingest:enem -- --source-dir ... --inep-dir ...`)
async function runCli() {
  const args = process.argv.slice(2);
  const argVal = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const sourceDir = argVal('--source-dir');
  const inepDir = argVal('--inep-dir');
  const assetsDir = argVal('--assets-dir') || process.env.NEXO_ASSETS_DIR || 'server/data/assets';
  const yearsRange = argVal('--years') || '2023-2023';

  const db = openDb();
  const storage = new LocalAssetStorage(assetsDir);
  const fetchAsset = async (url: string) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return { buffer: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') || 'image/png' };
    } catch {
      return null;
    }
  };

  const questions: RawEnemQuestion[] = [];
  const inepMeta = new Map<string, InepItemMetadata>();

  if (inepDir && existsSync(inepDir)) {
    for (const f of readdirSync(inepDir).filter((x) => x.toLowerCase().endsWith('.csv'))) {
      const parsed = parseInepItemsCsv(readFileSync(join(inepDir, f), 'utf-8'));
      for (const [k, v] of parsed) inepMeta.set(k, v);
    }
  }

  if (sourceDir && existsSync(sourceDir)) {
    for (const f of readdirSync(sourceDir).filter((x) => x.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(sourceDir, f), 'utf-8'));
      const list = Array.isArray(data) ? data : data.questions ?? [];
      questions.push(...list);
    }
  } else {
    const [startY, endY] = yearsRange.split('-').map(Number);
    for (let y = startY; y <= (endY || startY); y++) {
      let offset = 0;
      while (true) {
        const res = await fetch(`https://api.enem.dev/v1/exams/${y}/questions?limit=50&offset=${offset}`);
        if (!res.ok) break;
        const json = (await res.json()) as any;
        questions.push(...(json.questions ?? []));
        if (!json.metadata?.hasMore) break;
        offset += 50;
        await new Promise((r) => setTimeout(r, 1100)); // respeita rate limit 1 req/s da enem.dev
      }
    }
  }

  const summary = await ingestEnemBatch({ db, questions, inepMeta, assetStorage: storage, fetchAsset });
  console.log('[ingest:enem] concluído:', JSON.stringify(summary));
}

if (process.argv[1]?.endsWith('ingest-enem.ts')) {
  runCli().catch((err) => {
    console.error('[ingest:enem] erro:', err);
    process.exit(1);
  });
}
