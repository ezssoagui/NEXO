import { useState } from 'react';
import { Cloud, CloudOff, LogOut, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import { connect, disconnect, exportServer, push } from '../services/sync';
import { Card } from './ui';

/** Conta opcional para persistir o progresso no banco de dados do backend da NEXO. */
export default function AccountCard() {
  const { account, notify } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [nick, setNick] = useState(useStore.getState().profile?.nickname ?? ''); const [pass, setPass] = useState(''); const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  if (account) return (
    <Card><div className="flex flex-wrap items-center gap-3"><Cloud className="text-mint-600" size={20} /><div className="flex-1"><div className="font-semibold">Progresso salvo no servidor · {account.nickname} ({account.role === 'admin' ? 'administração' : 'estudante'})</div><p className="muted text-xs">{account.syncedAt ? `Última sincronização: ${new Date(account.syncedAt).toLocaleString('pt-BR')}` : 'Sincronizando…'}</p></div>
      <button className="btn-ghost btn-sm" onClick={() => push().then(() => notify('Sincronizado.')).catch((e) => notify(e.message))}>Sincronizar agora</button>
      <button className="btn-ghost btn-sm" onClick={async () => { try { const d = await exportServer(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'nexo-dados-servidor.json'; a.click(); } catch (e: any) { notify(e.message); } }}><Download size={14} /> Exportar do servidor</button>
      <button className="btn-ghost btn-sm" onClick={() => disconnect().then(() => notify('Conta desconectada; o progresso local continua neste navegador.'))}><LogOut size={14} /> Sair da conta</button></div></Card>
  );
  return (
    <Card><div className="mb-2 flex items-center gap-2"><CloudOff size={18} className="text-amber-500" /><h2 className="section-title">Salvo apenas neste navegador</h2></div>
      <p className="muted mb-3 text-sm">Crie uma conta para guardar seu histórico de aprendizagem no banco de dados do servidor da NEXO e continuar em outro dispositivo. Pedimos só um apelido e uma senha — nada de e-mail, CPF ou nome real. Requer o backend em execução (<code>npm run server</code>).</p>
      <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await connect(mode, nick, pass, code || undefined); notify(mode === 'register' ? 'Conta criada e progresso salvo no servidor.' : 'Conectado. Progresso sincronizado.'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}>
        <label className="sr-only" htmlFor="acc-nick">Apelido</label><input id="acc-nick" className="input" placeholder="Apelido" value={nick} onChange={(e) => setNick(e.target.value)} />
        <label className="sr-only" htmlFor="acc-pass">Senha</label><input id="acc-pass" className="input" type="password" placeholder="Senha (mín. 8)" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'register' ? <><label className="sr-only" htmlFor="acc-code">Código de administração (opcional)</label><input id="acc-code" className="input" placeholder="Código admin (opcional)" value={code} onChange={(e) => setCode(e.target.value)} /></> : <span />}
        <button className="btn-primary" disabled={busy}>{busy ? 'Aguarde…' : mode === 'register' ? 'Criar conta' : 'Entrar'}</button>
      </form>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button className="muted mt-2 text-xs underline" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Já tenho conta' : 'Criar conta nova'}</button>
    </Card>
  );
}
