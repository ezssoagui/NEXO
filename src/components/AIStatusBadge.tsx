import { useEffect, useState } from 'react';
import { Cpu, FlaskConical } from 'lucide-react';
import { getAIStatus, type AIStatus } from '../services/ai';

/** Mostra, sem ambiguidade, se a plataforma está usando IA real (backend configurado) ou o modo demonstrativo. */
export default function AIStatusBadge() {
  const [st, setSt] = useState<AIStatus | null>(null);
  useEffect(() => { getAIStatus().then(setSt).catch(() => undefined); }, []);
  if (!st) return null;
  return st.mode === 'remote'
    ? <span className="chip hidden border border-mint-300 bg-mint-50 text-mint-800 dark:border-mint-500/40 dark:bg-mint-500/10 dark:text-mint-300 sm:inline-flex" title={`Provedor: ${st.provider} · modelo: ${st.model}`}><Cpu size={12} /> IA real conectada</span>
    : <span className="chip hidden border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 sm:inline-flex" title={st.reason}><FlaskConical size={12} /> IA em modo demonstrativo</span>;
}
