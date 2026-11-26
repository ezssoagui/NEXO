import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'data/**', 'referencias/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  ...next,
];

export default config;
