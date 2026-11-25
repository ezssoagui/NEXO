import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getQuestion, useStore } from '../store/useStore';
import { QuestionForm, AnsweredQuestion } from '../components/QuestionPlayer';
import Correction from '../components/Correction';
import { usesCpe, usesErrorForm } from '../engine/correctionRules';
import { Badge, Empty, Metric, PageHeader, Progress, cx } from '../components/ui';
import { skillName } from '../engine/domain';
import { disciplineOf } from '../data/curriculum';
import type { Activity, Attempt } from '../types';

/** Bateria, simulado ou diagnóstico: resolução independente até o fim; depois, sessão de correção. */
export default function Atividade() {
  const { id = '' } = useParams(); const act = useStore((s) => s.activities.find((a) => a.id === id));
  if (!act) return <Empty title="Atividade não encontrada" action={<Link className="btn-primary" to="/questoes">Ver questões</Link>} />;
  return act.status === 'concluida' ? <Results act={act} /> : <Runner act={act} />;
}

function Runner({ act }: { act: Activity }) {
  const nav = useNavigate(); const { answerActivity, moveActivity, pauseActivity, resumeActivity, finishActivity, deferQuestion, discardActivity } = useStore.getState();
  const [confirm, setConfirm] = useState(false); const paused = act.status === 'pausada'; const limit = act.limitSec; const [now, setNow] = useState(Date.now());
  // Relógio real: sair da página não pausa o simulado.
  const left = limit ? Math.max(0, limit - Math.floor((now - act.startedAt) / 1000)) : null;
  useEffect(() => { if (paused || !limit) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [paused, limit]);
  useEffect(() => { if (left === 0) finishActivity(act.id); }, [left, act.id, finishActivity]);
  const q = getQuestion(act.qids[act.idx]); const answered = Object.keys(act.answers).length; const total = act.qids.length; const canPause = act.kind !== 'simulado';
  if (paused) return <div className="mx-auto max-w-xl"><Empty title={`${act.title} em pausa`} text={`${answered} de ${total} respondidas. Retome quando quiser.`} action={<><button className="btn-primary" onClick={() => resumeActivity(act.id)}>Retomar</button><button className="btn-ghost" onClick={() => { finishActivity(act.id); }} disabled={!answered}>Concluir e corrigir</button></>} /></div>;
  if (!q) return null;
  const next = () => { const i = act.qids.findIndex((x, k) => k > act.idx && !useStore.getState().activities.find((a) => a.id === act.id)!.answers[x]); if (i >= 0) moveActivity(act.id, i); else if (act.idx + 1 < total) moveActivity(act.id, act.idx + 1); else setConfirm(true); };
  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-10 -mx-4 mb-6 bg-white/95 px-4 py-3 backdrop-blur dark:bg-ink-950/95">
        <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-medium">{act.title}</span><span className="muted">{act.idx + 1} de {total}</span>{left !== null && <span className={cx('ml-auto font-mono text-sm', left < 120 && 'text-red-600')} aria-label="Tempo restante">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}<span className={cx('flex gap-1', left === null && 'ml-auto')}>{canPause && <button className="btn-quiet text-xs" onClick={() => { pauseActivity(act.id); nav(act.kind === 'diagnostico' ? '/diagnostico' : '/questoes'); }}>Pausar</button>}<button className="btn-quiet text-xs" onClick={() => setConfirm(true)}>Concluir</button></span></div>
        <Progress value={answered / total} className="mt-2" label="Progresso" />
      </div>
      {confirm ? <Empty title="Concluir e corrigir?" text={`${answered} de ${total} respondidas. Questões em branco não entram no seu perfil.`} action={<><button className="btn-primary" onClick={() => finishActivity(act.id)} disabled={!answered}>Concluir</button><button className="btn-ghost" onClick={() => setConfirm(false)}>Voltar</button><button className="btn-quiet text-xs" onClick={() => { discardActivity(act.id); nav('/questoes'); }}>Descartar</button></>} /> : <>
        <QuestionForm key={q.id} q={q} initial={act.answers[q.id]} submitLabel={act.answers[q.id] ? 'Atualizar resposta' : 'Confirmar'} onSubmit={(a) => { answerActivity(act.id, q.id, { chosen: a.chosen, confidence: a.confidence, timeSec: a.timeSec }); next(); }}
          extra={act.idx < total - 1 && !act.answers[q.id] ? <button className="btn-ghost" onClick={() => deferQuestion(act.id)}>Deixar para depois</button> : undefined} />
        <nav aria-label="Questões" className="mt-10 flex flex-wrap gap-1.5">{act.qids.map((x, i) => <button key={x} onClick={() => moveActivity(act.id, i)} aria-current={i === act.idx} className={cx('h-7 w-7 rounded text-xs', i === act.idx ? 'bg-brand-600 text-white' : act.answers[x] ? 'bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-100' : 'border border-ink-200 text-ink-500 dark:border-ink-700')}>{i + 1}</button>)}</nav>
      </>}
    </div>
  );
}

