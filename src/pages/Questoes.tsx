import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, Image as ImageIcon, Lock, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { OFFICIAL_ENEM_SKILLS, type EnemAreaCode } from '../data/enemSkills';
import { Badge, Empty, PageHeader, cx } from '../components/ui';
import Pagination from '../components/Pagination';
import { stripMarkdownImages } from '../components/EnemMedia';
import { useStore } from '../store/useStore';
import {
  apiRequest,
  setAuthToken,
  type EnemCatalogPageDTO,
  type EnemYearsSummaryDTO,
  type OfficialEnemQuestionDTO,
} from '../services/api';

const PAGE_SIZE = 25;

const AREA_OPTIONS: [EnemAreaCode, string][] = [
  ['LC', 'Linguagens (LC)'],
  ['CH', 'Ciências Humanas (CH)'],
  ['CN', 'Ciências da Natureza (CN)'],
  ['MT', 'Matemática (MT)'],
];

const AREA_SHORT: Record<EnemAreaCode, string> = {
  LC: 'Linguagens',
  CH: 'Humanas',
  CN: 'Natureza',
  MT: 'Matemática',
};

function triLabel(triB: number | null): string | null {
  if (triB === null) return null;
  if (triB < -0.5) return 'Fácil';
  if (triB <= 1.0) return 'Média';
  return 'Difícil';
}

