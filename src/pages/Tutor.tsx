import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Bot, User, AlertTriangle, Stethoscope } from 'lucide-react';
import { getQuestion, useStore } from '../store/useStore';
import { AI } from '../services/ai';
import { greet, MODES, type TutorMode, type TutorReply, type TutorState } from '../engine/tutor';
import { weakSkills } from '../engine/recommend';
import { PageHeader, DemoBadge, Rich, Badge, cx, Card } from '../components/ui';
import { CAUSE_LABELS, skillById } from '../data/skills';
import { recommendations } from '../engine/learning';

interface Msg { role: 'user' | 'tutor'; text: string; reply?: TutorReply; engine?: string; fallback?: string }

export default function Tutor() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const { attempts, profile, consume, usage, limits, plan, notify } = useStore();
  const q = sp.get('q') ? getQuestion(sp.get('q')!) : undefined;
  const attempt = attempts.find((a) => a.id === sp.get('a'));
  const [state, setState] = useState<TutorState>({ mode: (sp.get('modo') as TutorMode) || (attempt && !attempt.correct ? 'corrigir' : 'socratico'), step: 0, directRequests: 0, context: q ? { q, attempt } : undefined, skill: q?.skillId });
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const g = greet(state.mode, state.context);
    // Contexto pedagógico REAL do aluno (somente registros existentes; nada é inventado).
    const ctxMsgs: Msg[] = [];
    if (!state.context) {
      const lastErr = [...attempts].reverse().find((a) => !a.correct && a.cause && a.cause !== 'indeterminada');
      const rec = recommendations(attempts, useStore.getState().skillReviews, Date.now(), 1, profile?.goal)[0];
      if (lastErr) ctxMsgs.push({ role: 'tutor', text: `Pelo seu histórico registrado: em ${new Date(lastErr.ts).toLocaleDateString('pt-BR')} a questão ${lastErr.qid} (${skillById(lastErr.skillId)?.name}) teve como causa provável **${CAUSE_LABELS[lastErr.cause!].label.toLowerCase()}**. Se quiser, retomamos esse ponto — ou pergunte o que preferir.`, reply: { text: '', actions: [{ label: 'Retomar esse ponto', to: `/tutor?q=${lastErr.qid}&a=${lastErr.id}` }] } });
      else if (rec && attempts.length) ctxMsgs.push({ role: 'tutor', text: `Seu Motor de Domínio recomenda agora: **${skillById(rec.skillId)?.name}** — ${rec.reason}` });
    }
    return [...ctxMsgs, { role: 'tutor', text: g.text, reply: g }];
  });
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);
  const diagnoses = msgs.map((m) => m.reply?.diagnosis).filter(Boolean) as string[];

  function changeMode(m: TutorMode) { const s = { ...state, mode: m, step: 0, challenge: undefined }; setState(s); const g = greet(m, m === 'corrigir' ? s.context : undefined); setMsgs((x) => [...x, { role: 'tutor', text: `Modo **${MODES.find((y) => y.id === m)!.label}** ativado. ${g.text}`, reply: g }]); }
  async function send(text: string) {
    if (!text.trim() || busy) return;
    if (!consume('tutor')) { notify('Limite mensal de mensagens com a IA Tutora atingido (créditos simulados). Veja os planos.'); return; }
    setMsgs((x) => [...x, { role: 'user', text }]); setInput(''); setBusy(true);
    const r = await AI.reply(state, text, { attempts, weakSkills: weakSkills(attempts, profile), history: msgs.map((m) => ({ role: m.role, text: m.text })) });
    setState(r.data.state); setMsgs((x) => [...x, { role: 'tutor', text: r.data.reply.text, reply: r.data.reply, engine: r.engine, fallback: r.fallbackReason }]); setBusy(false);
  }

  return (
    <div>
      <PageHeader title="Nexo Tutor" subtitle="Paciente, objetiva e rigorosa: acompanha seu pensamento em vez de entregar respostas prontas.">
        <DemoBadge label="Cada resposta indica o motor usado" title="Com o backend configurado, as respostas vêm de um modelo de IA real (identificado). Sem ele, do motor de regras local, identificado como demonstração." />
      </PageHeader>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="card flex h-[calc(100vh-15rem)] min-h-[480px] min-w-0 flex-col !p-0">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2 dark:border-navy-800" role="tablist" aria-label="Modos da tutora">
            {MODES.map((m) => <button key={m.id} role="tab" aria-selected={state.mode === m.id} title={m.desc} onClick={() => changeMode(m.id)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold', state.mode === m.id ? 'bg-navy-800 text-white dark:bg-mint-500 dark:text-navy-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800')}>{m.label}</button>)}
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cx('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.role === 'tutor' ? 'bg-navy-800 text-mint-300' : 'bg-mint-500 text-navy-950')}>{m.role === 'tutor' ? <Bot size={16} /> : <User size={16} />}</div>
                <div className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.role === 'tutor' ? 'bg-slate-100 dark:bg-navy-800' : 'bg-mint-500/15 text-navy-900 dark:text-white')}>
                  <Rich text={m.text} />
                  {m.engine && <div className="mt-2 text-[10px] text-slate-500" title={m.fallback}>{m.engine}{m.fallback ? ' · ' + m.fallback : ''}</div>}
                  {m.reply?.uncertain && <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle size={12} /> Resposta sinalizada: requer validação.</div>}
                  {m.reply?.diagnosis && <div className="mt-2"><Badge tone="red"><Stethoscope size={12} /> Dificuldade registrada: {m.reply.diagnosis}</Badge></div>}
                  {m.reply?.actions && i === msgs.length - 1 && <div className="mt-3 flex flex-wrap gap-2">{m.reply.actions.map((a) => <button key={a.label} className="btn-ghost btn-sm" onClick={() => (a.to ? nav(a.to) : send(a.send!))}>{a.label}</button>)}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="muted flex items-center gap-2 text-sm"><Bot size={16} /> Analisando…</div>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-slate-200 p-3 dark:border-navy-800" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <label htmlFor="msg" className="sr-only">Mensagem</label>
            <input id="msg" className="input" placeholder={state.mode === 'corrigir' ? 'Cole sua resolução e diga o assunto…' : 'Escreva sua pergunta ou resposta…'} value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn-primary" disabled={busy || !input.trim()} aria-label="Enviar"><Send size={16} /></button>
          </form>
        </div>
        <div className="space-y-4">
          {q && <Card><div className="muted text-xs font-semibold uppercase">Questão em contexto</div><div className="mt-1 font-semibold">{q.id} · {q.topic}</div><p className="muted mt-1 line-clamp-4 text-xs">{q.context ?? q.statement}</p><Link className="btn-ghost btn-sm mt-2" to={`/questoes/${q.id}`}>Abrir questão</Link></Card>}
          <Card><div className="text-sm font-semibold">Peça de outro jeito</div><div className="mt-2 flex flex-wrap gap-2">{['analogia', 'demonstração matemática', 'exemplo do cotidiano', 'linguagem avançada', 'explique direto'].map((t) => <button key={t} className="btn-ghost btn-sm" onClick={() => send(t)}>{t}</button>)}</div></Card>
          <Card><div className="text-sm font-semibold">Dificuldades registradas</div>{diagnoses.length ? <ul className="mt-2 space-y-1 text-xs">{diagnoses.map((d, i) => <li key={i}>• {d}</li>)}</ul> : <p className="muted mt-1 text-xs">Nenhuma nesta conversa.</p>}</Card>
          <Card><div className="text-sm font-semibold">Consumo de IA (simulado)</div><p className="muted mt-1 text-xs">{usage.tutor} de {limits[plan].tutor} mensagens no mês · plano {plan === 'plus' ? 'Plus' : 'Free'}</p></Card>
          <p className="muted text-xs">A tutora não inventa fatos: quando a base demonstrativa não cobre o tema, ela avisa em vez de responder.</p>
        </div>
      </div>
    </div>
  );
}
