import { useMemo, useState } from 'react';
import { RotateCw, CalendarDays, Brain, Sparkles, Info, Timer } from 'lucide-react';
import { FLASHCARDS } from '../data/flashcards';
import { LESSONS } from '../data/lessons';
import { SUBJECTS, skillById } from '../data/skills';
import { useStore } from '../store/useStore';
import { isDue, retention, BOX_INTERVALS, RATING_LABEL, getSrsConfig } from '../engine/srs';
import { recommendForSkill, NEXT_LABEL } from '../engine/learning';
import { SKILLS } from '../data/skills';
import { PageHeader, Tabs, Card, Badge, DemoBadge, Empty, Progress, cx } from '../components/ui';
import { buildInterleaved, REVIEW_REASON, type ReviewItem } from '../engine/review';
import { skillMastery } from '../engine/mastery';
import { questionById } from '../data/questions';
import QuestionPlayer from '../components/QuestionPlayer';
import type { CardRating, Flashcard } from '../types';

type Deck = 'pendentes' | 'cinco' | 'erros' | 'questoes' | 'mistura' | 'prioritarios' | `sub:${string}` | `top:${string}`;
const DAY = 86400000;

export default function Flashcards() {
  const [tab, setTab] = useState<'intercalada' | 'revisar' | 'calendario' | 'mapa' | 'gerar'>('intercalada');
  return (
    <div>
      <PageHeader title="Revisão inteligente" subtitle="Repetição espaçada adaptativa e explicável: cada cartão e cada habilidade têm intervalo próprio, conforme seu desempenho, confiança, tempo decorrido e dificuldade do conteúdo." />
      <Tabs tabs={[{ id: 'intercalada', label: 'Sessão intercalada' }, { id: 'revisar', label: 'Baralhos' }, { id: 'calendario', label: 'Calendário e pendências' }, { id: 'mapa', label: 'Mapa de Revisão' }, { id: 'gerar', label: 'Gerar cartões' }]} value={tab} onChange={setTab} />
      {tab === 'intercalada' && <Interleaved />}
      {tab === 'revisar' && <Review />}
      {tab === 'calendario' && <Calendar />}
      {tab === 'mapa' && <ForgetMap onReview={() => setTab('revisar')} />}
      {tab === 'gerar' && <Generate />}
    </div>
  );
}

function useAllCards() { const custom = useStore((s) => s.customCards); return useMemo(() => [...FLASHCARDS, ...custom], [custom]); }

