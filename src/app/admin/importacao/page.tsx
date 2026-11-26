'use client';

import { useState } from 'react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Button, Card, Loading, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

/** Importação em lote (15.4): JSON gerado por scripts/import-enem; tudo entra em preparação (staging). */
export default function AdminImport() {
  const { data, loading, reload } = useApi<{ runs: { id: string; kind: string; status: string; report: { loaded?: number; duplicate?: number; error?: number; errors?: string[] }; started_at: string }[] }>('/api/admin/import');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="space-y-4">
      <PageHeader title="Importação" description="Carregue o arquivo staging_items.json produzido pelo pipeline Python (scripts/import-enem). Itens entram como “em preparação” e só são publicados após validação." />
      <Card>
        <input type="file" accept="application/json" aria-label="Arquivo JSON de importação" disabled={busy} onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const parsed = JSON.parse(await file.text()) as { manifest?: Record<string, unknown>; items?: unknown[] };
            if (!Array.isArray(parsed.items)) throw new Error('Arquivo sem "items".');
            for (let i = 0; i < parsed.items.length; i += 500) {
              const r = await api<{ loaded: number; duplicate: number; error: number }>('/api/admin/import', { body: { kind: 'enem_items', manifest: parsed.manifest ?? {}, items: parsed.items.slice(i, i + 500) } });
              toast('success', `Lote ${i / 500 + 1}: ${r.loaded} novos, ${r.duplicate} duplicados, ${r.error} com erro.`);
            }
            reload();
          } catch (err) { toast('error', (err as Error).message); } finally { setBusy(false); e.target.value = ''; }
        }} />
        {busy && <Loading label="Importando…" />}
      </Card>
      {loading ? <Loading /> : (
        <ul className="space-y-2">{data?.runs.map((r) => (
          <li key={r.id}><Card className="text-sm"><div className="flex justify-between"><span>{r.kind} · {fmtDate(r.started_at)}</span><span>{r.status}</span></div>
            <div className="text-muted">{r.report.loaded ?? 0} carregados · {r.report.duplicate ?? 0} duplicados · {r.report.error ?? 0} erros</div>
            {r.report.errors?.length ? <details><summary className="cursor-pointer">Erros</summary><ul className="text-xs">{r.report.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}</ul></details> : null}
          </Card></li>
        ))}</ul>
      )}
      <Button variant="ghost" onClick={reload}>Atualizar</Button>
    </div>
  );
}