function Results({ act }: { act: Activity }) {
  const attempts = useStore((s) => s.attempts); const mine = (act.attemptIds ?? []).map((i) => attempts.find((a) => a.id === i)).filter(Boolean) as Attempt[];
  const [open, setOpen] = useState<string | null>(null);
  const right = mine.filter((a) => a.correct).length; const easyMiss = mine.filter((a) => !a.correct && getQuestion(a.qid)?.difficulty === 'Fácil').length;
  const RANK = { 'Fácil': 0, 'Média': 1, 'Difícil': 2 } as const;
  // Correção: erros primeiro, dos fáceis aos difíceis (os fáceis pesam mais na coerência de provas com TRI).
  const order = [...mine].sort((a, b) => Number(a.correct) - Number(b.correct) || RANK[getQuestion(a.qid)!.difficulty] - RANK[getQuestion(b.qid)!.difficulty]);
  const by = [...new Set(mine.map((a) => disciplineOf(a.skillId)))].map((d) => { const xs = mine.filter((a) => disciplineOf(a.skillId) === d); return { d, n: xs.length, ok: xs.filter((a) => a.correct).length }; });
  const weak = [...new Set(mine.filter((a) => !a.correct).map((a) => a.skillId))];
  const todo = order.filter((a) => !a.correct && !a.corrected && (usesCpe(getQuestion(a.qid)!, a.correct) || usesErrorForm(getQuestion(a.qid)!, a.correct))).length;
  const cur = mine.find((a) => a.id === open); const curQ = cur && getQuestion(cur.qid); const idx = cur ? order.findIndex((a) => a.id === cur.id) : -1; const nextA = order.slice(idx + 1).find((a) => !a.correct);
  if (cur && curQ) return <div className="mx-auto max-w-2xl"><button className="muted mb-5 text-sm hover:underline" onClick={() => setOpen(null)}>← Resultado</button><AnsweredQuestion q={curQ} chosen={cur.chosen} hideKey={!cur.correct && !cur.corrected && usesCpe(curQ, cur.correct)} /><Correction key={cur.id} q={curQ} attempt={cur} onNext={() => setOpen(nextA?.id ?? null)} nextLabel={nextA ? 'Próximo erro' : 'Voltar ao resultado'} /></div>;
  return (
    <div>
      <PageHeader title={act.title} subtitle={`Concluída em ${new Date(act.finishedAt!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}><Link className="btn-ghost" to="/inicio">Início</Link></PageHeader>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4"><Metric label="Acertos" value={`${right} de ${mine.length}`} /><Metric label="Aproveitamento" value={mine.length ? `${Math.round((right / mine.length) * 100)}%` : '—'} /><Metric label="Em branco" value={act.qids.length - mine.length} /><Metric label="Erros em fáceis" value={easyMiss} hint={easyMiss ? 'comece por eles' : undefined} /></div>
      {act.kind === 'diagnostico' && <section className="mt-8"><h2 className="section-title">Relatório individual</h2><p className="muted mt-1 text-sm">Conhecimentos e dificuldades observados nesta avaliação. Habilidades que não apareceram continuam como não avaliadas.</p>
        <div className="mt-4 grid gap-8 sm:grid-cols-2"><div><h3 className="text-sm font-medium">Por disciplina</h3><ul className="mt-2 space-y-2">{by.map((x) => <li key={x.d} className="text-sm"><div className="flex justify-between"><span>{x.d}</span><span className="muted">{x.ok}/{x.n}</span></div><Progress value={x.ok / x.n} className="mt-1" /></li>)}</ul></div>
          <div><h3 className="text-sm font-medium">A fortalecer</h3><ul className="mt-2 space-y-1 text-sm">{weak.map((s) => <li key={s}><Link className="link" to={`/conteudos/habilidade/${s}`}>{skillName(s)}</Link></li>)}{!weak.length && <li className="muted">Nenhum erro.</li>}</ul></div></div>
        <p className="mt-4 text-sm">Complemente com a <Link className="link" to="/redacao?diagnostica=1">redação diagnóstica</Link>, opcional e independente.</p></section>}
      <section className="mt-10"><div className="flex items-baseline justify-between"><h2 className="section-title">Correção</h2>{todo > 0 && <span className="muted text-xs">{todo} a corrigir</span>}</div>
        <ul className="mt-1">{order.map((a) => { const q = getQuestion(a.qid)!; return <li key={a.id}><button className="row w-full text-left" onClick={() => setOpen(a.id)}><span className={cx('h-2 w-2 shrink-0 rounded-full', a.correct ? 'bg-emerald-500' : 'bg-red-400')} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{q.statement}</span><span className="muted text-xs">{disciplineOf(q.skillId)} · {skillName(q.skillId)} · {q.difficulty}</span></span>{!a.correct && <Badge tone={a.corrected ? 'slate' : 'amber'}>{a.corrected ? 'corrigida' : 'corrigir'}</Badge>}</button></li>; })}</ul></section>
    </div>
  );
}
