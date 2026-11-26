'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError, fmtDate, useApi } from '@/lib/api';
import { applyTheme } from '@/components/app-shell';
import { Badge, Button, Card, Input, Loading, Modal, PageHeader, Progress, Select, Tabs } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Profile { profile: { display_name: string; enem_target_year: number; foreign_language: string | null; course_goal: string | null; university_goal: string | null; current_institution: string | null; guardian_consent_status: string } | null; preferences: { theme: 'light' | 'dark' | 'system'; question_layout: string; show_question_timer: boolean } }
interface Usage { plan: string; source: string; until: string | null; resources: { resource: string; period: string; limit: number | null; used: number; label: string }[] }
interface Sub { plan: { plan: string; source: string; until: string | null }; paymentsEnabled: boolean; subscriptions: { id: string; plan_code: string; cycle: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; scheduled_plan_code: string | null; first_paid_at: string | null }[]; payments: { provider_payment_id: string; amount_cents: number; status: string; due_date: string; invoice_url: string | null }[]; grants: { plan_code: string; ends_at: string; reason: string }[] }
const PLAN: Record<string, string> = { free: 'Gratuito', plus: 'Plus', pro: 'Pro' };

function ProfileTab() {
  const { data, setData } = useApi<Profile>('/api/me/profile');
  if (!data) return <Loading />;
  return <ProfileForm data={data} setData={setData} />;
}

function ProfileForm({ data, setData }: { data: Profile; setData: (p: Profile) => void }) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>(() => ({
    displayName: data.profile?.display_name ?? '', foreignLanguage: data.profile?.foreign_language ?? '', courseGoal: data.profile?.course_goal ?? '',
    universityGoal: data.profile?.university_goal ?? '', currentInstitution: data.profile?.current_institution ?? '',
  }));
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">Dados cadastrais</h2>
        <Input label="Nome de exibição" value={f.displayName ?? ''} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        <Select label="Língua estrangeira" value={f.foreignLanguage ?? ''} onChange={(e) => setF({ ...f, foreignLanguage: e.target.value })}><option value="">Não definida</option><option value="en">Inglês</option><option value="es">Espanhol</option></Select>
        <Input label="Curso pretendido (opcional)" value={f.courseGoal ?? ''} onChange={(e) => setF({ ...f, courseGoal: e.target.value })} />
        <Input label="Universidade pretendida (opcional)" value={f.universityGoal ?? ''} onChange={(e) => setF({ ...f, universityGoal: e.target.value })} />
        <Input label="Instituição atual (opcional)" value={f.currentInstitution ?? ''} onChange={(e) => setF({ ...f, currentInstitution: e.target.value })} />
        <p className="text-xs text-muted">Ano do ENEM: {data.profile?.enem_target_year}. {data.profile?.guardian_consent_status === 'pending' && 'Autorização do responsável pendente.'}</p>
        <Button onClick={async () => {
          try { setData(await api<Profile>('/api/me/profile', { method: 'PATCH', body: { displayName: f.displayName, foreignLanguage: f.foreignLanguage || null, courseGoal: f.courseGoal || null, universityGoal: f.universityGoal || null, currentInstitution: f.currentInstitution || null } })); toast('success', 'Dados atualizados.'); }
          catch (e) { toast('error', (e as Error).message); }
        }}>Salvar</Button>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Aparência e estudo</h2>
        <Select label="Tema" value={data.preferences.theme} onChange={async (e) => {
          const theme = e.target.value as 'light' | 'dark' | 'system';
          applyTheme(theme);
          setData(await api<Profile>('/api/me/preferences', { method: 'PATCH', body: { theme } }));
        }}><option value="system">Automático (dispositivo)</option><option value="light">Claro</option><option value="dark">Escuro</option></Select>
        <Select label="Layout das questões no computador" value={data.preferences.question_layout} onChange={async (e) => setData(await api<Profile>('/api/me/preferences', { method: 'PATCH', body: { questionLayout: e.target.value } }))}>
          <option value="vertical">Vertical</option><option value="split">Lado a lado</option>
        </Select>
      </Card>
    </div>
  );
}