function Review() {
  const { cardStates, rateCard, attempts } = useStore();
  const all = useAllCards();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [flip, setFlip] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [free, setFree] = useState(false);
  const errSkills = new Set(attempts.filter((a) => !a.correct).map((a) => a.skillId));
  const dueFirst = (cs: Flashcard[]) => [...cs].sort((a, b) => (cardStates[a.id]?.due ?? 0) - (cardStates[b.id]?.due ?? 0));
  const decks: { id: Deck; label: string; desc: string; cards: () => Flashcard[] }[] = [
    { id: 'pendentes', label: 'Pendentes de hoje', desc: 'Cartões vencidos + até 5 novos', cards: () => [...dueFirst(all.filter((c) => cardStates[c.id] && isDue(cardStates[c.id]))), ...all.filter((c) => !cardStates[c.id]).slice(0, 5)] },
    { id: 'cinco', label: 'Revisão de 5 minutos', desc: '8 cartões mais urgentes', cards: () => dueFirst(all.filter((c) => isDue(cardStates[c.id]))).slice(0, 8) },
    { id: 'erros', label: 'Baralho automático dos erros', desc: 'Habilidades em que você errou questões', cards: () => all.filter((c) => errSkills.has(c.skillId)) },
    { id: 'questoes', label: 'Derivados das questões', desc: 'Cartões que você adicionou ao resolver', cards: () => all.filter((c) => c.origin === 'questao' || c.origin === 'ia_demo') },
    { id: 'mistura', label: 'Mistura de disciplinas', desc: 'Intercalado (interleaving)', cards: () => [...all].sort(() => Math.random() - 0.5).slice(0, 12) },
    { id: 'prioritarios', label: 'Prioritários antes do simulado', desc: 'Menor retenção prevista primeiro', cards: () => [...all.filter((c) => cardStates[c.id])].sort((a, b) => (retention(cardStates[a.id]) ?? 1) - (retention(cardStates[b.id]) ?? 1)).slice(0, 10) },
  ];
  const start = (id: Deck, cs: Flashcard[]) => { setDeck(id); setQueue(cs); setFlip(false); setWhy(null); setDone(0); };
  const rate = (r: CardRating) => { const c = queue[0]; const m = skillMastery(attempts, c.skillId); setWhy(rateCard(c.id, r, { free, difficulty: m.state === 'desenvolvimento' ? 0.6 : m.state === 'nao_estudado' ? 0.3 : 0 })); setFlip(false); setDone(done + 1); setQueue(r === 'errei' ? [...queue.slice(1), c] : queue.slice(1)); };

  if (!deck) return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{decks.map((d) => { const n = d.cards().length; return <button key={d.id} disabled={!n} onClick={() => start(d.id, d.cards())} className="card text-left transition hover:border-mint-400 disabled:opacity-50"><div className="flex items-center justify-between"><span className="font-semibold">{d.label}</span><Badge tone="mint">{n}</Badge></div><p className="muted mt-1 text-sm">{d.desc}</p></button>; })}</div>
      <Card><h2 className="section-title mb-3">Baralhos por disciplina e conteúdo</h2>
        <div className="flex flex-wrap gap-2">{SUBJECTS.map((s) => { const cs = all.filter((c) => c.subject === s); return <button key={s} className="btn-ghost btn-sm" onClick={() => start(`sub:${s}`, cs)}>{s} ({cs.length})</button>; })}</div>
        <div className="mt-3 flex flex-wrap gap-2">{[...new Set(all.map((c) => c.topic))].map((t) => { const cs = all.filter((c) => c.topic === t); return <button key={t} className="chip bg-slate-100 hover:bg-slate-200 dark:bg-navy-800" onClick={() => start(`top:${t}`, cs)}>{t} · {cs.length}</button>; })}</div>
      </Card>
    </div>
  );
  const c = queue[0];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><button className="btn-ghost btn-sm" onClick={() => setDeck(null)}>← Baralhos</button><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-mint-500" checked={free} onChange={(e) => setFree(e.target.checked)} /> Revisão livre (não altera a programação)</label><span className="muted text-sm">{done} revisados · {queue.length} restantes</span></div>
      {why && <div className="mb-3 flex gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-100"><Info size={16} className="mt-0.5 shrink-0" />{why}</div>}
      {c ? (
        <div className="card min-h-[280px] !p-8 text-center">
          <div className="flex justify-center gap-2"><Badge>{c.subject}</Badge><Badge>{c.topic}</Badge>{c.origin !== 'curado' && <Badge tone="violet">{c.origin === 'questao' ? 'Da questão' : 'Gerado (demo)'}</Badge>}<Badge tone="navy">Caixa {(cardStates[c.id]?.box ?? 0) + 1}</Badge></div>
          <p className="mt-6 font-display text-xl font-bold text-navy-900 dark:text-white">{c.front}</p>
          {flip ? <><div className="mx-auto my-5 h-px w-24 bg-slate-200 dark:bg-navy-700" /><p className="text-lg">{c.back}</p>
            <div className="mt-8 grid grid-cols-3 gap-2"><button className="btn bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-200" onClick={() => rate('errei')}>Não sei</button><button className="btn bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200" onClick={() => rate('duvida')}>Quase sei</button><button className="btn bg-mint-100 text-mint-800 hover:bg-mint-200 dark:bg-mint-500/15 dark:text-mint-200" onClick={() => rate('seguro')}>Sei</button></div></>
            : <button className="btn-primary mt-10" onClick={() => setFlip(true)}><RotateCw size={16} /> Mostrar resposta</button>}
        </div>
      ) : <Empty title="Sessão concluída!" text={`${done} cartões revisados. O calendário foi atualizado.`} action={<button className="btn-primary" onClick={() => setDeck(null)}>Voltar aos baralhos</button>} />}
    </div>
  );
}

