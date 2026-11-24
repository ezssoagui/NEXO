import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, RefreshCcw, HeartHandshake } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PageHeader, Card, Badge, Tabs, cx } from '../components/ui';
import { recoveryPlan, weakSkills, weekPlan } from '../engine/recommend';
import { exerciseLoad, incidenceNote, PHASE_INFO, STUDY_LEVELS, studyLevel, studyPhase } from '../engine/strategy';
import { LESSONS } from '../data/lessons';
import { QUESTIONS } from '../data/questions';
import { skillById } from '../data/skills';
import { skillMastery, MASTERY_LABEL } from '../engine/mastery';

export default function Trilha() {
  const { profile, attempts, cardStates } = useStore();
  const [tab, setTab] = useState<'trilha' | 'semana' | 'recuperacao'>('trilha');
  const weak = weakSkills(attempts, profile);
  const focus = [...weak, ...LESSONS.flatMap((l) => l.skillIds)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
  const [days, setDays] = useState(7); const [mins, setMins] = useState(30);
  const ph = studyPhase(profile);
  const rec = recoveryPlan(days, mins, attempts, cardStates, profile);
  return (
    <div>
      <PageHeader title="Minha trilha" subtitle={`Plano adaptativo para ${profile?.goal === 'Combinada' ? 'ENEM + vestibular' : profile?.goal} · ${profile?.course} · prova em ${profile?.examYear}`} />
      <Card className="mb-5 !p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone="mint">{PHASE_INFO[ph.phase].label}</Badge>{ph.daysLeft !== null && ph.daysLeft >= 0 && <span className="muted text-xs">cerca de {ph.daysLeft} dias para a prova (data estimada; confira o edital)</span>}</div><p className="mt-1 text-sm">{PHASE_INFO[ph.phase].tip}</p></Card>
      <Tabs tabs={[{ id: 'trilha', label: 'Trilha adaptativa' }, { id: 'semana', label: 'Plano da semana' }, { id: 'recuperacao', label: 'Plano de recuperação' }]} value={tab} onChange={setTab} />
      {tab === 'trilha' && <div className="space-y-4">{focus.map((sk) => {
        const l = LESSONS.find((x) => x.skillIds.includes(sk)); const qs = QUESTIONS.filter((q) => q.skillId === sk);
        const at = attempts.filter((a) => a.skillId === sk); const st = skillMastery(attempts, sk);
        const steps = [
          { t: 'Explicação inicial acessível', done: at.length > 0, to: l ? `/aulas/${l.id}` : undefined },
          { t: 'Exemplo resolvido', done: at.length > 0, to: l ? `/aulas/${l.id}` : undefined },
          { t: 'Reconhecimento de padrões', done: at.length > 0, to: l ? `/aulas/${l.id}` : undefined },
          { t: 'Aplicação guiada (perguntas da aula)', done: at.length > 0, to: l ? `/aulas/${l.id}` : undefined },
          { t: 'Questão individual', done: at.length > 0, to: qs[0] ? `/questoes/${qs[0].id}` : undefined },
          { t: 'Correção argumentada', done: at.length > 0, to: qs[0] ? `/questoes/${qs[0].id}` : undefined },
          { t: 'Transferência (questão gêmea)', done: at.some((a) => (a.isTwin || a.isNovel) && a.correct), to: qs[0] ? `/questoes/${qs[0].id}?gemea=1` : undefined },
          { t: 'Revisão posterior (outro dia)', done: st.state === 'consistente', to: '/flashcards' },
        ];
        return <Card key={sk}><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="font-bold">{skillById(sk)?.name}</h2><Badge>{skillById(sk)?.subject}</Badge><Badge tone={st.state === 'consistente' ? 'mint' : st.state === 'provisorio' ? 'sky' : st.state === 'desenvolvimento' ? 'amber' : 'slate'}>{MASTERY_LABEL[st.state]}</Badge>{weak.includes(sk) && <Badge tone="red">prioridade</Badge>}</div>
          {(() => { const ld = exerciseLoad(sk, attempts); const lv = studyLevel(sk, attempts); const note = profile?.goal === 'Olimpíadas' ? null : incidenceNote(sk); return <p className="muted mb-3 text-xs">Nível {lv + 1}/5: {STUDY_LEVELS[lv]} · {ld.max ? `exercícios: ${ld.done} (dose ${ld.min}–${ld.max})` : 'só leitura e revisão'} · {ld.note}{note && <><br />{note}</>}</p>; })()}
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{steps.map((s, i) => <li key={s.t}>{s.to ? <Link to={s.to} className={cx('flex items-start gap-2 rounded-xl border p-2.5 text-xs transition hover:border-mint-400', s.done ? 'border-mint-300 bg-mint-50 dark:border-mint-500/30 dark:bg-mint-500/10' : 'border-slate-200 dark:border-navy-700')}>{s.done ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-mint-600" /> : <Circle size={14} className="mt-0.5 shrink-0 text-slate-400" />}<span><strong>{i + 1}.</strong> {s.t}</span></Link> : <span className="flex gap-2 rounded-xl border border-dashed p-2.5 text-xs opacity-60">{i + 1}. {s.t}</span>}</li>)}</ol>
        </Card>;
      })}</div>}
      {tab === 'semana' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{weekPlan(profile, attempts).map((d) => <Card key={d.day} className="!p-4"><div className="flex justify-between font-semibold"><span>{d.day}</span><span className="muted text-xs">{d.minutes ? `${d.minutes} min` : 'livre'}</span></div><ul className="muted mt-2 list-disc space-y-1 pl-4 text-xs">{d.tasks.map((t) => <li key={t}>{t}</li>)}</ul></Card>)}</div>}
      {tab === 'recuperacao' && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit"><div className="flex items-center gap-2 font-semibold"><HeartHandshake size={18} className="text-mint-600" /> Vamos recomeçar</div>
            <label className="label mt-4" htmlFor="days">Há quantos dias você está sem estudar? <strong>{days}</strong></label><input id="days" type="range" min={0} max={60} value={days} onChange={(e) => setDays(+e.target.value)} className="w-full accent-mint-500" />
            <label className="label mt-3" htmlFor="mins">Quanto tempo por dia você tem agora? <strong>{mins} min</strong></label><input id="mins" type="range" min={5} max={120} step={5} value={mins} onChange={(e) => setMins(+e.target.value)} className="w-full accent-mint-500" />
            <p className="muted mt-3 text-xs">Sem punições, sem perda de nível. Seu histórico continua salvo.</p></Card>
          <Card><p className="mb-4 rounded-xl bg-mint-50 p-3 text-sm dark:bg-mint-500/10">{rec.msg}</p><div className="grid gap-2 sm:grid-cols-2">{rec.plan.map((d) => <div key={d.day} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-navy-700"><div className="flex justify-between font-semibold"><span>Dia {d.day}</span><span className="muted text-xs">{d.minutes} min</span></div><ul className="muted mt-1 list-disc pl-4 text-xs">{d.tasks.map((t) => <li key={t}>{t}</li>)}</ul></div>)}</div><Link to="/sessao?min=10" className="btn-primary mt-4"><RefreshCcw size={16} /> Começar o dia 1</Link></Card>
        </div>
      )}
    </div>
  );
}
