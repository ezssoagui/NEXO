import { defineConfig } from '@playwright/test';

// Usa o Google Chrome instalado (channel: 'chrome') para não baixar navegadores (disco limitado).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXO_ENV: 'test',
      NEXO_AUTH_PROVIDER: 'local',
      NEXO_DB_DRIVER: 'pglite',
      NEXO_PGLITE_DIR: 'memory://',
      NEXO_SESSION_SECRET: 'e2e-only-secret-not-for-production-0123456789',
      NEXO_SEED_SYNTHETIC: '1',
      NEXO_AI_FAKE: '1', // dublê de IA permitido somente com NEXO_ENV=test
      NEXO_RATE_LIMIT_FACTOR: '50', // idem: só tem efeito com NEXO_ENV=test
      NEXO_APP_URL: 'http://localhost:3100',
    },
  },
});
