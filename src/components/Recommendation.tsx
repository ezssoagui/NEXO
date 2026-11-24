import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { SessionPlan } from '../types';
import { useStore } from '../store/useStore';
import { useRecommendations } from '../store/selectors';
import { alternativeTo, TYPE_LABEL } from '../engine/recommender';
import { cx } from './ui';

const MAX = 4;
/** Cartão principal: o que estudar, por quê, a sessão preparada e as escolhas do estudante. */
export function RecommendationCard({ plan, main, onReplace }: { plan: SessionPlan; main?: boolean; onReplace?: () => void }) {
  const nav = useNavigate(); const start = useStore((s) => s.startSession); const setPending = useStore((s) => s.setPending); const notify = useStore((s) => s.notify);
  const running = useStore((s) => s.sessions.find((x) => x.key === plan.key && x.status === 'andamento'));
  const [why, setWhy] = useState(false); const steps = plan.steps.filter((s) => s.kind !== 'consolidacao');
  const defer = (status: 'adiada' | 'ignorada', days: number, msg: string) => { setPending(plan, status, days); notify(msg); };
  return (
    <section aria-label="Recomendação personalizada" className={cx('rounded-xl border', main ? 'border-ink-200 p-6 dark:border-ink-800 sm:p-8' : 'border-ink-200 p-5 dark:border-ink-800')}>
      <p className="text-xs font-medium text-brand-700 dark:text-brand-300">{TYPE_LABEL[plan.type]} · cerca de {plan.minutes} min</p>
      <h2 className={cx('mt-2 font-semibold leading-snug', main ? 'text-xl sm:text-2xl' : 'text-base')}>{plan.question}</h2>
      <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">{plan.reason}</p>
      {main && <div className="mt-5"><p className="text-sm font-medium">Sessão preparada</p><ol className="mt-2 space-y-1 text-sm text-ink-600 dark:text-ink-300">{steps.slice(0, MAX + 1).map((s, i) => <li key={i} className="flex gap-2"><span className="w-4 text-ink-400">{i + 1}</span>{s.title}</li>)}{steps.length > MAX + 1 && <li className="muted pl-6">e mais {steps.length - MAX - 1}</li>}</ol></div>}
      <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2">
        <button className={cx(main ? 'btn-primary mr-2' : 'btn-ghost mr-2')} onClick={() => nav(`/sessao/${start(plan)}`)}>{running ? 'Continuar sessão' : 'Iniciar sessão'} <ArrowRight size={16} /></button>
        <button className="btn-quiet text-xs" onClick={() => defer('adiada', 1, 'Adiada para amanhã. Fica em Pendências, no seu percurso.')}>Adiar</button>
        {onReplace && <button className="btn-quiet text-xs" onClick={onReplace}>Substituir</button>}
        <button className="btn-quiet text-xs" onClick={() => defer('ignorada', 7, 'Ignorada por 7 dias. A pendência continua registrada.')}>Ignorar</button>
        <button className="btn-quiet text-xs" aria-expanded={why} onClick={() => setWhy(!why)}>Como foi decidido</button>
      </div>
      {why && <ul className="muted mt-3 list-disc space-y-1 pl-5 text-xs">{plan.audit.map((a) => <li key={a}>{a}</li>)}</ul>}
    </section>
  );
}
/** Recomendação principal com substituição (a anterior vira pendência). */
export function MainRecommendation() {
  const all = useRecommendations(12); const setPending = useStore((s) => s.setPending); const notify = useStore((s) => s.notify);
  const plan = all.find((p) => p.type !== 'redacao');
  if (!plan) return null;
  const alt = alternativeTo(plan.key, all);
  return <RecommendationCard key={plan.key} plan={plan} main onReplace={alt ? () => { setPending(plan, 'substituida', 1); notify('Trocamos a recomendação. A anterior ficou em Pendências.'); } : undefined} />;
}
