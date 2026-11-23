import { useEffect, useRef, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { Rich, cx } from './ui';

export interface ChatMsg { role: 'tutor' | 'user'; text: string; tag?: string }
/** Conversa compacta usada dentro da tela de resolução (C–P–E e socrático). Uma pergunta por vez. */
export default function MiniChat({ msgs, onSend, disabled, placeholder, engine }: { msgs: ChatMsg[]; onSend: (t: string) => void; disabled?: boolean; placeholder?: string; engine: string }) {
  const [t, setT] = useState(''); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700">
      <div className="max-h-80 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={cx('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
            <div className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', m.role === 'tutor' ? 'bg-navy-800 text-mint-300' : 'bg-mint-500 text-navy-950')}>{m.role === 'tutor' ? <Bot size={14} /> : <User size={14} />}</div>
            <div className={cx('max-w-[88%] rounded-2xl px-3 py-2 text-sm', m.role === 'tutor' ? 'bg-slate-100 dark:bg-navy-800' : 'bg-mint-500/15')}>
              {m.tag && <span className="mr-1 rounded bg-navy-800 px-1.5 py-0.5 text-[10px] font-bold text-white">{m.tag}</span>}<Rich text={m.text} />
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {!disabled && (
        <form className="flex gap-2 border-t border-slate-200 p-2 dark:border-navy-700" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onSend(t.trim()); setT(''); } }}>
          <label className="sr-only" htmlFor="mini-in">Sua resposta</label>
          <input id="mini-in" className="input !py-2" placeholder={placeholder ?? 'Responda com suas palavras…'} value={t} onChange={(e) => setT(e.target.value)} />
          <button className="btn-primary btn-sm" aria-label="Enviar" disabled={!t.trim()}><Send size={14} /></button>
        </form>
      )}
      <div className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500 dark:border-navy-800">{engine}</div>
    </div>
  );
}
