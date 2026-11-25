import { useEffect, useRef } from 'react';
import { Rich, cx } from './ui';

export interface ChatMsg { role: 'tutor' | 'user'; text: string; engine?: string; note?: string }
/** Lista de mensagens usada pelo Professor de IA. */
export default function MessageList({ msgs, busy }: { msgs: ChatMsg[]; busy?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, busy]);
  return (
    <div className="space-y-6" aria-live="polite">
      {msgs.map((m, i) => (
        <div key={i} className={cx('text-sm', m.role === 'user' && 'flex justify-end')}>
          <div className={cx(m.role === 'user' ? 'max-w-[85%] rounded-xl bg-ink-100 px-4 py-2.5 dark:bg-ink-800' : 'max-w-none')}>
            <Rich text={m.text} />
            {m.engine && <div className="mt-2 text-[11px] text-ink-400" title={m.note}>{m.engine}</div>}
          </div>
        </div>
      ))}
      {busy && <p className="muted text-sm">Analisando…</p>}
      <div ref={end} />
    </div>
  );
}
