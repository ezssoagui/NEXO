import { expect, test, type Page } from '@playwright/test';
import { totpCode } from '../../src/server/auth/crypto';

/**
 * Fluxos E2E críticos (CRITERIOS_DE_ACEITACAO): cadastro → recomendação → sessão → evidência;
 * questão avulsa; flashcards; redação (dublê de IA SOMENTE em ambiente de teste); simulado;
 * administração com MFA; direitos de conta. Banco PGlite em memória com dados SINTÉTICOS.
 */
const unique = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
const PASSWORD = 'SenhaForte123';

async function signupAndOnboard(page: Page) {
  const email = unique();
  await page.goto('/cadastro');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  // Verificação de e-mail desligada (NEXO_EMAIL_VERIFICATION=off, ADR-020): a conta criada já entra.
  // O fluxo com confirmação por link é coberto em tests/db/auth-email-verification.test.ts.
  await expect(page).toHaveURL(/onboarding/, { timeout: 15_000 });
  await page.getByLabel('Como quer ser chamado(a)?').fill('Estudante E2E');
  await page.getByLabel('Data de nascimento').fill('2000-03-10');
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: 'Começar a estudar' }).click();
  await expect(page).toHaveURL(/inicio/, { timeout: 30_000 });
  return email;
}

test('cadastro, onboarding, recomendação e sessão adaptativa', async ({ page }) => {
  await signupAndOnboard(page);
  await expect(page.getByRole('heading', { name: 'Seu próximo passo' })).toBeVisible();
  await page.getByRole('button', { name: 'Estudar' }).first().click();
  await expect(page).toHaveURL(/estudar\/sessao/);
  await page.getByRole('button', { name: 'Começar' }).click();
  // Percorre atividades até encontrar uma questão; outras são puladas (autonomia).
  for (let i = 0; i < 6; i++) {
    const radios = page.getByRole('radio');
    if (await radios.count()) {
      await radios.first().click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();
      await expect(page.getByText(/Resposta (correta|incorreta)/)).toBeVisible();
      break;
    }
    const skip = page.getByRole('button', { name: 'Pular' });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.waitForTimeout(500);
  }
  const perf = await (await page.request.get('/api/performance?period=all')).json() as { overview: { answered: number } };
  expect(perf.overview.answered).toBeGreaterThanOrEqual(1);
});

test('questão avulsa com correção após envio e caderno de erros', async ({ page }) => {
  await signupAndOnboard(page);
  await page.goto('/questoes');
  await page.locator('a[href^="/questoes/"]').filter({ hasText: 'SINTÉTICO' }).first().click();
  await expect(page.getByText(/Resposta (correta|incorreta)/)).toHaveCount(0); // sem gabarito antes do envio
  await page.getByRole('radio').nth(4).click();
  await page.getByRole('button', { name: 'Confirmar resposta' }).click();
  await expect(page.getByText(/Resposta (correta|incorreta)/)).toBeVisible();
  await expect(page.getByText('Resolução comentada')).toBeVisible();
});

test('flashcards com FSRS', async ({ page }) => {
  await signupAndOnboard(page);
  await page.goto('/estudar/flashcards');
  await page.getByRole('button', { name: 'Revisar agora' }).click();
  await page.getByRole('button', { name: 'Mostrar resposta' }).click();
  await page.getByRole('button', { name: 'Bom' }).click();
  await expect(page.getByText(/\d+ \/ \d+|Revisão concluída/)).toBeVisible();
});

test('redação: rascunho, envio e correção estimada por competência', async ({ page }) => {
  await signupAndOnboard(page);
  await page.goto('/redacao');
  await page.getByRole('button', { name: 'Nova redação' }).click();
  await page.locator('dialog button').filter({ hasText: 'SINTÉTICO' }).first().click();
  await expect(page).toHaveURL(/redacao\/escrever/);
  const text = Array.from({ length: 10 }, (_, i) => `Parágrafo ${i + 1}: a sociedade brasileira precisa enfrentar este desafio com políticas públicas consistentes e participação social ampla.`).join('\n');
  await page.getByLabel('Texto da redação').fill(text);
  await expect(page.getByText('Rascunho salvo')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Enviar para correção' }).click();
  await expect(page).toHaveURL(/redacao\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByText('/1000')).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: 'C1 —' })).toBeVisible();
});

test('simulado personalizado: sem gabarito durante a prova; resultado por acertos', async ({ page }) => {
  await signupAndOnboard(page);
  await page.goto('/simulados');
  for (const area of ['Linguagens', 'Ciências Humanas', 'Ciências da Natureza']) await page.getByLabel(area).fill('0');
  await page.getByLabel('Matemática').fill('3');
  await page.getByLabel(/Cronometrar/).uncheck();
  await page.getByRole('button', { name: 'Montar e iniciar' }).click();
  await expect(page).toHaveURL(/simulados\/prova/, { timeout: 20_000 });
  await page.getByRole('radio').first().click();
  await expect(page.getByText(/Resposta (correta|incorreta)/)).toHaveCount(0);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Encerrar' }).click();
  await expect(page).toHaveURL(/simulados\/resultado/, { timeout: 20_000 });
  await expect(page.getByText('O NEXO não estima nota TRI.')).toBeVisible();
});

test('administração exige MFA e mostra visão geral', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('admin@nexo.local');
  await page.getByLabel('Senha').fill('nexo-admin-dev-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/inicio/);
  const blocked = await page.request.get('/api/admin/overview');
  expect(blocked.status()).toBe(403);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Configurar autenticador' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Código de 6 dígitos').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible({ timeout: 15_000 });
  expect((await page.request.get('/api/admin/overview')).status()).toBe(200);
});

test('direitos do titular: exportação de dados e isolamento da API', async ({ page }) => {
  await signupAndOnboard(page);
  const res = await page.request.get('/api/me/export');
  expect(res.status()).toBe(200);
  const data = await res.json() as { profile: unknown[] };
  expect(data.profile).toHaveLength(1);
  expect((await page.request.get('/api/admin/users')).status()).toBe(403);
  const anon = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3100' });
  expect((await anon.request.get('/api/dashboard')).status()).toBe(401);
  await anon.close();
});

test('acessibilidade básica e tema persistido', async ({ page }) => {
  await signupAndOnboard(page);
  await expect(page.locator('main#conteudo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).first()).toBeVisible();
  const toggle = page.getByRole('button', { name: /Alternar tema/ });
  await toggle.click();
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme-pref'));
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme-pref'))).toBe(theme);
});
