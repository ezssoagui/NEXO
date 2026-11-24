/**
 * Backend da NEXO para IA — mantém as chaves no servidor.
 * Uso:  ANTHROPIC_API_KEY=... npm run server   (porta 8787; o Vite encaminha /api para cá)
 * Sem credenciais, responde 503 e o front-end permanece no modo demonstrativo, identificado como tal.
 */
import { createServer } from 'node:http';
import { providerFromEnv } from './providers';
import { diagnoseHandler, essayHandler, explainHandler, healthHandler, interventionLogHandler, questionHandler, tutorHandler } from './handlers';
import { openDb } from './db';
import { authenticate, login, logout, register } from './auth';
import { adminMetrics, deleteMe, exportMe, getState, putState } from './learning';

const provider = providerFromEnv();
const db = openDb();
const PORT = +(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.NEXO_ALLOWED_ORIGIN || 'http://localhost:5173';

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const send = (r: { status: number; body: unknown }) => { res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(r.body === null ? '' : JSON.stringify(r.body)); };
  try {
    const user = authenticate(db, req.headers.authorization);
    if (req.method === 'GET') {
      if (req.url === '/api/ai/health') return send(healthHandler(provider));
      if (req.url === '/api/learning/state') return send(getState(db, user));
      if (req.url === '/api/me/export') return send(exportMe(db, user));
      if (req.url === '/api/admin/metrics') return send(adminMetrics(db, user));
      return send({ status: 404, body: { error: 'not_found' } });
    }
    if (req.method === 'DELETE' && req.url === '/api/me') return send(deleteMe(db, user));
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 3_100_000) return send({ status: 413, body: { error: 'too_large' } }); }
    const body = raw ? JSON.parse(raw) : {};
    if (user) body.userId = user.id;   // usuário autenticado: limites e logs pelo id (pseudonimizado)
    if (req.method === 'PUT' && req.url === '/api/learning/state') return send(putState(db, user, body, raw));
    if (req.method !== 'POST') return send({ status: 404, body: { error: 'not_found' } });
    switch (req.url) {
      case '/api/auth/register': return send(register(db, body));
      case '/api/auth/login': return send(login(db, body));
      case '/api/auth/logout': return send(logout(db, req.headers.authorization));
      case '/api/ai/diagnose': return send(await diagnoseHandler(provider, body));
      case '/api/ai/tutor': return send(await tutorHandler(provider, body));
      case '/api/ai/explain': return send(await explainHandler(provider, body));
      case '/api/ai/essay': return send(await essayHandler(provider, body));
      case '/api/ai/questions': return send(await questionHandler(provider, body));
      case '/api/ai/log': return send(interventionLogHandler(body));
      default: return send({ status: 404, body: { error: 'not_found' } });
    }
  } catch { send({ status: 400, body: { error: 'bad_request', message: 'JSON inválido.' } }); }
}).listen(PORT, () => console.log(`[nexo-ai] porta ${PORT} · provedor ${provider.name} · ${provider.configured ? `modelo ${provider.model}` : 'SEM credenciais (front-end usará o modo demonstrativo)'}`));
