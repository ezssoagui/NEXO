import { useNavigate } from 'react-router-dom';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DEMO_PROFILES, loadDemo } from '../store/demoStudent';
import { Logo } from '../components/ui';

export default function Welcome() {
  const nav = useNavigate(); const dark = useStore((s) => s.settings.dark); const setSetting = useStore((s) => s.setSetting);
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-6"><Logo /><button className="btn-quiet" onClick={() => setSetting('dark', !dark)} aria-label="Alternar tema">{dark ? <Sun size={17} /> : <Moon size={17} />}</button></header>
      <main className="flex flex-1 flex-col justify-center py-12">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">O currículo é completo.<br />O percurso é seu.</h1>
        <p className="muted mt-5 max-w-xl text-lg leading-relaxed">O NEXO conhece você aos poucos, conforme estuda, e organiza a preparação para o ENEM em torno do que você já demonstrou.</p>
        <div className="mt-9"><button className="btn-primary !px-5 !py-2.5" onClick={() => nav('/comecar')}>Começar com perfil vazio <ArrowRight size={16} /></button></div>
        <section className="mt-16 border-t border-ink-200 pt-8 dark:border-ink-800">
          <h2 className="text-sm font-semibold">Ou explore com dados demonstrativos</h2>
          <p className="muted mt-1 text-sm">Históricos fictícios, identificados em todas as telas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{(Object.keys(DEMO_PROFILES) as (keyof typeof DEMO_PROFILES)[]).map((k) => <button key={k} className="card text-left transition-colors hover:border-ink-300 dark:hover:border-ink-600" onClick={() => { loadDemo(k); nav('/inicio'); }}><span className="font-medium">{DEMO_PROFILES[k].label}</span><span className="muted mt-1 block text-sm">{DEMO_PROFILES[k].desc}</span></button>)}</div>
        </section>
      </main>
      <footer className="muted py-6 text-xs">Protótipo. Os dados ficam apenas neste navegador. Sem provedor de IA conectado, as interações de IA são simuladas por regras e identificadas.</footer>
    </div>
  );
}