function Calendar() {
  const { cardStates } = useStore(); const all = useAllCards();
  const days = Array.from({ length: 14 }, (_, i) => { const startD = new Date(); startD.setHours(0, 0, 0, 0); const s = startD.getTime() + i * DAY; const cs = all.filter((c) => cardStates[c.id] && (i === 0 ? cardStates[c.id].due < s + DAY : cardStates[c.id].due >= s && cardStates[c.id].due < s + DAY)); return { d: new Date(s), cs }; });
  const max = Math.max(1, ...days.map((d) => d.cs.length));
  const studied = all.filter((c) => cardStates[c.id]).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3"><Card className="!p-4"><div className="muted text-xs">Pendentes hoje</div><div className="font-display text-2xl font-bold">{days[0].cs.length}</div></Card><Card className="!p-4"><div className="muted text-xs">Cartões em estudo</div><div className="font-display text-2xl font-bold">{studied}</div></Card><Card className="!p-4"><div className="muted text-xs">Novos disponíveis</div><div className="font-display text-2xl font-bold">{all.length - studied}</div></Card></div>
      <Card><h2 className="section-title mb-4 flex items-center gap-2"><CalendarDays size={18} /> Próximos 14 dias</h2>
        <div className="flex h-40 items-end gap-1.5">{days.map(({ d, cs }, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><span className="text-[10px] font-semibold">{cs.length || ''}</span><div className={cx('w-full rounded-t-md', i === 0 ? 'bg-mint-500' : 'bg-navy-300 dark:bg-navy-600')} style={{ height: `${(cs.length / max) * 100}%`, minHeight: cs.length ? 4 : 1 }} title={`${cs.length} cartões`} /><span className="muted text-[10px]">{i === 0 ? 'hoje' : `${d.getDate()}/${d.getMonth() + 1}`}</span></div>)}</div>
      </Card>
      <Card><h2 className="section-title mb-2">Regras do agendamento (algoritmo configurável)</h2><ul className="list-disc space-y-1 pl-5 text-sm"><li><strong>Não sei:</strong> reaparece em ~{getSrsConfig().relearnMinutes} min e o cartão passa a aparecer com mais frequência.</li><li><strong>Quase sei:</strong> o intervalo cresce pouco (×{getSrsConfig().quaseSeiGrowth}).</li><li><strong>Sei:</strong> {getSrsConfig().firstIntervalSei} dia(s) na primeira vez; depois o intervalo é multiplicado pela facilidade do cartão (começa em {getSrsConfig().initialEase}), com bônus se a revisão estava atrasada.</li><li>Conteúdos ainda em desenvolvimento no seu Radar recebem intervalos menores.</li><li>Revisão livre fica no histórico, mas não muda as datas.</li></ul><p className="muted mt-2 text-xs">Parâmetros experimentais (inspirados no SM-2), ajustáveis pela administração. Não são regras científicas definitivas.</p></Card>
      <Card><h2 className="section-title mb-3">Pendências de hoje</h2>{days[0].cs.length ? <ul className="divide-y divide-slate-100 text-sm dark:divide-navy-800">{days[0].cs.map((c) => <li key={c.id} className="flex justify-between py-2"><span>{c.front}</span><Badge>{c.subject}</Badge></li>)}</ul> : <p className="muted text-sm">Nada pendente. 🎉</p>}</Card>
    </div>
  );
}

