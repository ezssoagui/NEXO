import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Send } from 'lucide-react';
import { getQuestion, useAiLock, useStore } from '../store/useStore';
import { useDomains, useRecommendations } from '../store/selectors';
import { AI } from '../services/ai';
import { greet, MODES, type TutorMode, type TutorReply, type TutorState } from '../engine/tutor';
import { levelFor, skillName } from '../engine/domain';
import MessageList, { type ChatMsg } from '../components/MiniChat';
import { Empty, PageHeader, cx } from '../components/ui';

export default function Professor() {
  const lock = useAiLock();
  if (lock.locked) return <div className="mx-auto max-w-xl pt-10"><Empty title="Professor de IA indisponível agora" text={lock.reason} action={lock.activity ? <><Link className="btn-primary" to={`/atividade/${lock.activity.id}`}><Lock size={15} /> Voltar à atividade</Link></> : undefined} /></div>;
  return <Chat />;
}

/** Acesso contextual e somente leitura ao perfil pedagógico: o professor orienta, mas não altera indicadores. */
function Chat() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const attempts = useStore((s) => s.attempts); const domains = useDomains(); const recs = useRecommendations(6);
  const q = sp.get('q') ? getQuestion(sp.get('q')!) : undefined; const attempt = attempts.find((a) => a.id === sp.get('a'));
  const [state, setState] = useState<TutorState>({ mode: attempt && !attempt.correct ? 'corrigir' : 'explicar', step: 0, directRequests: 0, context: q ? { q, attempt } : undefined, skill: q?.skillId ?? sp.get('skill') ?? undefined });
  const first = useMemo<TutorReply>(() => { if (state.context) return greet(state.mode, state.context); const rec = recs.find((r) => r.skillIds.length); return rec && attempts.length ? { ...greet('explicar'), text: `Pelo seu perfil, um bom ponto agora é **${skillName(rec.skillIds[0])}**. ${rec.reason}\n\nPergunte sobre isso ou sobre o que preferir.` } : greet('explicar'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: 'tutor', text: first.text }]); const [actions, setActions] = useState(first.actions ?? []); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const ctx = useMemo(() => ({ attempts, weakSkills: recs.flatMap((r) => r.skillIds), levels: Object.fromEntries([...domains].map(([id, d]) => [id, levelFor(d)])), demonstrated: [...domains.values()].filter((d) => d.dims.compreensao.status === 'demonstrada').map((d) => d.skillId) }), [attempts, recs, domains]);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text }]); setInput(''); setBusy(true); setActions([]);
    const r = await AI.reply(state, text, { ...ctx, history: msgs.map((m) => ({ role: m.role, text: m.text })) });
    setState(r.data.state); setMsgs((m) => [...m, { role: 'tutor', text: r.data.reply.text, engine: r.engine, note: r.fallbackReason }]); setActions(r.data.reply.actions ?? []); setBusy(false);
  }
  const mode = (m: TutorMode) => { setState({ ...state, mode: m, step: 0, soc: undefined }); const g = greet(m, m === 'corrigir' ? state.context : undefined); setMsgs((x) => [...x, { role: 'tutor', text: g.text }]); setActions(g.actions ?? []); };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Professor de IA" subtitle="Tire dúvidas, peça explicações diretas ou seja guiado por perguntas. Respostas daqui não contam como comprovação." />
      {q && <p className="muted -mt-4 mb-6 text-sm">Em contexto: {q.topic}. <Link className="link" to={`/questoes/${q.id}`}>Ver questão</Link></p>}
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Modo">{MODES.map((m) => <button key={m.id} role="tab" aria-selected={state.mode === m.id} title={m.desc} onClick={() => mode(m.id)} className={cx('rounded-full border px-3 py-1 text-xs', state.mode === m.id ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>{m.label}</button>)}</div>
      <MessageList msgs={msgs} busy={busy} />
      {actions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{actions.map((a) => <button key={a.label} className="btn-ghost btn-sm" onClick={() => (a.to ? nav(a.to) : send(a.send!))}>{a.label}</button>)}</div>}
      <form className="sticky bottom-16 mt-6 flex gap-2 bg-white py-3 dark:bg-ink-950 lg:bottom-0" onSubmit={(e) => { e.preventDefault(); send(input); }}><label htmlFor="msg" className="sr-only">Mensagem</label><input id="msg" className="input" placeholder="Escreva sua pergunta ou raciocínio" value={input} onChange={(e) => setInput(e.target.value)} /><button className="btn-primary" disabled={busy || !input.trim()} aria-label="Enviar"><Send size={16} /></button></form>
    </div>
  );
}
