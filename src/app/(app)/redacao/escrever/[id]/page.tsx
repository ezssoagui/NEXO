'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, useApi, uuid } from '@/lib/api';
import { Markdown } from '@/components/markdown';
import { Button, Card, ErrorState, Loading, cn } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Essay { id: string; status: string; theme_id: string | null; theme_title: string | null; custom_theme_title: string | null; draft: { body: string; updated_at: string } | null; versions: { version: number }[] }
interface Theme { title: string; instructions_md: string | null; motivators: { position: number; body_md: string; source_citation: string }[] }

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const lines = (t: string) => t.split(/\n+/).map((p) => p.trim()).filter(Boolean).reduce((s, p) => s + Math.ceil(p.length / 70), 0);

/** Editor digital (6.8): digitação/colagem, salvamento automático, contadores; sem IA durante a escrita. */
export default function EssayEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading } = useApi<Essay>(`/api/essays/${id}`);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [busy, setBusy] = useState(false);
  const [key] = useState(uuid);
  const initialized = useRef(false);
  useEffect(() => {
    if (data && !initialized.current) { setBody(data.draft?.body ?? ''); initialized.current = true; }
    if (data?.theme_id) api<Theme>(`/api/essays/themes/${data.theme_id}`).then(setTheme).catch(() => undefined);
  }, [data]);
  useEffect(() => {
    if (!initialized.current) return;
    setSaved('dirty');
    const t = setTimeout(async () => {
      setSaved('saving');
      try { await api(`/api/essays/${id}/draft`, { method: 'PUT', body: { body } }); setSaved('saved'); } catch { setSaved('error'); }
    }, 1200);
    return () => clearTimeout(t);
  }, [body, id]);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;
  const l = lines(body);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between"><Link href="/redacao" className="text-sm text-muted">← Redação</Link>
          <span className={cn('text-xs', saved === 'error' ? 'text-danger' : 'text-muted')} aria-live="polite">{{ saved: 'Rascunho salvo', saving: 'Salvando…', dirty: 'Alterações não salvas', error: 'Falha ao salvar — verifique a conexão' }[saved]}</span></div>
        <h1 className="text-lg font-semibold">{data.theme_title ?? data.custom_theme_title}</h1>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={24} maxLength={20000} aria-label="Texto da redação" spellCheck={false}
          className="w-full rounded-xl border border-border bg-surface p-4 font-serif text-[1.05rem] leading-8" placeholder="Escreva ou cole seu texto dissertativo-argumentativo…" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>{words(body)} palavras · ~{l} linhas estimadas (mín. 8, máx. 30)</span>
          <Button loading={busy} disabled={l < 8 || saved === 'saving'} onClick={async () => {
            setBusy(true);
            try {
              await api(`/api/essays/${id}/draft`, { method: 'PUT', body: { body } });
              await api(`/api/essays/${id}/submit`, { body: { idempotencyKey: key } });
              router.push(`/redacao/${id}`);
            } catch (e) { toast('error', e instanceof ApiError ? e.message : 'Falha ao enviar.'); setBusy(false); }
          }}>Enviar para correção</Button>
        </div>
        <p className="text-xs text-muted">A correção usa uma unidade da franquia de redações do mês. Falhas técnicas não consomem franquia.</p>
      </div>
      <aside className="space-y-3">
        {theme?.instructions_md && <Card><h2 className="mb-1 text-sm font-semibold">Proposta</h2><Markdown text={theme.instructions_md} className="text-sm" /></Card>}
        {theme?.motivators.map((m) => (
          <Card key={m.position}><h2 className="mb-1 text-xs font-semibold uppercase text-muted">Texto {m.position}</h2><Markdown text={m.body_md} className="text-sm" /><p className="mt-1 text-xs text-muted">{m.source_citation}</p></Card>
        ))}
      </aside>
    </div>
  );
}
