import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowRight, RotateCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { buildSession } from '../engine/recommend';
import { lessonById } from '../data/lessons';
import { questionById } from '../data/questions';
import { FLASHCARDS } from '../data/flashcards';
import { skillById } from '../data/skills';
import { selectTwin, isNone } from '../engine/twins';
import QuestionPlayer from '../components/QuestionPlayer';
import { PageHeader, Card, Progress, Badge, Rich, cx } from '../components/ui';
import { evaluateParagraph } from '../engine/essay';

export default function Sessao() {
  const [sp] = useSearchParams(); const min = (+(sp.get('min') ?? 10) || 10) as 5 | 10 | 20 | 40;
  const { attempts, profile, cardStates, rateCard, addGenerated, addXP, notify } = useStore();
  const session = useMemo(() => buildSession(min, attempts, profile), []); // eslint-disable-line
  const [i, setI] = useState(0); const [answered, setAnswered] = useState(false);
  const [recall, setRecall] = useState(''); const [showRecall, setShowRecall] = useState(false);
  const [flip, setFlip] = useState(false); const [cardIdx, setCardIdx] = useState(0);
  const [para, setPara] = useState({ topico: '', repertorio: '', articulacao: '', consequencia: '' });
  const twin = useMemo(() => { const st = session.steps.find((s) => s.kind === 'gemea'); if (!st) return null; const t = selectTwin(questionById(st.ref!)!, 1, attempts); if (isNone(t)) return null; if (t.kind === 'gerada') addGenerated({ q: t.q, validation: [{ check: 'Validação automática', ok: true, detail: 'Aprovada.' }], status: 'aprovada', request: 'Sessão', ts: Date.now() }); return t; }, []); // eslint-disable-line
  const step = session.steps[i];
  const cards = useMemo(() => { const sk = session.focus; const due = FLASHCARDS.filter((c) => cardStates[c.id] && cardStates[c.id].due <= Date.now()); const rel = FLASHCARDS.filter((c) => c.skillId === sk); return [...rel, ...due].filter((v, k, a) => a.indexOf(v) === k); }, []); // eslint-disable-line
  const next = () => { setAnswered(false); setFlip(false); setCardIdx(0); if (i + 1 >= session.steps.length) addXP(10 + min, `Sessão de ${min} minutos concluída`, `sess-${new Date().toDateString()}-${min}`); setI(i + 1); };

  if (!step) return (
    <Card className="mx-auto max-w-xl text-center"><CheckCircle2 className="mx-auto text-mint-600" size={40} /><h1 className="mt-3 text-2xl font-bold">Sessão concluída!</h1><p className="muted mt-1">Foco de hoje: {skillById(session.focus)?.name}. Seu Radar de Domínio e o calendário de revisões foram atualizados.</p><div className="mt-5 flex justify-center gap-2"><Link to="/inicio" className="btn-primary">Voltar ao início</Link><Link to="/desempenho" className="btn-ghost">Ver desempenho</Link></div></Card>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={min === 5 ? 'Meu Professor de 5 Minutos' : `Sessão de ${min} minutos`} subtitle={`Foco escolhido pela NEXO: ${skillById(session.focus)?.name}`} />
      <div className="mb-5 flex flex-wrap gap-2">{session.steps.map((s, k) => <span key={k} className={cx('chip', k < i ? 'bg-mint-100 text-mint-800 dark:bg-mint-500/15 dark:text-mint-300' : k === i ? 'bg-navy-800 text-white' : 'bg-slate-100 text-slate-500 dark:bg-navy-800')}>{k + 1}. {s.title} · {s.minutes}′</span>)}</div>
      <Progress value={i / session.steps.length} className="mb-5" />
      {step.kind === 'recordacao' && <Card><Badge tone="mint">{step.title}</Badge><h2 className="mt-2 text-xl font-bold">{skillById(session.focus)?.name}</h2><p className="muted mt-1 text-sm">Escreva, sem consultar nada, tudo o que lembra: conceitos, fórmulas, um exemplo. Depois compare e complete o que faltou.</p><textarea aria-label="O que você lembra" className="input mt-3" rows={5} value={recall} onChange={(e) => setRecall(e.target.value)} />{showRecall && (step.ref ? <Rich className="mt-3 rounded-xl bg-mint-50 p-3 text-sm dark:bg-mint-500/10" text={lessonById(step.ref)!.micro} /> : <p className="muted mt-3 text-sm">Sem microaula para este assunto: confira com a explicação das próximas questões.</p>)}<div className="mt-4 flex gap-2">{!showRecall && <button className="btn-ghost" onClick={() => setShowRecall(true)}>Comparar</button>}<button className="btn-primary" onClick={next}>Continuar <ArrowRight size={16} /></button></div></Card>}
      {step.kind === 'explicacao' && (() => { const l = lessonById(step.ref!)!; return <Card><Badge tone="mint">{step.title}</Badge><h2 className="mt-2 text-xl font-bold">{l.title}</h2><Rich className="mt-2" text={l.micro} />{min >= 20 && l.explanation.slice(0, min === 40 ? 4 : 2).map((p) => <p key={p} className="my-2 text-sm leading-relaxed">{p}</p>)}<div className="mt-3 grid gap-2 sm:grid-cols-3">{l.visual.map((v) => <div key={v.label} className="rounded-xl bg-navy-50 p-3 text-center text-sm dark:bg-navy-800"><div className="muted text-xs">{v.label}</div><div className="font-bold">{v.value}</div></div>)}</div><div className="mt-4 flex gap-2"><button className="btn-primary" onClick={next}>Entendi, próxima etapa <ArrowRight size={16} /></button>{min === 40 && <Link to={`/aulas/${l.id}`} className="btn-ghost">Abrir aula completa</Link>}</div></Card>; })()}
      {(step.kind === 'questao' || step.kind === 'gemea') && (() => { const q = step.kind === 'gemea' ? twin?.q : questionById(step.ref!); if (!q) return <button className="btn-primary" onClick={next}>Pular</button>; return <><QuestionPlayer key={q.id + i} q={q} mode="tutoria" isTwin={step.kind === 'gemea'} onDone={() => next()} />{!answered && <button className="muted mt-2 text-xs underline" onClick={next}>Pular etapa</button>}</>; })()}
      {step.kind === 'flashcards' && (() => { const c = cards[cardIdx]; const total = Math.min(step.count ?? 1, cards.length); if (!c || cardIdx >= total) return <Card className="text-center"><p>Revisão concluída.</p><button className="btn-primary mt-3" onClick={next}>Continuar</button></Card>; return <Card className="text-center !p-8"><Badge>{cardIdx + 1}/{total}</Badge><p className="mt-4 text-lg font-bold">{c.front}</p>{flip ? <><p className="mt-4">{c.back}</p><div className="mt-6 grid grid-cols-3 gap-2">{(['errei', 'duvida', 'seguro'] as const).map((r) => <button key={r} className="btn-ghost" onClick={() => { notify(rateCard(c.id, r)); setFlip(false); setCardIdx(cardIdx + 1); }}>{({ errei: 'Não sei', duvida: 'Quase sei', seguro: 'Sei' } as const)[r]}</button>)}</div></> : <button className="btn-primary mt-6" onClick={() => setFlip(true)}><RotateCw size={16} /> Mostrar resposta</button>}</Card>; })()}
      {step.kind === 'paragrafo' && <Card><h2 className="font-bold">Laboratório C3 · um parágrafo</h2><p className="muted text-sm">Tema livre entre os temas de redação. Siga a estrutura.</p>{(['topico', 'repertorio', 'articulacao', 'consequencia'] as const).map((k) => <textarea key={k} aria-label={k} className="input mt-2" rows={2} placeholder={{ topico: 'Tópico frasal', repertorio: 'Repertório', articulacao: 'Articulação argumentativa', consequencia: 'Consequência' }[k]} value={para[k]} onChange={(e) => setPara({ ...para, [k]: e.target.value })} />)}<button className="btn-primary mt-3" onClick={() => { const fb = evaluateParagraph(para); notify(`${fb.filter((f) => f.ok).length}/4 partes bem construídas.`); next(); }}>Analisar e concluir</button></Card>}
    </div>
  );
}
