import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Download, Trash2, ShieldCheck, Lock, Eye } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PageHeader, Card, Badge, Modal, Progress } from '../components/ui';
import { USAGE_LABEL, estimatedCost, type UsageKind } from '../engine/billing';
import AccountCard from '../components/AccountCard';
import { deleteServer } from '../services/sync';

export default function Perfil() {
  const s = useStore(); const nav = useNavigate();
  const [del, setDel] = useState(false); const [confirm, setConfirm] = useState('');
  const p = s.profile!;
  const exportData = () => { const { toast, ...data } = useStore.getState() as any; const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), aviso: 'Dados de demonstração armazenados localmente', ...Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v !== 'function')) }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nexo-meus-dados.json'; a.click(); };
  const Toggle = ({ k, label, desc }: { k: 'rankingOptIn' | 'publicProfile' | 'portfolioPublic' | 'timer'; label: string; desc: string }) => <label className="flex items-start justify-between gap-4 py-3"><span><span className="font-medium">{label}</span><span className="muted block text-xs">{desc}</span></span><input type="checkbox" className="mt-1 h-5 w-5 accent-mint-500" checked={!!s.settings[k]} onChange={(e) => s.setSetting(k, e.target.checked)} /></label>;
  return (
    <div className="space-y-5">
      <PageHeader title="Perfil" subtitle="Seus dados, sua privacidade e seu plano." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><h2 className="section-title mb-3">Dados do estudante</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">{[['Apelido', p.nickname], ['Etapa', p.grade], ['Tipo de escola', { federal: 'Instituto federal', publica: 'Pública', particular: 'Particular', outra: 'Outra' }[p.schoolType]], ['Instituição', p.institution || 'Não informada'], ['Objetivo', p.goal], ['Curso pretendido', p.course], ['Dificuldades', p.difficulties.join(', ')], ['Tempo semanal', `${p.weeklyHours} h`], ['Ano da prova', p.examYear], ['Meta pessoal', p.personalGoal || '—']].map(([k, v]) => <div key={k as string}><dt className="muted text-xs">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          {p.persona && p.persona !== 'custom' && <p className="mt-4"><Badge tone="amber">Perfil fictício de demonstração</Badge></p>}
          <p className="muted mt-3 text-xs">O vínculo com instituição é autodeclarado e não foi verificado.</p>
        </Card>
        <Card><h2 className="section-title mb-2">Plano</h2><div className="font-display text-2xl font-bold">{s.plan === 'plus' ? 'NEXO Plus' : 'NEXO Free'}</div><Link to="/planos" className="btn-ghost btn-sm mt-2">Comparar planos</Link>
          <h3 className="mt-4 text-sm font-semibold">Consumo de IA neste mês (simulado)</h3>{(Object.keys(USAGE_LABEL) as UsageKind[]).map((k) => <div key={k} className="mt-2"><div className="flex justify-between text-xs"><span>{USAGE_LABEL[k]}</span><span>{s.usage[k]}/{s.limits[s.plan][k]}</span></div><Progress value={s.usage[k] / s.limits[s.plan][k]} /></div>)}<p className="muted mt-2 text-xs">Custo variável estimado: R$ {estimatedCost(s.usage).toFixed(2)} (fictício)</p></Card>
      </div>
      <AccountCard />
      <Card><h2 className="section-title mb-1">Preferências de estudo</h2><p className="muted mb-3 text-sm">Você controla quanto apoio recebe. Pedir a explicação direta é sempre possível.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="aut">Autonomia e dicas</label><select id="aut" className="input" value={s.settings.autonomy} onChange={(e) => s.setSetting('autonomy', e.target.value as any)}><option value="mais_autonomia">Mais autonomia (até 1 dica por questão)</option><option value="equilibrado">Equilibrado (até 3 dicas)</option><option value="mais_apoio">Mais apoio (dicas e explicações mais cedo)</option></select></div>
          <div><label className="label" htmlFor="conf">Perguntar minha confiança</label><select id="conf" className="input" value={s.settings.confidencePrompt} onChange={(e) => s.setSetting('confidencePrompt', e.target.value as any)}><option value="adaptativo">Adaptativo (oculto em habilidades já dominadas; sempre opcional)</option><option value="sempre">Sempre mostrar (opcional)</option><option value="nunca">Nunca perguntar</option></select></div>
        </div>
      </Card>
      <Card><div className="mb-2 flex items-center gap-2"><ShieldCheck className="text-mint-600" size={18} /><h2 className="section-title">Privacidade e LGPD</h2></div>
        <div className="divide-y divide-slate-100 dark:divide-navy-800">
          <Toggle k="publicProfile" label="Perfil público" desc="Desligado por padrão. Quando ligado, apenas apelido, nível e conquistas aparecem para colegas de equipe." />
          <Toggle k="rankingOptIn" label="Participar de rankings" desc="Contribui de forma agregada para o índice da sua escola. Notas individuais nunca são exibidas." />
          <Toggle k="portfolioPublic" label="Permitir compartilhar portfólio" desc="Necessário para gerar o link do Meu Portfólio de Evolução." />
          <Toggle k="timer" label="Cronômetro ligado por padrão nas questões" desc="Preferência de estudo." />
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-950"><Lock size={16} /><div className="mt-1 font-semibold">Coleta mínima</div><p className="muted text-xs">Sem nome completo, documento, e-mail ou foto nesta demo.</p></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-950"><Eye size={16} /><div className="mt-1 font-semibold">Sem venda de dados</div><p className="muted text-xs">Dados de estudantes não são comercializados nem usados para publicidade.</p></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-950"><ShieldCheck size={16} /><div className="mt-1 font-semibold">Acesso por papel</div><p className="muted text-xs">A administração vê apenas dados agregados e pseudonimizados.</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><button className="btn-ghost" onClick={exportData}><Download size={16} /> Exportar meus dados (JSON)</button><button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => setDel(true)}><Trash2 size={16} /> Excluir conta e dados</button></div>
      </Card>
      <Modal open={del} onClose={() => setDel(false)} title="Excluir conta e todos os dados">
        <p className="text-sm">Isso apaga permanentemente seu perfil, histórico, flashcards, redações e XP deste navegador — e também do servidor, se houver conta conectada. Digite <strong>EXCLUIR</strong> para confirmar.</p>
        <input aria-label="Confirmação" className="input mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button className="btn mt-3 bg-red-600 text-white hover:bg-red-700" disabled={confirm !== 'EXCLUIR'} onClick={async () => { try { await deleteServer(); } catch { /* sem backend: apaga só local */ } s.deleteAll(); nav('/'); }}>Excluir definitivamente</button>
      </Modal>
    </div>
  );
}
