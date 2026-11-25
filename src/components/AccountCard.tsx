import { useState } from 'react';
import { useStore } from '../store/useStore';
import { connect, disconnect, push } from '../services/sync';

/** Conta opcional para guardar o progresso no backend da NEXO. */
export default function AccountCard() {
  const account = useStore((s) => s.account); const demo = useStore((s) => s.demo); const notify = useStore((s) => s.notify); const nickname = useStore((s) => s.profile?.nickname ?? '');
  const [mode, setMode] = useState<'login' | 'register'>('register'); const [nick, setNick] = useState(nickname); const [pass, setPass] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const msg = (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível concluir.');
  if (demo) return <p className="muted text-sm">Contas ficam indisponíveis com dados demonstrativos.</p>;
  if (account) return <section className="card"><h2 className="section-title">Progresso salvo no servidor</h2><p className="muted text-sm">{account.nickname}</p><div className="mt-3 flex gap-2"><button className="btn-ghost btn-sm" onClick={() => push().then(() => notify('Sincronizado.')).catch((e) => notify(msg(e)))}>Sincronizar</button><button className="btn-ghost btn-sm" onClick={() => disconnect().then(() => notify('Conta desconectada.'))}>Desconectar</button></div></section>;
  return (
    <section className="card"><h2 className="section-title">Guardar em uma conta <span className="muted font-normal">(opcional)</span></h2><p className="muted mt-1 text-sm">Apelido e senha, sem e-mail. Requer o servidor em execução.</p>
      <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await connect(mode, nick, pass); notify('Conta conectada.'); } catch (x) { setErr(msg(x)); } finally { setBusy(false); } }}>
        <div><label className="sr-only" htmlFor="acc-n">Apelido</label><input id="acc-n" className="input" placeholder="Apelido" value={nick} onChange={(e) => setNick(e.target.value)} /></div><div><label className="sr-only" htmlFor="acc-p">Senha</label><input id="acc-p" className="input" type="password" placeholder="Senha (mín. 8)" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div><button className="btn-ghost" disabled={busy}>{busy ? 'Aguarde…' : mode === 'register' ? 'Criar conta' : 'Entrar'}</button>
      </form>{err && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{err}</p>}<button className="link mt-2 text-xs" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Já tenho conta' : 'Criar conta nova'}</button>
    </section>
  );
}