function ForgetMap({ onReview }: { onReview: () => void }) {
  const { cardStates, attempts, skillReviews } = useStore(); const all = useAllCards();
  const now = Date.now();
  const rows = SKILLS.map((sk) => {
    const rs = all.filter((c) => c.skillId === sk.id).map((c) => retention(cardStates[c.id], now)).filter((x): x is number => x !== null);
    const rec = recommendForSkill(sk.id, attempts, skillReviews, now);
    const due = skillReviews[sk.id] && skillReviews[sk.id].due <= now;
    const signals: string[] = [];
    if (due) signals.push('revisão vencida');
    if (rec.state === 'desenvolvimento' && attempts.some((a) => a.skillId === sk.id && !a.correct)) signals.push('erros recentes');
    if (rs.length && Math.min(...rs) < 0.6) signals.push('cartões com sinal de esquecimento');
    if (attempts.some((a) => a.skillId === sk.id && a.correct && (a.confidence === 'duvida' || a.confidence === 'chute'))) signals.push('acerto com baixa confiança');
    if (sk.examWeight === 'alta') signals.push('importante para o exame');
    return { sk, rec, due, signals, studied: attempts.some((a) => a.skillId === sk.id) || rs.length > 0 };
  }).filter((x) => x.studied && x.signals.some((s) => s !== 'importante para o exame')).sort((a, b) => b.rec.priority - a.rec.priority);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"><Brain size={14} className="mt-0.5 shrink-0" />O Mapa de Revisão indica habilidades que precisam ser revisitadas, com os <strong>motivos</strong> de cada uma. Sinais de esquecimento são <strong>estimativas</strong> a partir do seu desempenho e do tempo desde a última revisão — não medições exatas do conhecimento.</div>
      {rows.length === 0 ? <Empty title="Nenhuma habilidade precisa de revisão agora" text="O mapa aparece conforme você resolve questões e revisa cartões." /> : (
        <Card><ul className="divide-y divide-slate-100 dark:divide-navy-800">{rows.map((x) => <li key={x.sk.id} className="flex flex-wrap items-center gap-2 py-3"><span className="font-medium">{x.sk.name}</span><Badge tone={x.rec.action === 'revisao' ? 'amber' : x.rec.action === 'prerequisitos' ? 'red' : 'sky'}>{NEXT_LABEL[x.rec.action]}</Badge><span className="muted w-full text-xs">{x.signals.join(' · ')} — {x.rec.reason}</span></li>)}</ul></Card>
      )}
      <button onClick={onReview} className="btn-primary"><Timer size={16} /> Fazer sessão intercalada</button>
    </div>
  );
}

