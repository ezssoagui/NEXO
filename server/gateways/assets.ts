import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * ADR-0004: Abstração de armazenamento de assets/imagens oficiais do ENEM.
 * V1 local: espelha em disco (server/data/assets/) com deduplicação SHA-256.
 * Produção futura: implementar R2AssetStorage ou S3AssetStorage com a mesma interface.
 */
export interface StoredAsset {
  key: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
}

export interface AssetStorage {
  put(buffer: Buffer, contentType: string, extension?: string): Promise<StoredAsset>;
  get(key: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  exists(key: string): Promise<boolean>;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

export class LocalAssetStorage implements AssetStorage {
  private baseDir: string;
  constructor(baseDir = process.env.NEXO_ASSETS_DIR || 'server/data/assets') {
    this.baseDir = resolve(baseDir);
    mkdirSync(this.baseDir, { recursive: true });
  }

  async put(buffer: Buffer, contentType: string, extension?: string): Promise<StoredAsset> {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const ext = (extension || EXT_BY_MIME[contentType.toLowerCase()] || 'bin').replace(/^\./, '').toLowerCase();
    const key = `${hash}.${ext}`;
    const fullPath = join(this.baseDir, key);
    if (!existsSync(fullPath)) {
      mkdirSync(this.baseDir, { recursive: true });
      writeFileSync(fullPath, buffer);
    }
    return { key, publicUrl: `/api/assets/${key}`, contentType, bytes: buffer.length };
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!/^[a-f0-9]{64}\.[a-z0-9]{2,5}$/i.test(key)) return null;
    const fullPath = join(this.baseDir, key);
    if (!existsSync(fullPath)) return null;
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return { buffer: readFileSync(fullPath), contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
  }

  async exists(key: string): Promise<boolean> {
    if (!/^[a-f0-9]{64}\.[a-z0-9]{2,5}$/i.test(key)) return false;
    return existsSync(join(this.baseDir, key));
  }
}
