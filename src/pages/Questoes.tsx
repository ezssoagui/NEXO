import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Lock, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { OFFICIAL_ENEM_SKILLS, type EnemAreaCode } from '../data/enemSkills';
import { PageHeader, Badge, Card, Empty } from '../components/ui';
import { apiRequest, setAuthToken, type OfficialEnemQuestionDTO } from '../services/api';

const AREA_OPTIONS: [EnemAreaCode, string][] = [
  ['LC', 'Linguagens (LC)'],
  ['CH', 'Ciências Humanas (CH)'],
  ['CN', 'Ciências da Natureza (CN)'],
  ['MT', 'Matemática (MT)'],
];

function triLabel(triB: number | null): { text: string; tone: 'mint' | 'amber' | 'red' | 'slate' } {
  if (triB === null) return { text: 'TRI s/ dado', tone: 'slate' };
  if (triB < -0.5) return { text: 'Fácil (TRI)', tone: 'mint' };
  if (triB <= 1.0) return { text: 'Média (TRI)', tone: 'amber' };
  return { text: 'Difícil (TRI)', tone: 'red' };
}

export default function Questoes() {
  const [sp] = useSearchParams();
  const [area, setArea] = useState<string>(sp.get('area') ?? '');
  const [skillId, setSkillId] = useState<string>(sp.get('skill') ?? '');
  const [year, setYear] = useState<string>(sp.get('year') ?? '');
  const [difficultyBand, setDifficultyBand] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const [items, setItems] = useState<OfficialEnemQuestionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [gateError, setGateError] = useState<{ status: number; message: string } | null>(null);

  const activateDevSession = async () => {
    setActivating(true);
    const email = 'dev.estudante@nexo.local';
    const password = 'DevPassword123';
    let auth = await apiRequest<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!auth.ok) {
      auth = await apiRequest<{ token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname: 'EstudanteDev', isMinor: false, lgpdConsent: true }),
      });
    }
    if (auth.ok && auth.data?.token) {
      setAuthToken(auth.data.token);
      await apiRequest('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode: 'nexo_annual',
          paymentMethod: 'pix',
          payer: { name: 'Pagador Dev', financialEmail: email, isGuardian: false },
        }),
      });
      await apiRequest('/api/billing/dev/simulate', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm_payment' }),
      });
    }
    setActivating(false);
    load();
  };

  const load = async () => {
    setLoading(true);
    setGateError(null);
    const params = new URLSearchParams();
    if (area) params.set('area', area);
    if (skillId) params.set('skillId', skillId);
    if (year) params.set('year', year);
    if (difficultyBand) params.set('difficultyBand', difficultyBand);
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));

    const res = await apiRequest<{ items: OfficialEnemQuestionDTO[]; total: number }>(`/api/enem/questions?${params.toString()}`);
    if (!res.ok) {
      setGateError({ status: res.status, message: res.message || 'Erro ao carregar questões oficiais do ENEM.' });
      setItems([]);
      setTotal(0);
    } else {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, skillId, year, difficultyBand, status, page]);

  const filteredSkills = area ? OFFICIAL_ENEM_SKILLS.filter((s) => s.area === area) : OFFICIAL_ENEM_SKILLS;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        title="Banco Oficial de Questões ENEM"
        subtitle="100% questões oficiais de provas do ENEM (2009+), organizadas por área, habilidade oficial (H1–H30) e dificuldade TRI — sem questões fictícias."
      />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit space-y-3 lg:sticky lg:top-20">
          <div className="flex items-center gap-2 font-semibold"><Filter size={16} /> Filtros ENEM</div>

          <div>
            <label className="label !text-xs" htmlFor="f-area">Área do ENEM</label>
            <select id="f-area" className="input !py-2" value={area} onChange={(e) => { setArea(e.target.value); setSkillId(''); setPage(0); }}>
              <option value="">Todas as áreas</option>
              {AREA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="label !text-xs" htmlFor="f-skill">Habilidade oficial (H1–H30)</label>
            <select id="f-skill" className="input !py-2" value={skillId} onChange={(e) => { setSkillId(e.target.value); setPage(0); }}>
              <option value="">Todas as habilidades</option>
              {filteredSkills.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.description.slice(0, 60)}…</option>)}
            </select>
          </div>

          <div>
            <label className="label !text-xs" htmlFor="f-year">Ano da prova</label>
            <select id="f-year" className="input !py-2" value={year} onChange={(e) => { setYear(e.target.value); setPage(0); }}>
              <option value="">Todos os anos</option>
              {Array.from({ length: 17 }, (_, i) => 2025 - i).map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="label !text-xs" htmlFor="f-tri">Dificuldade (TRI)</label>
            <select id="f-tri" className="input !py-2" value={difficultyBand} onChange={(e) => { setDifficultyBand(e.target.value); setPage(0); }}>
              <option value="">Todas</option>
              <option value="facil">Fácil (b &lt; -0,5)</option>
              <option value="media">Média (-0,5 a 1,0)</option>
              <option value="dificil">Difícil (b &gt; 1,0)</option>
            </select>
          </div>

          <div>
            <label className="label !text-xs" htmlFor="f-status">Meu histórico</label>
            <select id="f-status" className="input !py-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              <option value="">Todas</option>
              <option value="unanswered">Não respondidas</option>
              <option value="wrong">Erradas</option>
              <option value="fragile">Acertadas com dúvida/chute</option>
            </select>
          </div>

          <button className="btn-ghost btn-sm w-full" onClick={() => { setArea(''); setSkillId(''); setYear(''); setDifficultyBand(''); setStatus(''); setPage(0); }}>
            Limpar filtros
          </button>
        </Card>

        <div className="space-y-3">
          {gateError ? (
            <Card className="space-y-3 border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <Lock size={18} />
                {gateError.status === 402 ? 'Assinatura NEXO ativa necessária' : gateError.status === 401 ? 'Autenticação necessária' : 'Não foi possível carregar o banco'}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{gateError.message}</p>
              <div className="flex flex-wrap gap-2">
                {import.meta.env.DEV && (gateError.status === 401 || gateError.status === 402) && (
                  <button className="btn-primary btn-sm" disabled={activating} onClick={activateDevSession}>
                    {activating ? 'Ativando…' : 'Ativar sessão + assinatura local (dev)'}
                  </button>
                )}
                <Link to="/planos" className="btn-dark btn-sm">Ver Planos NEXO</Link>
                <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Tentar novamente</button>
              </div>
            </Card>
          ) : loading ? (
            <Card className="py-10 text-center text-sm text-slate-500">Carregando questões oficiais do ENEM…</Card>
          ) : items.length === 0 ? (
            <Empty
              title="Nenhuma questão oficial encontrada"
              text="Execute `npm run ingest:enem -- --years 2023-2023` para importar provas oficiais para o banco local ou ajuste os filtros."
            />
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="muted">{total} questão(ões) oficial(is) do ENEM</span>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={14} /> Anterior</button>
                  <span className="text-xs font-medium">Página {page + 1} de {totalPages}</span>
                  <button className="btn-ghost btn-sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima <ChevronRight size={14} /></button>
                </div>
              </div>

              {items.map((q) => {
                const tri = triLabel(q.triB);
                return (
                  <Link key={q.id} to={`/questoes/${encodeURIComponent(q.id)}`} className="card block !p-4 transition hover:border-mint-400 hover:shadow-md">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">ENEM {q.year} · Q{q.questionIndex}</span>
                      <Badge tone="navy">Oficial ENEM</Badge>
                      <Badge>{q.area}</Badge>
                      {q.language && <Badge tone="sky">{q.language}</Badge>}
                      {q.skillId && <Badge tone="violet">{q.skillId}</Badge>}
                      <Badge tone={tri.tone}>{tri.text}</Badge>
                    </div>
                    <p className="line-clamp-3 text-sm text-slate-700 dark:text-slate-200">{q.contextMd || q.alternativesIntro}</p>
                    {q.alternativesIntro && q.contextMd && (
                      <p className="mt-1 line-clamp-1 text-xs font-medium text-navy-800 dark:text-mint-300">{q.alternativesIntro}</p>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