function Generate() {
  const { addCard, notify, consume } = useStore();
  const [lessonId, setLessonId] = useState(LESSONS[0].id); const [made, setMade] = useState<Flashcard[]>([]);
  const gen = () => {
    if (!consume('gen')) return notify('Limite de geração atingido (créditos simulados).');
    const l = LESSONS.find((x) => x.id === lessonId)!;
    const cards: Flashcard[] = [
      ...l.formulas.map((f, i) => ({ id: `ia-${l.id}-f${i}`, subject: l.subject, topic: l.title, skillId: l.skillIds[0], front: `Quando usar ${f.expr}?`, back: f.when, origin: 'ia_demo' as const })),
      ...l.mistakes.slice(0, 2).map((m, i) => ({ id: `ia-${l.id}-m${i}`, subject: l.subject, topic: l.title, skillId: l.skillIds[0], front: `Erro frequente em “${l.title}”: o que evitar?`, back: m, origin: 'ia_demo' as const })),
      ...l.visual.map((v, i) => ({ id: `ia-${l.id}-v${i}`, subject: l.subject, topic: l.title, skillId: l.skillIds[0], front: v.label, back: v.value, origin: 'ia_demo' as const })),
    ];
    setMade(cards);
  };
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2"><h2 className="section-title">Gerar cartões a partir de uma aula</h2><DemoBadge label="Extração por regras" /></div>
      <div className="flex flex-wrap gap-2"><select aria-label="Aula" className="input !w-auto" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>{LESSONS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select><button className="btn-primary" onClick={gen}><Sparkles size={16} /> Gerar</button></div>
      {made.length > 0 && <><ul className="mt-4 space-y-2">{made.map((c) => <li key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-navy-700"><div className="font-medium">{c.front}</div><div className="muted">{c.back}</div></li>)}</ul><button className="btn-dark mt-3" onClick={() => { made.forEach(addCard); notify(`${made.length} cartões adicionados ao baralho “Derivados”.`); setMade([]); }}>Adicionar todos ao meu baralho</button></>}
      <p className="muted mt-3 text-xs">Os cartões são extraídos de conteúdo curado (fórmulas, erros frequentes e resumo visual). Revise antes de estudar.</p>
    </Card>
  );
}

function Interleaved() {
  const { attempts, cardStates, skillReviews, customCards, rateCard } = useStore();
  const all = useMemo(() => [...FLASHCARDS, ...customCards], [customCards]);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [i, setI] = useState(0); const [flip, setFlip] = useState(false); const [why, setWhy] = useState<string | null>(null);
  const [free, setFree] = useState(false);
  const preview = useMemo(() => buildInterleaved({ attempts, cards: all, cardStates, skillReviews }, 8), [attempts, all, cardStates, skillReviews]);
  if (!items) return (
    <div className="space-y-4">
      <Card><h2 className="section-title">Sessão curta intercalada (~8 itens)</h2><p className="muted mt-1 text-sm">Mistura flashcards vencidos, questões inéditas e de recuperação das habilidades com revisão vencida, conteúdos dominados há tempo e erros recorrentes — alternando disciplinas.</p>
        <ul className="mt-3 space-y-1 text-sm">{preview.map((it, k) => <li key={k} className="flex items-center gap-2"><Badge tone={it.kind === 'card' ? 'mint' : 'sky'}>{it.kind === 'card' ? 'Flashcard' : 'Questão'}</Badge><span>{it.subject}</span><span className="muted text-xs">· {it.kind === 'card' ? it.reason : REVIEW_REASON[it.reason]}</span></li>)}</ul>
        {preview.length === 0 && <p className="muted mt-2 text-sm">Nada para revisar agora. Resolva algumas questões ou estude flashcards novos nos Baralhos.</p>}
        <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" className="accent-mint-500" checked={free} onChange={(e) => setFree(e.target.checked)} /> Revisão livre (não altera a programação adaptativa)</label>
        <button className="btn-primary mt-3" disabled={!preview.length} onClick={() => { setItems(preview); setI(0); }}>Começar sessão</button></Card>
    </div>
  );
  const it = items[i];
  if (!it) return <Empty title="Sessão intercalada concluída" text="Programação de revisões atualizada." action={<button className="btn-primary" onClick={() => setItems(null)}>Voltar</button>} />;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between text-sm"><span className="muted">Item {i + 1} de {items.length} · {it.kind === 'card' ? it.reason : REVIEW_REASON[it.reason]}</span><button className="btn-ghost btn-sm" onClick={() => setItems(null)}>Encerrar</button></div>
      <Progress value={i / items.length} />
      {why && <div className="flex gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-100"><Info size={16} className="mt-0.5 shrink-0" />{why}</div>}
      {it.kind === 'card' ? (() => { const c = all.find((x) => x.id === it.id)!; return (
        <div className="card !p-8 text-center"><Badge>{c.subject}</Badge><p className="mt-5 font-display text-xl font-bold">{c.front}</p>
          {flip ? <><p className="mt-4 text-lg">{c.back}</p><div className="mt-6 grid grid-cols-3 gap-2">{(['errei', 'duvida', 'seguro'] as CardRating[]).map((r) => <button key={r} className="btn-ghost" onClick={() => { setWhy(rateCard(c.id, r, { free })); setFlip(false); setI(i + 1); }}>{RATING_LABEL[r]}</button>)}</div></>
            : <button className="btn-primary mt-8" onClick={() => setFlip(true)}><RotateCw size={16} /> Mostrar resposta</button>}</div>
      ); })() : <QuestionPlayer key={it.qid + i} q={questionById(it.qid)!} mode="tutoria" isTwin={it.reason === 'inedita'} free={free} onDone={() => { setWhy(null); setI(i + 1); }} />}
      {it.kind === 'question' && <button className="muted text-xs underline" onClick={() => setI(i + 1)}>Pular</button>}
    </div>
  );
}