function PlanTab() {
  const { data: usage } = useApi<Usage>('/api/me/usage');
  const { data: sub, reload } = useApi<Sub>('/api/subscription');
  const [checkout, setCheckout] = useState<{ plan: 'plus' | 'pro'; cycle: 'monthly' | 'annual' } | null>(null);
  const [cpf, setCpf] = useState('');
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const toast = useToast();
  const live = sub?.subscriptions.find((s) => s.status === 'active' || s.status === 'past_due');
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Plano atual: {PLAN[usage?.plan ?? 'free']}</h2>{usage?.until && <Badge>{usage.source === 'grant' ? 'Acesso temporário' : 'Assinatura'} até {fmtDate(usage.until)}</Badge>}</div>
        <ul className="mt-3 space-y-2">{usage?.resources.map((r) => (
          <li key={r.resource} className="text-sm"><div className="mb-1 flex justify-between"><span className="capitalize">{r.label}</span><span className="tabular-nums text-muted">{r.limit === null ? `${r.used} · ilimitado` : `${r.used}/${r.limit}`}</span></div>{r.limit !== null && <Progress value={(r.used / Math.max(1, r.limit)) * 100} label={r.label} />}</li>
        ))}</ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Assinatura</h2>
        {!sub?.paymentsEnabled && <p className="rounded-lg bg-surface-2 p-3 text-sm">Pagamentos ainda não estão habilitados nesta versão. Os preços estão em definição — nenhuma cobrança é feita.</p>}
        {live ? (
          <div className="space-y-2 text-sm">
            <p>{PLAN[live.plan_code]} ({live.cycle === 'monthly' ? 'mensal' : 'anual'}) — {live.status === 'past_due' ? 'pagamento pendente (tolerância de 3 dias)' : live.cancel_at_period_end ? `cancelada; acesso até ${fmtDate(live.current_period_end)}` : `renova em ${fmtDate(live.current_period_end)}`}</p>
            {live.scheduled_plan_code && <p>Mudança agendada para {PLAN[live.scheduled_plan_code]} no fim do período.</p>}
            <div className="flex flex-wrap gap-2">
              {live.plan_code === 'plus' && <Button size="sm" onClick={() => setCheckout({ plan: 'pro', cycle: live.cycle as 'monthly' })}>Mudar para Pro</Button>}
              {live.plan_code === 'pro' && !live.scheduled_plan_code && <Button size="sm" variant="secondary" onClick={async () => { try { await api('/api/subscription', { body: { action: 'downgrade', plan: 'plus' } }); reload(); } catch (e) { toast('error', (e as Error).message); } }}>Mudar para Plus no fim do período</Button>}
              {!live.cancel_at_period_end && <Button size="sm" variant="secondary" onClick={async () => { if (!confirm('Cancelar a renovação? Você mantém o acesso até o fim do período e seu histórico é preservado.')) return; try { await api('/api/subscription', { body: { action: 'cancel' } }); reload(); } catch (e) { toast('error', (e as Error).message); } }}>Cancelar renovação</Button>}
              {live.first_paid_at && now - Date.parse(live.first_paid_at) < 7 * 864e5 && <Button size="sm" variant="danger" onClick={async () => { if (!confirm('Exercer o direito de arrependimento (7 dias) com reembolso integral? O acesso pago termina agora.')) return; try { await api('/api/subscription', { body: { action: 'cancel', withdrawal: true } }); reload(); } catch (e) { toast('error', (e as Error).message); } }}>Arrependimento (reembolso)</Button>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(['plus', 'pro'] as const).flatMap((p) => (['monthly', 'annual'] as const).map((c) => <Button key={p + c} size="sm" variant="secondary" disabled={!sub?.paymentsEnabled} onClick={() => setCheckout({ plan: p, cycle: c })}>{PLAN[p]} {c === 'monthly' ? 'mensal' : 'anual'}</Button>))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <Input label="Cupom de acesso" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={32} />
          <Button variant="secondary" disabled={coupon.trim().length < 3} onClick={async () => { try { const r = await api<{ plan: string; days: number }>('/api/coupons/redeem', { body: { code: coupon } }); toast('success', `Acesso ${PLAN[r.plan]} por ${r.days} dias ativado.`); setCoupon(''); reload(); } catch (e) { toast('error', (e as Error).message); } }}>Aplicar</Button>
        </div>
        {sub?.payments.length ? <details><summary className="cursor-pointer text-sm">Histórico de pagamentos</summary><ul className="mt-2 space-y-1 text-sm">{sub.payments.map((p) => <li key={p.provider_payment_id} className="flex justify-between"><span>{fmtDate(p.due_date)} · {(p.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><span className="text-muted">{p.status}</span></li>)}</ul></details> : null}
      </Card>
      <Modal open={Boolean(checkout)} onClose={() => setCheckout(null)} title="Contratar plano">
        <div className="space-y-3">
          <p className="text-sm">O pagamento é feito na página segura do Asaas. O NEXO não armazena dados de cartão. O CPF é enviado apenas ao Asaas para emissão da cobrança.</p>
          <Input label="CPF do titular do pagamento" value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" />
          <Button loading={busy} onClick={async () => {
            if (!checkout) return; setBusy(true);
            try { const r = await api<{ checkoutUrl: string }>('/api/subscription', { body: { action: 'checkout', ...checkout, cpf } }); window.location.href = r.checkoutUrl; }
            catch (e) { toast('error', e instanceof ApiError ? e.message : 'Falha.'); setBusy(false); }
          }}>Ir para o pagamento</Button>
        </div>
      </Modal>
    </div>
  );
}

function SecurityTab() {
  const { data, reload } = useApi<{ enrolled: boolean; aal: string }>('/api/auth/mfa');
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const toast = useToast();
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Autenticação multifator (opcional para estudantes)</h2>
      {data?.enrolled ? <p className="text-sm">Ativada. Sessão atual: {data.aal === 'aal2' ? 'verificada com MFA' : 'sem verificação MFA'}.</p> : !secret ? (
        <Button variant="secondary" onClick={async () => { try { setSecret(await api('/api/auth/mfa', { body: { action: 'enroll' } })); } catch (e) { toast('error', (e as Error).message); } }}>Configurar aplicativo autenticador</Button>
      ) : (
        <div className="space-y-2 text-sm"><p>Adicione esta chave no seu aplicativo autenticador:</p><code className="block break-all rounded bg-surface-2 p-2" data-testid="totp-secret">{secret.secret}</code></div>
      )}
      {(secret || (data?.enrolled && data.aal !== 'aal2')) && (
        <div className="flex items-end gap-2"><Input label="Código de 6 dígitos" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
          <Button onClick={async () => { try { await api('/api/auth/mfa', { body: { action: 'verify', code } }); toast('success', 'MFA verificado.'); setSecret(null); setCode(''); reload(); } catch (e) { toast('error', (e as Error).message); } }}>Verificar</Button></div>
      )}
    </Card>
  );
}

function DataTab() {
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();
  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h2 className="font-semibold">Seus dados (LGPD)</h2>
        <p className="text-sm text-muted">Baixe uma cópia dos seus dados, solicite correções ou exclua sua conta. Cancelar a assinatura não exclui a conta.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2">Baixar meus dados (JSON)</a>
          <Button variant="secondary" onClick={async () => { const d = prompt('Descreva a correção ou solicitação de acesso:'); if (!d) return; try { await api('/api/me/data-requests', { body: { kind: 'correction', details: d } }); toast('success', 'Solicitação registrada.'); } catch (e) { toast('error', (e as Error).message); } }}>Solicitar correção</Button>
        </div>
      </Card>
      <Card className="space-y-2 border-danger/40">
        <h2 className="font-semibold text-danger">Excluir conta</h2>
        <p className="text-sm text-muted">Remove seus dados pessoais e pedagógicos. Registros financeiros são mantidos sem vínculo pessoal pelo prazo legal.</p>
        <Button variant="danger" onClick={() => setDel(true)}>Excluir minha conta</Button>
      </Card>
      <Modal open={del} onClose={() => setDel(false)} title="Excluir conta definitivamente">
        <div className="space-y-3">
          <Input label='Digite "EXCLUIR" para confirmar' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <Input label="Senha atual" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button variant="danger" disabled={confirmText !== 'EXCLUIR' || !password} onClick={async () => {
            try { await api('/api/me/delete', { body: { confirm: 'EXCLUIR', password } }); window.location.assign(window.location.origin); } catch (e) { toast('error', (e as Error).message); }
          }}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}

function Settings() {
  const initial = useSearchParams().get('aba');
  const [tab, setTab] = useState<'profile' | 'plan' | 'security' | 'data'>(initial === 'plano' ? 'plan' : 'profile');
  return (
    <div>
      <PageHeader title="Configurações" />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'profile', label: 'Perfil e aparência' }, { value: 'plan', label: 'Plano e limites' }, { value: 'security', label: 'Segurança' }, { value: 'data', label: 'Privacidade e dados' }]} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<Loading />}><Settings /></Suspense>;
}
