/**
 * Backend da NEXO V1 Comercial (local-first SQLite + gateways substituíveis + Multi-LLM).
 * Uso: npm run server (porta 8787; o Vite encaminha /api para cá).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { providerFromEnv } from './providers';
import { diagnoseHandler, essayHandler, explainHandler, healthHandler, interventionLogHandler, questionHandler, tutorHandler } from './handlers';
import { openDb, type DB } from './db';
import { adminMetrics, getState, putState } from './learning';
import { paymentGatewayFromEnv, type PaymentGateway } from './gateways/payment';
import { LocalAssetStorage, type AssetStorage } from './gateways/assets';
import { BillingRepository, hasActivePedagogicalAccess } from './repositories/billing';
import { createAuthRoutes } from './routes/auth';
import { createBillingRoutes } from './routes/billing';
import { createEnemRoutes } from './routes/enem';

export interface AppContext {
  db: DB;
  gateway: PaymentGateway;
  assets: AssetStorage;
}

export function createAppHandler(ctx: AppContext) {
  const provider = providerFromEnv();
  const billingRepo = new BillingRepository(ctx.db);
  const authRoutes = createAuthRoutes(ctx.db);
  const billingRoutes = createBillingRoutes(ctx.db, ctx.gateway);
  const enemRoutes = createEnemRoutes(ctx.db);

  const requirePaidStudent = (user: ReturnType<typeof authRoutes.authenticate>) => {
    if (!user) return { status: 401, body: { error: 'unauthorized', message: 'Faça login para continuar.' } };
    if (user.role === 'admin') return null;
    const sub = billingRepo.getLatestForUser(user.id);
    if (!hasActivePedagogicalAccess(sub)) {
      return {
        status: 402,
        body: {
          error: 'subscription_required',
          status: sub?.status ?? 'none',
          canReactivate: true,
          message: 'Assinatura NEXO ativa necessária para acessar as ferramentas de estudo.',
        },
      };
    }
    return null;
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const ALLOWED_ORIGIN = process.env.NEXO_ALLOWED_ORIGIN || 'http://localhost:5173';
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const send = (r: { status: number; body: unknown }) => {
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(r.body === null ? '' : JSON.stringify(r.body));
    };

    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname;

      // Assets espelhados do ENEM (ADR-0004)
      if (req.method === 'GET' && path.startsWith('/api/assets/')) {
        const key = path.slice('/api/assets/'.length);
        const asset = await ctx.assets.get(key);
        if (!asset) return send({ status: 404, body: { error: 'not_found' } });
        res.writeHead(200, { 'Content-Type': asset.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
        res.end(asset.buffer);
        return;
      }

      const user = authRoutes.authenticate(req.headers.authorization);

      // Rotas públicas e de conta/LGPD (sempre acessíveis mesmo se assinatura suspensa)
      if (req.method === 'GET') {
        if (path === '/api/ai/health') return send(healthHandler(provider));
        if (path === '/api/billing/plans') return send(billingRoutes.plans());
        if (path === '/api/me') return send(authRoutes.me(user));
        if (path === '/api/me/export') return send(authRoutes.exportMe(user));
        if (path === '/api/admin/metrics') return send(adminMetrics(ctx.db, user));

        // Rotas pedagógicas protegidas pelo gate 402
        const gate = requirePaidStudent(user);
        if (path === '/api/learning/state') return send(gate ?? getState(ctx.db, user));
        if (path === '/api/enem/skills') return send(gate ?? enemRoutes.listSkills(url.searchParams));
        if (path === '/api/enem/years') return send(gate ?? enemRoutes.listYears());
        if (path === '/api/enem/questions') return send(gate ?? enemRoutes.listQuestions(user!, url.searchParams));
        if (path.startsWith('/api/enem/questions/')) {
          const id = decodeURIComponent(path.slice('/api/enem/questions/'.length));
          return send(gate ?? enemRoutes.getQuestion(id));
        }
        return send({ status: 404, body: { error: 'not_found' } });
      }

      if (req.method === 'DELETE' && path === '/api/me') return send(authRoutes.deleteMe(user));

      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 3_100_000) return send({ status: 413, body: { error: 'too_large' } });
      }
      const body = raw ? JSON.parse(raw) : {};
      if (user) body.userId = user.id;

      if (req.method === 'PUT') {
        if (path === '/api/me/profile') return send(authRoutes.updateProfile(user, body));
        if (path === '/api/learning/state') {
          const gate = requirePaidStudent(user);
          return send(gate ?? putState(ctx.db, user, body, raw));
        }
        return send({ status: 404, body: { error: 'not_found' } });
      }

      if (req.method !== 'POST') return send({ status: 404, body: { error: 'not_found' } });

      // Auth & Billing (acessíveis sem assinatura ativa)
      if (path === '/api/auth/register') return send(authRoutes.register(body));
      if (path === '/api/auth/login') return send(authRoutes.login(body));
      if (path === '/api/auth/logout') return send(authRoutes.logout(req.headers.authorization));
      if (path === '/api/auth/forgot-password') return send(authRoutes.forgotPassword(body));
      if (path === '/api/auth/reset-password') return send(authRoutes.resetPassword(body));
      if (path === '/api/billing/checkout') return send(await billingRoutes.checkout(user, body));
      if (path === '/api/billing/addons/checkout') return send(await billingRoutes.addonCheckout(user, body));
      if (path === '/api/billing/cancel') return send(await billingRoutes.cancel(user));
      if (path === '/api/billing/upgrade-annual') return send(billingRoutes.upgradeAnnual(user));
      if (path === '/api/billing/webhook') return send(billingRoutes.webhook(body));
      if (path === '/api/billing/dev/simulate') return send(billingRoutes.devSimulate(user, body));

      // Rotas pedagógicas e de IA (exigem assinatura ativa)
      const gate = requirePaidStudent(user);
      if (gate) return send(gate);

      if (path === '/api/learning/proof-question') return send(enemRoutes.proofQuestion(user!, body));
      if (path.startsWith('/api/enem/questions/') && path.endsWith('/report')) {
        const id = decodeURIComponent(path.slice('/api/enem/questions/'.length, -'/report'.length));
        return send(enemRoutes.reportQuestion(user!, id, body));
      }

      switch (path) {
        case '/api/ai/diagnose':
          return send(await diagnoseHandler(provider, body));
        case '/api/ai/tutor':
          return send(await tutorHandler(provider, body));
        case '/api/ai/explain':
          return send(await explainHandler(provider, body));
        case '/api/ai/essay':
          return send(await essayHandler(provider, body));
        case '/api/ai/questions':
          return send(await questionHandler(provider, body));
        case '/api/ai/log':
          return send(interventionLogHandler(body));
        default:
          return send({ status: 404, body: { error: 'not_found' } });
      }
    } catch {
      send({ status: 400, body: { error: 'bad_request', message: 'JSON inválido.' } });
    }
  };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const db = openDb();
  const gateway = paymentGatewayFromEnv();
  const assets = new LocalAssetStorage();
  const PORT = +(process.env.PORT || 8787);
  createServer(createAppHandler({ db, gateway, assets })).listen(PORT, () =>
    console.log(`[nexo-v1] porta ${PORT} · gateway=${gateway.name} · storage=local-sqlite`),
  );
}
