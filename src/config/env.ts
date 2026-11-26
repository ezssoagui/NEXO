import { z } from 'zod';

/**
 * Configuração validada do servidor. Segredos existem apenas no servidor (13.3).
 * Nenhum valor default representa credencial real. Integrações pagas exigem flags
 * explícitas (OPENAI_ALLOW_PAID_CALLS / ASAAS_ALLOW_PRODUCTION) — CLAUDE.md.
 */
const schema = z.object({
  NEXO_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  NEXO_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXO_DB_DRIVER: z.enum(['pglite', 'postgres']).default('pglite'),
  NEXO_PGLITE_DIR: z.string().default('./.data/pglite'),
  DATABASE_URL: z.string().optional(),
  NEXO_AUTH_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  NEXO_SESSION_SECRET: z.string().min(32).optional(),
  // Verificação de e-mail no cadastro. 'off' (decisão provisória do usuário em 2026-11-26): conta criada já entra.
  // Com Supabase, desligar também "Confirm email" no painel do projeto. Ver ADR-020.
  NEXO_EMAIL_VERIFICATION: z.enum(['required', 'off']).default('off'),
  NEXO_SEED_SYNTHETIC: z.enum(['0', '1']).default('0'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_ALLOW_PAID_CALLS: z.enum(['true', 'false']).default('false'),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
  ASAAS_ALLOW_PRODUCTION: z.enum(['true', 'false']).default('false'),
  CRON_SECRET: z.string().min(24).optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Não incluir valores na mensagem (podem ser segredos).
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuração inválida: ${fields}`);
  }
  const e = parsed.data;
  if (e.NEXO_ENV === 'production') {
    if (e.NEXO_AUTH_PROVIDER === 'local') throw new Error('Provedor de autenticação local é proibido em produção');
    if (e.NEXO_DB_DRIVER === 'pglite') throw new Error('PGlite é proibido em produção');
    if (e.NEXO_SEED_SYNTHETIC === '1') throw new Error('Seed sintético é proibido em produção');
  }
  cached = e;
  return e;
}

export function resetEnvCache(): void {
  cached = undefined;
}

export function sessionSecret(): string {
  const s = env().NEXO_SESSION_SECRET;
  if (s) return s;
  if (env().NEXO_ENV === 'production' || env().NEXO_ENV === 'staging') throw new Error('NEXO_SESSION_SECRET ausente');
  // Somente desenvolvimento local: segredo efêmero por processo (sessões não sobrevivem a reinício).
  globalThis.__nexoEphemeralSecret ??= crypto.randomUUID() + crypto.randomUUID();
  return globalThis.__nexoEphemeralSecret;
}

declare global {
  var __nexoEphemeralSecret: string | undefined;
}
