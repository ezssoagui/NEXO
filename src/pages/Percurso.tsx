import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useRecommendations } from '../store/selectors';
import { RecommendationCard, MainRecommendation } from '../components/Recommendation';
import { TYPE_LABEL } from '../engine/recommender';
import { PHASE_INFO, studyPhase } from '../engine/strategy';
import { Badge, PageHeader, Tabs } from '../components/ui';
import type { SessionType } from '../types';

type Tab = 'agora' | 'pendencias' | 'historico';
const GROUPS: SessionType[] = ['recuperacao', 'revisao', 'comprovacao', 'aprofundamento', 'aprendizagem', 'redacao'];

/** Percurso individual: sugestões por necessidade, pendências e sessões realizadas. Nada é obrigatório. */
export default function Percurso() {
  const [tab, setTab] = useState<Tab>('agora'); const [type, setType] = useState<SessionType | ''>(''); const nav = useNavigate();
  const profile = useStore((s) => s.profile)!; const pendings = useStore((s) => s.pendings); const clear = useStore((s) => s.clearPending); const sessions = useStore((s) => s.sessions);
  const recs = useRecommendations(40); const ph = studyPhase(profile); const list = recs.slice(1).filter((r) => !type || r.type === type);
  const shown = type ? recs.filter((r) => r.type === type).slice(0, 12) : list.slice(0, 5);
  return (
    <div>
      <PageHeader title="Meu percurso" subtitle={`${PHASE_INFO[ph.phase].label}. ${PHASE_INFO[ph.phase].tip}${ph.daysLeft !== null && ph.daysLeft >= 0 ? ` Cerca de ${ph.daysLeft} dias para a prova (data estimada; confira o edital).` : ''}`} />
      <Tabs tabs={[{ id: 'agora', label: 'Recomendações' }, { id: 'pendencias', label: `Pendências${pendings.length ? ` (${pendings.length})` : ''}` }, { id: 'historico', label: 'Sessões' }]} value={tab} onChange={setTab} />
      {tab === 'agora' && <div className="space-y-6">
        {!type && <MainRecommendation />}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">{GROUPS.map((g) => { const n = recs.filter((r) => r.type === g).length; return n ? <button key={g} aria-pressed={type === g} onClick={() => setType(type === g ? '' : g)} className={`rounded-full border px-3 py-1 text-xs ${type === g ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300'}`}>{TYPE_LABEL[g]} · {n}</button> : null; })}</div>
        <div className="grid gap-4 md:grid-cols-2">{shown.map((p) => <RecommendationCard key={p.key} plan={p} />)}</div>
        <p className="muted text-sm">Prefere outro caminho? <Link className="link" to="/conteudos">Explore o currículo</Link>, <Link className="link" to="/questoes">resolva questões</Link> ou faça a <Link className="link" to="/diagnostico">avaliação diagnóstica opcional</Link>.</p>
      </div>}
      {tab === 'pendencias' && (pendings.length ? <ul>{pendings.map((p) => <li key={p.key} className="row flex-wrap"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.title} <span className="muted font-normal">· {TYPE_LABEL[p.type]}</span></p><p className="muted text-xs">{p.reason}</p></div><Badge tone={p.status === 'ignorada' ? 'slate' : 'amber'}>{p.status}{p.until > Date.now() ? ` até ${new Date(p.until).toLocaleDateString('pt-BR')}` : ' · de volta às recomendações'}</Badge><button className="link text-xs" onClick={() => clear(p.key)}>Retomar agora</button></li>)}</ul> : <p className="muted text-sm">Nenhuma pendência. O que você adiar, substituir ou ignorar fica registrado aqui.</p>)}
      {tab === 'historico' && (sessions.length ? <ul>{[...sessions].reverse().map((s) => <li key={s.id} className="row"><div className="flex-1"><p className="text-sm font-medium">{s.title} <span className="muted font-normal">· {TYPE_LABEL[s.type]}</span></p><p className="muted text-xs">{new Date(s.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {s.log.filter((l) => l.outcome !== 'pulada').length} de {s.steps.length} etapas</p></div>{s.status === 'andamento' ? <button className="link text-xs" onClick={() => nav(`/sessao/${s.id}`)}>Continuar</button> : <span className="muted text-xs">{s.status === 'concluida' ? 'Concluída' : 'Encerrada'}</span>}</li>)}</ul> : <p className="muted text-sm">Nenhuma sessão ainda.</p>)}
    </div>
  );
}
