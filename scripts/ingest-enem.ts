import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, type DB } from '../server/db';
import { EnemRepository, type OfficialEnemQuestionRow } from '../server/repositories/enem';
import { LocalAssetStorage, type AssetStorage } from '../server/gateways/assets';
import { formatEnemSkillId, type EnemAreaCode } from '../src/data/enemSkills';

/**
 * ADR-0004: Pipeline CLI offline idempotente de ingestão do acervo oficial do ENEM (2009+).
 * - Descobre automaticamente todos os anos disponíveis na API aberta enem.dev (`--years all`, padrão)
 *   ou lê dumps JSON locais (`--source-dir`), com throttle >= 1,1s e retentativa com backoff.
 * - Cruza com ITENS_PROVA_{ANO}.csv dos Microdados do INEP para anexar CO_HABILIDADE (H01–H30),
 *   CO_ITEM e parâmetros TRI (NU_PARAM_A, NU_PARAM_B, NU_PARAM_C) + detecção de questões anuladas.
 * - Espelha TODAS as imagens (files[], Markdown inline em context e alternatives[].file) via
 *   AssetStorage (LocalAssetStorage no V1 -> R2/S3 em produção), sem duplicação.
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

export interface IngestSummary {
  imported: number;
  enrichedWithInep: number;
  annulled: number;
  mirroredAssets: number;
}

export interface IngestYearReport extends IngestSummary {
  year: number;
  error?: string;
}

export const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function extractMarkdownImageUrls(md: string): string[] {
  const urls: string[] = [];
  for (const m of md.matchAll(MARKDOWN_IMAGE_RE)) {
    const url = m[2]?.trim();
    if (url) urls.push(url);
  }
  return urls;
}

export async function rewriteMarkdownImages(
  md: string,
  mirror: (url: string) => Promise<string>,
): Promise<{ text: string; mirroredUrls: string[] }> {
  if (!md) return { text: '', mirroredUrls: [] };
  const matches = [...md.matchAll(MARKDOWN_IMAGE_RE)];
  if (!matches.length) return { text: md, mirroredUrls: [] };

  let out = '';
  let lastIndex = 0;
  const mirroredUrls: string[] = [];

  for (const m of matches) {
    const start = m.index ?? 0;
    const alt = m[1] ?? '';
    const origUrl = m[2]?.trim() ?? '';
    out += md.slice(lastIndex, start);
    const nextUrl = origUrl ? await mirror(origUrl) : origUrl;
    if (nextUrl) mirroredUrls.push(nextUrl);
    out += `![${alt}](${nextUrl})`;
    lastIndex = start + m[0].length;
  }
  out += md.slice(lastIndex);
  return { text: out, mirroredUrls };
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
  const mirroredCache = new Map<string, string>();

  const mirror = async (url: string): Promise<string> => {
    const clean = url.trim();
    if (!clean) return clean;
    if (clean.includes('broken-image.svg')) return clean;
    if (clean.startsWith('/api/assets/')) return clean;
    const cached = mirroredCache.get(clean);
    if (cached) return cached;
    if (!opts.fetchAsset) {
      mirroredCache.set(clean, clean);
      return clean;
    }
    const fetched = await opts.fetchAsset(clean);
    if (!fetched) {
      mirroredCache.set(clean, clean);
      return clean;
    }
    const extCandidate = clean.split('?')[0].split('.').pop();
    const ext = extCandidate && /^[a-z0-9]{2,5}$/i.test(extCandidate) ? extCandidate : undefined;
    const stored = await opts.assetStorage.put(fetched.buffer, fetched.contentType, ext);
    summary.mirroredAssets++;
    mirroredCache.set(clean, stored.publicUrl);
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

    const rewrittenContext = await rewriteMarkdownImages(String(raw.context ?? ''), mirror);

    const assetSet = new Set<string>();
    for (const f of raw.files ?? []) {
      if (f.includes('broken-image.svg')) continue;
      const mirrored = await mirror(f);
      if (mirrored && !mirrored.includes('broken-image.svg')) assetSet.add(mirrored);
    }
    for (const u of rewrittenContext.mirroredUrls) {
      if (u && !u.includes('broken-image.svg')) assetSet.add(u);
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
      contextMd: rewrittenContext.text,
      alternativesIntro: String(raw.alternativesIntroduction ?? ''),
      alternatives,
      correctAlternative: correctAlt,
      assets: [...assetSet],
      status: isAnnulled ? 'annulled' : 'active',
      source: 'official_enem',
    };

    repo.upsertQuestion(row);
    summary.imported++;
  }

  return summary;
}

export function parseYearsArg(yearsArg: string | undefined, availableYears: number[]): number[] {
  const cleaned = (yearsArg ?? 'all').trim().toLowerCase();
  if (!cleaned || cleaned === 'all') {
    return [...new Set(availableYears.filter((y) => Number.isInteger(y) && y >= 2009))].sort((a, b) => a - b);
  }
  if (cleaned.includes(',')) {
    return [...new Set(cleaned.split(',').map((s) => Number(s.trim())).filter((y) => Number.isInteger(y) && y >= 2009))].sort(
      (a, b) => a - b,
    );
  }
  if (cleaned.includes('-')) {
    const [s, e] = cleaned.split('-').map((x) => Number(x.trim()));
    if (!Number.isInteger(s) || s < 2009) return [];
    const end = Number.isInteger(e) && e >= s ? e : s;
    const out: number[] = [];
    for (let y = s; y <= end; y++) out.push(y);
    return out;
  }
  const single = Number(cleaned);
  return Number.isInteger(single) && single >= 2009 ? [single] : [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJsonWithRetry(
  url: string,
  opts: { fetchFn?: typeof fetch; maxRetries?: number; baseDelayMs?: number } = {},
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const fetchFn = opts.fetchFn ?? fetch;
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1200;

  let lastStatus = 0;
  let lastError = 'network_error';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchFn(url);
      lastStatus = res.status;
      if (res.ok) {
        return { ok: true, status: res.status, data: await res.json() };
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        if (attempt < maxRetries) {
          await sleep(baseDelayMs * Math.pow(2, attempt));
          continue;
        }
      }
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    } catch (e) {
      lastError = (e as Error).message || 'network_error';
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}

export async function discoverAvailableYears(
  fetchFn: typeof fetch = fetch,
  fallbackEndYear = new Date().getFullYear(),
): Promise<number[]> {
  const res = await fetchJsonWithRetry('https://api.enem.dev/v1/exams', { fetchFn, maxRetries: 2, baseDelayMs: 500 });
  if (res.ok && Array.isArray(res.data)) {
    const years = res.data
      .map((item: any) => Number(item?.year))
      .filter((y: number) => Number.isInteger(y) && y >= 2009);
    if (years.length > 0) {
      return [...new Set(years)].sort((a, b) => a - b);
    }
  }
  const fallback: number[] = [];
  for (let y = 2009; y <= Math.max(2009, fallbackEndYear); y++) fallback.push(y);
  return fallback;
}

export async function ingestAllYearsFromApi(opts: {
  db: DB;
  years: number[];
  inepMeta?: Map<string, InepItemMetadata>;
  assetStorage: AssetStorage;
  fetchFn?: typeof fetch;
  fetchAsset?: (url: string) => Promise<{ buffer: Buffer; contentType: string } | null>;
  throttleMs?: number;
  baseDelayMs?: number;
  onYearComplete?: (report: IngestYearReport) => void;
}): Promise<{ reports: IngestYearReport[]; totals: IngestSummary; failedYears: number[] }> {
  const fetchFn = opts.fetchFn ?? fetch;
  const throttleMs = opts.throttleMs ?? 1100;
  const baseDelayMs = opts.baseDelayMs ?? 1200;

  const reports: IngestYearReport[] = [];
  const failedYears: number[] = [];
  const totals: IngestSummary = { imported: 0, enrichedWithInep: 0, annulled: 0, mirroredAssets: 0 };

  for (const year of opts.years) {
    const yearQuestions: RawEnemQuestion[] = [];
    let offset = 0;
    let yearError: string | undefined;

    while (true) {
      const res = await fetchJsonWithRetry(
        `https://api.enem.dev/v1/exams/${year}/questions?limit=50&offset=${offset}`,
        { fetchFn, maxRetries: 3, baseDelayMs },
      );
      if (!res.ok) {
        yearError = res.error ?? `HTTP ${res.status}`;
        break;
      }
      const list = Array.isArray(res.data?.questions) ? (res.data.questions as RawEnemQuestion[]) : [];
      yearQuestions.push(...list);
      if (!res.data?.metadata?.hasMore || list.length === 0) break;
      offset += 50;
      if (throttleMs > 0) await sleep(throttleMs);
    }

    let summary: IngestSummary = { imported: 0, enrichedWithInep: 0, annulled: 0, mirroredAssets: 0 };
    if (yearQuestions.length > 0) {
      summary = await ingestEnemBatch({
        db: opts.db,
        questions: yearQuestions,
        inepMeta: opts.inepMeta,
        assetStorage: opts.assetStorage,
        fetchAsset: opts.fetchAsset,
      });
    }

    const report: IngestYearReport = { year, ...summary, ...(yearError ? { error: yearError } : {}) };
    reports.push(report);
    if (yearError) failedYears.push(year);

    totals.imported += summary.imported;
    totals.enrichedWithInep += summary.enrichedWithInep;
    totals.annulled += summary.annulled;
    totals.mirroredAssets += summary.mirroredAssets;

    opts.onYearComplete?.(report);
    if (throttleMs > 0) await sleep(throttleMs);
  }

  return { reports, totals, failedYears };
}

// Execução direta via CLI (`npm run ingest:enem` importa todos os anos disponíveis por padrão)
async function runCli() {
  const args = process.argv.slice(2);
  const argVal = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const sourceDir = argVal('--source-dir');
  const inepDir = argVal('--inep-dir');
  const assetsDir = argVal('--assets-dir') || process.env.NEXO_ASSETS_DIR || 'server/data/assets';
  const yearsArg = argVal('--years');

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

  const inepMeta = new Map<string, InepItemMetadata>();
  if (inepDir && existsSync(inepDir)) {
    for (const f of readdirSync(inepDir).filter((x) => x.toLowerCase().endsWith('.csv'))) {
      const parsed = parseInepItemsCsv(readFileSync(join(inepDir, f), 'utf-8'));
      for (const [k, v] of parsed) inepMeta.set(k, v);
    }
  }

  if (sourceDir && existsSync(sourceDir)) {
    const questions: RawEnemQuestion[] = [];
    for (const f of readdirSync(sourceDir).filter((x) => x.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(sourceDir, f), 'utf-8'));
      const list = Array.isArray(data) ? data : data.questions ?? [];
      questions.push(...list);
    }
    const summary = await ingestEnemBatch({ db, questions, inepMeta, assetStorage: storage, fetchAsset });
    console.log('[ingest:enem] concluído (offline):', JSON.stringify(summary));
    return;
  }

  const availableYears = !yearsArg || yearsArg.trim().toLowerCase() === 'all' ? await discoverAvailableYears() : [];
  const years = parseYearsArg(yearsArg, availableYears);
  console.log(`[ingest:enem] iniciando ingestão para ${years.length} ano(s): ${years.join(', ')}`);

  const result = await ingestAllYearsFromApi({
    db,
    years,
    inepMeta,
    assetStorage: storage,
    fetchAsset,
    onYearComplete: (r) => {
      const status = r.error ? `FALHA (${r.error})` : 'OK';
      console.log(
        `[ingest:enem] ${r.year}: ${status} · importadas=${r.imported} · anuladas=${r.annulled} · imagens=${r.mirroredAssets}`,
      );
    },
  });

  console.log('[ingest:enem] resumo final:', JSON.stringify({ totals: result.totals, failedYears: result.failedYears }));
}

if (process.argv[1]?.endsWith('ingest-enem.ts')) {
  runCli().catch((err) => {
    console.error('[ingest:enem] erro:', err);
    process.exit(1);
  });
}
