import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/sync';
import { Card } from './ui';

/** Métricas REAIS do servidor (agregadas e pseudonimizadas). Exige conta de administrador no backend. */
export default function ServerMetrics() {
  const account = useStore((s) => s.account);
  const [data, setData] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (account?.role === 'admin') api('/api/admin/metrics', { token: account.token }).then(setData).catch((e) => setErr(e.message)); }, [account]);
  return (
    <Card><h2 className="section-title mb-1 flex items-center gap-2"><Database size={18} /> Dados reais do servidor</h2>
      {account?.role !== 'admin' ? <p className="muted text-sm">Conecte-se com uma conta de administrador do backend (Perfil → Conta) para ver métricas reais e agregadas. Sem isso, apenas os números fictícios acima são exibidos.</p>
        : err ? <p className="text-sm text-red-600">{err}</p> : !data ? <p className="muted text-sm">Carregando…</p> : (
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div><div className="muted text-xs">Contas</div><div className="font-display text-xl font-bold">{data.users}</div></div>
            <div><div className="muted text-xs">Ativos (7 dias)</div><div className="font-display text-xl font-bold">{data.active7d}</div></div>
            <div><div className="muted text-xs">Tentativas registradas</div><div className="font-display text-xl font-bold">{data.attempts}</div></div>
            <div><div className="muted text-xs">Taxa de acerto global</div><div className="font-display text-xl font-bold">{data.attempts ? `${Math.round((data.correct / data.attempts) * 100)}%` : '—'}</div></div>
            <div className="sm:col-span-4"><div className="muted text-xs">Causas de erro diagnosticadas</div><div className="mt-1 flex flex-wrap gap-2">{Object.entries(data.causes ?? {}).map(([k, v]) => <span key={k} className="chip bg-slate-100 dark:bg-navy-800">{k}: {String(v)}</span>)}</div></div>
          </div>
        )}
    </Card>
  );
}
