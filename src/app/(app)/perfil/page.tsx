'use client';

import { useState } from 'react';
import { Award, Flame, Trophy } from 'lucide-react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, ErrorState, Input, Loading, PageHeader, Progress, Tabs } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Gam { xp: number; level: number; className: string; xpIntoLevel: number; xpForNext: number; streak: number; longestStreak: number; achievements: { code: string; title: string; description: string; earned_at: string | null }[] }

function Ranking() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const { data, loading } = useApi<{ items: { position: number; name: string; xp: number; me: boolean }[] }>(`/api/ranking?period=${period}`);
  return (
    <div>
      <Tabs value={period} onChange={setPeriod} items={[{ value: 'week', label: 'Semanal' }, { value: 'month', label: 'Mensal' }, { value: 'all', label: 'Histórico' }]} />
      {loading ? <Loading /> : !data?.items.length ? <p className="text-sm text-muted">Ninguém no ranking neste período.</p> : (
        <ol className="space-y-1">{data.items.map((r) => (
          <li key={r.position} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${r.me ? 'bg-primary-soft' : 'bg-surface-2'}`}><span>{r.position}. {r.name}</span><span className="tabular-nums">{r.xp} XP</span></li>
        ))}</ol>
      )}
    </div>
  );
}

/** Perfil (9.9): nível, XP, sequência, conquistas e ranking opt-in. Gamificação não altera a pedagogia (9.8). */
export default function ProfilePage() {
  const { data, error, loading } = useApi<Gam>('/api/gamification');
  const { data: prof, setData: setProf } = useApi<{ profile: { ranking_opt_in: boolean; ranking_display_name: string | null } | null }>('/api/me/profile');
  const [name, setName] = useState('');
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;
  const optIn = prof?.profile?.ranking_opt_in ?? false;
  return (
    <div className="space-y-4">
      <PageHeader title="Perfil" />
      <Card className="grid gap-4 sm:grid-cols-3">
        <div><div className="flex items-center gap-2 text-sm text-muted"><Award className="size-4 text-award" /> Nível</div><div className="text-3xl font-bold">{data.level}</div><Badge tone="award">{data.className}</Badge></div>
        <div><div className="text-sm text-muted">XP total</div><div className="text-3xl font-bold tabular-nums">{data.xp}</div><div className="mt-2"><Progress value={(data.xpIntoLevel / 500) * 100} label="Progresso no nível" /></div><div className="mt-1 text-xs text-muted">{data.xpForNext} XP para o próximo nível</div></div>
        <div><div className="flex items-center gap-2 text-sm text-muted"><Flame className="size-4 text-award" /> Sequência</div><div className="text-3xl font-bold">{data.streak}</div><div className="text-xs text-muted">recorde: {data.longestStreak} dias</div></div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Conquistas</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{data.achievements.map((a) => (
          <li key={a.code} className={`rounded-lg border p-3 ${a.earned_at ? 'border-award/40 bg-surface' : 'border-border opacity-60'}`}><div className="font-medium">{a.title}</div><div className="text-xs text-muted">{a.description}{a.earned_at ? ` · ${fmtDate(a.earned_at)}` : ''}</div></li>
        ))}</ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><Trophy className="size-4 text-award" /> Ranking por XP (opcional)</h2>
        <p className="text-sm text-muted">Participação voluntária, apenas com apelido e XP. Nenhuma nota, escola ou dado pessoal é exibido.</p>
        {optIn ? (
          <div className="flex flex-wrap items-center gap-3"><span className="text-sm">Participando como <strong>{prof?.profile?.ranking_display_name}</strong></span>
            <Button size="sm" variant="secondary" onClick={async () => { try { await api('/api/me/ranking', { body: { optIn: false } }); setProf({ profile: { ranking_opt_in: false, ranking_display_name: prof?.profile?.ranking_display_name ?? null } }); } catch (e) { toast('error', (e as Error).message); } }}>Sair do ranking</Button></div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Apelido" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} hint="3 a 24 caracteres; não use seu nome completo." />
            <Button onClick={async () => { try { await api('/api/me/ranking', { body: { optIn: true, displayName: name } }); setProf({ profile: { ranking_opt_in: true, ranking_display_name: name } }); } catch (e) { toast('error', (e as Error).message); } }}>Participar</Button>
          </div>
        )}
        <Ranking />
      </Card>
    </div>
  );
}