function parsePageParam(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default function Questoes() {
  const location = useLocation();
  const [sp, setSp] = useSearchParams();
  const attempts = useStore((s) => s.attempts);
  const lastAttemptByQid = useMemo(() => new Map(attempts.map((a) => [a.qid, a])), [attempts]);

  const area = sp.get('area') ?? '';
  const skillId = sp.get('skill') ?? '';
  const year = sp.get('year') ?? '';
  const language = sp.get('lang') ?? '';
  const search = sp.get('q') ?? '';
  const difficultyBand = sp.get('tri') ?? '';
  const status = sp.get('status') ?? '';
  const page = parsePageParam(sp.get('page'));

  const [searchInput, setSearchInput] = useState(search);
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(area || skillId || year || language || search || difficultyBand || status),
  );
  const [items, setItems] = useState<OfficialEnemQuestionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(page);
  const [availableYears, setAvailableYears] = useState<{ year: number; count: number }[]>([]);
  const [withSkillCount, setWithSkillCount] = useState(0);
  const [withTriCount, setWithTriCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [gateError, setGateError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      const next = new URLSearchParams(sp);
      for (const [k, v] of Object.entries(patch)) {
        if (!v) next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete('page');
      setSp(next);
    },
    [sp, setSp],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, nextPage));
      const next = new URLSearchParams(sp);
      if (clamped <= 1) next.delete('page');
      else next.set('page', String(clamped));
      setSp(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [sp, setSp, totalPages],
  );

  const loadYears = useCallback(async () => {
    const res = await apiRequest<EnemYearsSummaryDTO>('/api/enem/years');
    if (res.ok && res.data?.years) {
      setAvailableYears(res.data.years);
      setWithSkillCount(res.data.withSkillCount ?? 0);
      setWithTriCount(res.data.withTriCount ?? 0);
    }
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setGateError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (area) params.set('area', area);
    if (skillId) params.set('skillId', skillId);
    if (year) params.set('year', year);
    if (language) params.set('language', language);
    if (search) params.set('search', search);
    if (difficultyBand) params.set('difficultyBand', difficultyBand);
    if (status) params.set('status', status);

    const res = await apiRequest<EnemCatalogPageDTO>(`/api/enem/questions?${params.toString()}`);
    if (!res.ok) {
      setGateError({
        status: res.status,
        message: res.message || 'Erro ao carregar o catálogo oficial do ENEM.',
      });
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setCurrentPage(1);
    } else {
      setItems(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setCurrentPage(res.data.page);
      if (res.data.page !== page) {
        const next = new URLSearchParams(sp);
        if (res.data.page <= 1) next.delete('page');
        else next.set('page', String(res.data.page));
        setSp(next, { replace: true });
      }
    }
    setLoading(false);
  }, [area, skillId, year, language, search, difficultyBand, status, page, sp, setSp]);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

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
        body: JSON.stringify({
          email,
          password,
          nickname: 'EstudanteDev',
          isMinor: false,
          lgpdConsent: true,
        }),
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
    await Promise.all([loadYears(), loadQuestions()]);
  };

  const filteredSkills = useMemo(
    () => (area ? OFFICIAL_ENEM_SKILLS.filter((s) => s.area === area) : OFFICIAL_ENEM_SKILLS),
    [area],
  );
  const activeFilters = [area, skillId, year, language, search, difficultyBand, status].filter(Boolean).length;
  const clearFilters = () => {
    setSearchInput('');
    setSp(new URLSearchParams());
  };
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <div>
      <PageHeader
        title="Questões ENEM"
        subtitle="Catálogo oficial de provas do ENEM de todos os anos disponíveis, organizado em páginas de 25 questões."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="section-title">
            Catálogo oficial
            {!loading && !gateError && (
              <span className="muted font-normal"> · {total.toLocaleString('pt-BR')}</span>
            )}
          </h2>
          {!loading && !gateError && total > 0 && (
            <span className="muted text-xs">
              (página {currentPage} de {totalPages})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilters > 0 && (
            <button type="button" className="btn-quiet text-xs" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
          <button
            type="button"
            className="btn-ghost btn-sm"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal size={14} aria-hidden />
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-4 space-y-3 rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900/50">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateParams({ q: searchInput.trim() || null }, true);
            }}
          >
            <input
              type="search"
              className="input !py-1.5 flex-1"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar no enunciado (ex.: fotossíntese, logaritmo, Vargas)…"
              aria-label="Buscar no enunciado"
            />
            <button type="submit" className="btn-ghost btn-sm">
              Buscar
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="label !text-xs" htmlFor="f-year">
                Ano da prova
              </label>
              <select
                id="f-year"
                className="input !py-1.5"
                value={year}
                onChange={(e) => updateParams({ year: e.target.value || null }, true)}
              >
                <option value="">Todos os anos</option>
                {availableYears.map((y) => (
                  <option key={y.year} value={String(y.year)}>
                    {y.year} ({y.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label !text-xs" htmlFor="f-area">
                Área do ENEM
              </label>
              <select
                id="f-area"
                className="input !py-1.5"
                value={area}
                onChange={(e) =>
                  updateParams({ area: e.target.value || null, skill: null }, true)
                }
              >
                <option value="">Todas as áreas</option>
                {AREA_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label !text-xs" htmlFor="f-lang">
                Língua estrangeira
              </label>
              <select
                id="f-lang"
                className="input !py-1.5"
                value={language}
                onChange={(e) => updateParams({ lang: e.target.value || null }, true)}
              >
                <option value="">Todas</option>
                <option value="ingles">Inglês</option>
                <option value="espanhol">Espanhol</option>
              </select>
            </div>

            <div>
              <label className="label !text-xs" htmlFor="f-skill">
                Habilidade (H1–H30)
              </label>
              <select
                id="f-skill"
                className="input !py-1.5 disabled:opacity-60"
                disabled={withSkillCount === 0}
                value={skillId}
                onChange={(e) => updateParams({ skill: e.target.value || null }, true)}
              >
                <option value="">
                  {withSkillCount === 0 ? 'Requer Microdados INEP' : 'Todas'}
                </option>
                {filteredSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.description.slice(0, 52)}…
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label !text-xs" htmlFor="f-tri">
                Dificuldade (TRI)
              </label>
              <select
                id="f-tri"
                className="input !py-1.5 disabled:opacity-60"
                disabled={withTriCount === 0}
                value={difficultyBand}
                onChange={(e) => updateParams({ tri: e.target.value || null }, true)}
              >
                <option value="">
                  {withTriCount === 0 ? 'Requer Microdados INEP' : 'Todas'}
                </option>
                <option value="facil">Fácil (b &lt; -0,5)</option>
                <option value="media">Média (-0,5 a 1,0)</option>
                <option value="dificil">Difícil (b &gt; 1,0)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        {gateError ? (
          <div className="card space-y-3 border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <Lock size={16} aria-hidden />
              {gateError.status === 402
                ? 'Assinatura NEXO ativa necessária'
                : gateError.status === 401
                  ? 'Autenticação necessária'
                  : 'Não foi possível carregar o catálogo'}
            </div>
            <p className="text-sm text-ink-700 dark:text-ink-300">{gateError.message}</p>
            <div className="flex flex-wrap gap-2">
              {import.meta.env.DEV && (gateError.status === 401 || gateError.status === 402) && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={activating}
                  onClick={activateDevSession}
                >
                  {activating ? 'Ativando…' : 'Ativar sessão + assinatura local (dev)'}
                </button>
              )}
              <button type="button" className="btn-ghost btn-sm" onClick={loadQuestions}>
                <RefreshCw size={14} aria-hidden /> Tentar novamente
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="card py-12 text-center text-sm text-ink-500">
            Carregando questões oficiais do ENEM…
          </div>
        ) : items.length === 0 ? (
          <Empty
            title="Nenhuma questão encontrada"
            text={
              activeFilters > 0
                ? 'Nenhuma questão oficial corresponde aos filtros selecionados.'
                : 'O banco local ainda está vazio. Execute `npm run ingest:enem` para importar todas as provas oficiais do ENEM.'
            }
            action={
              activeFilters > 0 ? (
                <button type="button" className="btn-ghost" onClick={clearFilters}>
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul aria-label="Lista de questões do ENEM">
              {items.map((q) => {
                const attempt = lastAttemptByQid.get(q.id);
                const preview =
                  stripMarkdownImages(q.contextMd) ||
                  q.alternativesIntro ||
                  `Questão ${q.questionIndex} do ENEM ${q.year}`;
                const tri = triLabel(q.triB);

                return (
                  <li key={q.id}>
                    <Link
                      to={`/questoes/${encodeURIComponent(q.id)}`}
                      state={{ from: returnTo }}
                      className="row group"
                    >
                      <span
                        className={cx(
                          'h-2 w-2 shrink-0 rounded-full',
                          !attempt
                            ? 'bg-ink-200 dark:bg-ink-700'
                            : attempt.correct
                              ? 'bg-emerald-500'
                              : 'bg-red-400',
                        )}
                        title={!attempt ? 'Inédita' : attempt.correct ? 'Acertou' : 'Errou'}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-900 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
                          {preview}
                        </span>
                        <span className="muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="font-mono">
                            ENEM {q.year} · Q{q.questionIndex}
                          </span>
                          <span>· {AREA_SHORT[q.area]}</span>
                          {q.language && (
                            <span className="capitalize">
                              · {q.language === 'ingles' ? 'Inglês' : 'Espanhol'}
                            </span>
                          )}
                          {q.skillId && <span>· {q.skillId}</span>}
                          {tri && <span>· {tri}</span>}
                        </span>
                      </span>

                      {q.hasImages && (
                        <Badge title="Esta questão contém imagem no enunciado ou nas alternativas">
                          <ImageIcon size={12} aria-hidden />
                          <span className="hidden sm:inline">Com imagem</span>
                        </Badge>
                      )}

                      <ChevronRight size={16} className="shrink-0 text-ink-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={goToPage}
                disabled={loading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
