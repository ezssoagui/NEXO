'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Filter, Sparkles } from 'lucide-react';
import { api, AREA_NAMES, DIFFICULTY_NAMES, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, SyntheticBadge, Tabs } from '@/components/ui';
import { useToast } from '@/components/toast';

interface BankItem { id: string; area_code: string; year: number | null; application: string | null; difficulty: string | null; snippet: string; subtopic: string | null; is_synthetic: boolean; answered: boolean }
interface Filters { q: string; areas: string[]; difficulties: string[]; status: 'all' | 'unseen' | 'answered' | 'wrong'; page: number }

function toggle(xs: string[], v: string) { return xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]; }

function Bank() {
  const [f, setF] = useState<Filters>({ q: '', areas: [], difficulties: [], status: 'all', page: 1 });
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<{ total: number; items: BankItem[]; pageSize: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    let cancelled = false;
    api<{ total: number; items: BankItem[]; pageSize: number }>('/api/questions/search', { body: { ...f, q: f.q || undefined } }).then(
      (r) => { if (!cancelled) { setRes(r); setErr(null); } },
      (e) => { if (!cancelled) setErr((e as Error).message); },
    );
    return () => { cancelled = true; };
  }, [f]);
  const createList = async (mode: 'adaptive' | 'manual') => {
    setBusy(true);
    try {
      const l = await api<{ id: string }>('/api/lists', { body: { mode, count: 10, filters: mode === 'manual' ? { ...f, q: f.q || undefined } : undefined } });
      router.push(`/questoes/lista/${l.id}`);
    } catch (e) { toast('error', (e as Error).message); setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => createList('adaptive')} loading={busy}><Sparkles className="size-4" /> Prática adaptativa</Button>
        <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}><Filter className="size-4" /> Filtros</Button>
        <Button variant="secondary" onClick={() => createList('manual')} disabled={busy || !res?.total}>Lista com estes filtros</Button>
      </div>
      {open && (
        <Card className="space-y-3">
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} placeholder="Buscar no enunciado" aria-label="Buscar no enunciado" className="h-10 w-full rounded-lg border border-border bg-surface px-3" />
          <div className="flex flex-wrap gap-2">{['LC', 'CH', 'CN', 'MT'].map((a) => <Button key={a} size="sm" variant={f.areas.includes(a) ? 'primary' : 'secondary'} onClick={() => setF({ ...f, areas: toggle(f.areas, a), page: 1 })}>{AREA_NAMES[a]}</Button>)}</div>
          <div className="flex flex-wrap gap-2">{['easy', 'medium', 'hard'].map((d) => <Button key={d} size="sm" variant={f.difficulties.includes(d) ? 'primary' : 'secondary'} onClick={() => setF({ ...f, difficulties: toggle(f.difficulties, d), page: 1 })}>{DIFFICULTY_NAMES[d]}</Button>)}</div>
          <div className="flex flex-wrap gap-2">{([['all', 'Todas'], ['unseen', 'Não resolvidas'], ['answered', 'Resolvidas'], ['wrong', 'Com erro']] as const).map(([v, l]) => <Button key={v} size="sm" variant={f.status === v ? 'primary' : 'secondary'} onClick={() => setF({ ...f, status: v, page: 1 })}>{l}</Button>)}</div>
        </Card>
      )}
      {err && <ErrorState message={err} />}
      {!res ? <Loading /> : res.items.length === 0 ? <Empty title="Nenhuma questão encontrada">O banco é composto exclusivamente por questões oficiais do ENEM publicadas após validação.</Empty> : (
        <>
          <p className="text-sm text-muted">{res.total} questão(ões)</p>
          <ul className="space-y-2">
            {res.items.map((q) => (
              <li key={q.id}><Link href={`/questoes/${q.id}`} className="block rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs"><Badge>{AREA_NAMES[q.area_code]}</Badge>{q.year && <Badge>{q.year}</Badge>}{q.difficulty && <Badge>{DIFFICULTY_NAMES[q.difficulty]}</Badge>}{q.answered && <Badge tone="success">resolvida</Badge>}<SyntheticBadge show={q.is_synthetic} /></div>
                <p className="text-sm">{q.snippet}…</p>
                {q.subtopic && <p className="mt-1 text-xs text-muted">{q.subtopic}</p>}
              </Link></li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button variant="secondary" size="sm" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={f.page * res.pageSize >= res.total} onClick={() => setF({ ...f, page: f.page + 1 })}>Próxima</Button>
          </div>
        </>
      )}
    </div>
  );
}

function Lists() {
  const { data, loading } = useApi<{ items: { id: string; mode: string; status: string; created_at: string; total: number }[] }>('/api/lists');
  if (loading) return <Loading />;
  if (!data?.items.length) return <Empty title="Nenhuma lista ainda" />;
  return <ul className="space-y-2">{data.items.map((l) => (
    <li key={l.id}><Link href={`/questoes/lista/${l.id}`} className="flex justify-between rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
      <span>{l.mode === 'adaptive' ? 'Prática adaptativa' : 'Lista personalizada'} · {l.total} questões</span>
      <span className="text-sm text-muted">{l.status === 'finished' ? 'Corrigida' : 'Em andamento'} · {fmtDate(l.created_at)}</span>
    </Link></li>
  ))}</ul>;
}

const RECOVERY: Record<string, string> = { open: 'Em aberto', recovering: 'Em recuperação', overcome: 'Superado' };
function ErrorBook() {
  const [status, setStatus] = useState<string>('open');
  const { data, loading } = useApi<{ items: { id: string; question_id: string; snippet: string; subtopic: string | null; recovery_status: string; attempts_count: number; cpe_status: string; area_code: string; last_attempt_id: string; error_type: string | null; updated_at: string }[] }>(`/api/errors?status=${status}`);
  return (
    <div>
      <div className="mb-3 flex gap-2">{Object.entries(RECOVERY).map(([k, v]) => <Button key={k} size="sm" variant={status === k ? 'primary' : 'secondary'} onClick={() => setStatus(k)}>{v}</Button>)}</div>
      {loading ? <Loading /> : !data?.items.length ? <Empty title="Nada aqui">Erros são registrados automaticamente. Um erro só é superado com novas evidências na mesma habilidade.</Empty> : (
        <ul className="space-y-2">{data.items.map((e) => (
          <li key={e.id}><Card className="py-3">
            <div className="mb-1 flex flex-wrap gap-2 text-xs"><Badge>{AREA_NAMES[e.area_code]}</Badge><Badge tone={e.recovery_status === 'overcome' ? 'success' : 'warning'}>{RECOVERY[e.recovery_status]}</Badge><span className="text-muted">{e.attempts_count} tentativa(s) · {fmtDate(e.updated_at)}</span></div>
            <p className="text-sm">{e.snippet}…</p>
            <div className="mt-2 flex gap-3 text-sm">
              <Link href={`/questoes/${e.question_id}`} className="text-primary">Refazer</Link>
              {e.cpe_status === 'pending' || e.cpe_status === 'partial' ? <Link href={`/questoes/cpe/${e.last_attempt_id}`} className="text-primary">Método CPE</Link> : null}
            </div>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}

export default function QuestionsPage() {
  const [tab, setTab] = useState<'bank' | 'lists' | 'errors'>('bank');
  return (
    <div>
      <PageHeader title="Questões" description="Banco de questões oficiais do ENEM, listas e caderno de erros." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'bank', label: 'Banco' }, { value: 'lists', label: 'Listas' }, { value: 'errors', label: 'Caderno de erros' }]} />
      {tab === 'bank' && <Bank />}
      {tab === 'lists' && <Lists />}
      {tab === 'errors' && <ErrorBook />}
    </div>
  );
}
