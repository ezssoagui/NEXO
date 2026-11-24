import { useEffect, useState } from 'react';
import { getAIStatus, type AIStatus } from '../services/ai';

/** Mostra, sem ambiguidade, se há IA real conectada ou se as interações são simuladas por regras. */
export default function AIStatusBadge() {
  const [st, setSt] = useState<AIStatus | null>(null);
  useEffect(() => { getAIStatus().then(setSt).catch(() => undefined); }, []);
  if (!st) return <span />;
  return st.mode === 'remote'
    ? <span className="muted flex items-center gap-1.5 text-xs" title={`${st.provider} · ${st.model}`}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />IA conectada</span>
    : <span className="muted flex items-center gap-1.5 text-xs" title={st.reason}><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />IA simulada (sem provedor)</span>;
}
