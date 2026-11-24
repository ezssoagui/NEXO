import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FLASHCARDS } from '../data/flashcards';
import { SKILLS, skillById } from '../data/skills';
import { useStore } from '../store/useStore';
import { useAllCards, useDomains } from '../store/selectors';
import { FSRS_LABEL, isDue, retrievability } from '../engine/fsrs';
import { dueSkillReviews, strategicPlans } from '../engine/skillReview';
import { skillName } from '../engine/domain';
import { CardDeck } from '../components/Activities';
import { Badge, Card, Empty, PageHeader, Tabs } from '../components/ui';
import type { Flashcard } from '../types';

type Tab = 'memoria' | 'habilidades' | 'estrategica';
const DAY = 86400000;
export default function Revisoes() {
  const [sp, setSp] = useSearchParams(); const tab = (sp.get('aba') as Tab) || 'memoria';
  return (
    <div>
      <PageHeader title="Revisões" subtitle="Lembrar primeiro, reler depois. Cada conteúdo tem seu próprio intervalo, e o que você estuda livremente também conta." />
      <Tabs tabs={[{ id: 'memoria', label: 'Memória' }, { id: 'habilidades', label: 'Habilidades' }, { id: 'estrategica', label: 'Estratégica' }]} value={tab} onChange={(t) => setSp({ aba: t })} />
      {tab === 'memoria' ? <Memory /> : tab === 'habilidades' ? <Skills /> : <Strategic />}
    </div>
  );
}

function Memory() {
  const cards = useAllCards(); const states = useStore((s) => s.cardStates); const [deck, setDeck] = useState<Flashcard[] | null>(null); const [add, setAdd] = useState(false);
  const due = cards.filter((c) => isDue(states[c.id])); const fresh = cards.filter((c) => !states[c.id]); const risk = cards.filter((c) => { const r = retrievability(states[c.id]); return r !== null && r < 0.85 && !isDue(states[c.id]); });
  const kinds = [['curricular', 'Curriculares'], ['conceitual', 'Conceituais'], ['personalizado', 'Personalizados']] as const;
  if (deck) return <div className="mx-auto max-w-xl"><button className="muted mb-5 text-sm hover:underline" onClick={() => setDeck(null)}>← Memória</button><Card className="!py-10"><CardDeck cards={deck} onDone={() => setDeck(null)} /></Card></div>;
  const byDue = (xs: Flashcard[]) => [...xs].sort((a, b) => (states[a.id]?.due ?? 0) - (states[b.id]?.due ?? 0));
  const Row = ({ label, hint, list }: { label: string; hint: string; list: Flashcard[] }) => <li className="row"><span className="flex-1"><span className="text-sm font-medium">{label}</span><span className="muted block text-xs">{hint}</span></span><span className="text-sm">{list.length}</span><button className="btn-ghost btn-sm" disabled={!list.length} onClick={() => setDeck(byDue(list).slice(0, 20))}>Revisar</button></li>;
  return (
    <div>
      <ul><Row label="Pendentes" hint="Momento ideal de lembrar" list={due} /><Row label="Novos" hint="Até 10 por vez" list={fresh.slice(0, 10)} /><Row label="Com risco de esquecimento" hint="Previsão abaixo de 85%" list={risk} />{kinds.map(([k, l]) => <Row key={k} label={l} hint="Baralho completo" list={cards.filter((c) => c.kind === k)} />)}</ul>
      <button className="btn-ghost btn-sm mt-5" aria-expanded={add} onClick={() => setAdd(!add)}>Criar flashcard</button>{add && <NewCard onDone={() => setAdd(false)} />}
      <p className="muted mt-6 text-xs">{FSRS_LABEL}. As previsões são estimativas, não medições.</p>
    </div>
  );
}
function NewCard({ onDone }: { onDone: () => void }) {
  const add = useStore((s) => s.addCard); const notify = useStore((s) => s.notify); const [skill, setSkill] = useState(SKILLS[0].id); const [front, setFront] = useState(''); const [back, setBack] = useState('');
  return <form className="mt-4 max-w-lg space-y-3" onSubmit={(e) => { e.preventDefault(); const sk = skillById(skill)!; add({ id: `c-${Date.now().toString(36)}`, subject: sk.subject, topic: sk.name, skillId: skill, front: front.trim(), back: back.trim(), kind: 'personalizado' }); notify('Flashcard criado.'); onDone(); }}>
    <div><label className="label" htmlFor="nc-s">Habilidade</label><select id="nc-s" className="input" value={skill} onChange={(e) => setSkill(e.target.value)}>{SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
    <div><label className="label" htmlFor="nc-f">Frente</label><input id="nc-f" className="input" required value={front} onChange={(e) => setFront(e.target.value)} /></div><div><label className="label" htmlFor="nc-b">Verso</label><textarea id="nc-b" className="input" rows={2} required value={back} onChange={(e) => setBack(e.target.value)} /></div><button className="btn-primary">Salvar</button></form>;
}

function Skills() {
  const reviews = useStore((s) => s.skillReviews); const attempts = useStore((s) => s.attempts); const domains = useDomains();
  const due = dueSkillReviews(reviews, domains, attempts); const next = Object.entries(reviews).filter(([, r]) => r.due > Date.now()).sort((a, b) => a[1].due - b[1].due);
  return (
    <div>
      {due.length ? <ul>{due.map((r) => <li key={r.skillId} className="row flex-wrap"><span className="min-w-[12rem] flex-1"><Link className="text-sm font-medium hover:underline" to={`/conteudos/habilidade/${r.skillId}`}>{skillName(r.skillId)}</Link><span className="muted block text-xs">{r.reason}{r.overdueDays > 0 ? ` Atrasada há ${r.overdueDays} dia(s).` : ''}</span></span><span className="flex flex-wrap gap-2">{r.options.map((o, i) => <Link key={o.kind} to={o.to} className={i === 0 ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{o.label}</Link>)}</span></li>)}</ul> : <Empty title="Nenhuma revisão de habilidade agora" text="Elas aparecem conforme você resolve questões e explica conceitos." />}
      {next.length > 0 && <section className="mt-10"><h2 className="section-title">Próximas</h2><ul>{next.slice(0, 12).map(([id, r]) => <li key={id} className="row"><span className="flex-1 text-sm">{skillName(id)}</span><span className="muted text-xs">em {Math.ceil((r.due - Date.now()) / DAY)} dia(s) · intervalo de {r.interval}</span></li>)}</ul></section>}
    </div>
  );
}
function Strategic() {
  const domains = useDomains(); const attempts = useStore((s) => s.attempts); const cardStates = useStore((s) => s.cardStates); const customCards = useStore((s) => s.customCards); const profile = useStore((s) => s.profile)!;
  const plans = strategicPlans({ domains, attempts, cards: [...FLASHCARDS, ...customCards], cardStates, examYear: profile.examYear });
  return <div className="space-y-10">{plans.map((p) => <section key={p.kind}><h2 className="section-title">{p.title}</h2><p className="muted text-sm">{p.when}</p>{p.focus.length ? <ul className="mt-2">{p.focus.map((f) => <li key={f.skillId} className="row"><Link className="flex-1 text-sm hover:underline" to={`/conteudos/habilidade/${f.skillId}?recordar=1`}>{skillName(f.skillId)}</Link><Badge>{f.why}</Badge></li>)}</ul> : <p className="muted mt-2 text-sm">Sem atividades no período.</p>}<ul className="muted mt-3 list-disc pl-5 text-xs">{p.tasks.map((t) => <li key={t}>{t}</li>)}</ul></section>)}</div>;
}
