import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Brain, Target, PenLine, Layers, ShieldCheck, Moon, Sun } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PERSONAS } from '../store/seed';
import { loadDemoStudent } from '../store/demoStudent';
import { Logo } from '../components/ui';

export default function Welcome() {
  const nav = useNavigate();
  const { loginPersona, loginRole, settings, setSetting } = useStore();
  const enter = (p: keyof typeof PERSONAS) => { loginPersona(p); nav('/diagnostico'); };
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="[&_span]:!text-white"><Logo /></div>
        <button className="rounded-lg border border-white/20 p-2" onClick={() => setSetting('dark', !settings.dark)} aria-label="Alternar tema">{settings.dark ? <Sun size={16} /> : <Moon size={16} />}</button>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:pt-12">
        <div className="max-w-3xl animate-fadeUp">
          <span className="chip border border-amber-400/40 bg-amber-400/10 text-amber-200">Protótipo demonstrativo · dados fictícios · IA simulada localmente</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight !text-white sm:text-6xl">Aprender a <span className="text-mint-400">pensar</span>,<br />não a decorar respostas.</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">NEXO é uma plataforma de preparação para ENEM, vestibulares e olimpíadas que acompanha seu raciocínio: identifica o erro específico, explica, propõe uma questão gêmea e atualiza seu domínio.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn-primary !px-6 !py-3 !text-base" onClick={() => nav('/cadastro')}>Criar meu perfil <ArrowRight size={18} /></button>
            <button className="btn !border !border-mint-400/60 !px-6 !py-3 !text-base text-mint-300 hover:bg-white/10" onClick={() => { loadDemoStudent(); nav('/inicio'); }}><Sparkles size={18} /> Ver estudante com histórico (Marina)</button>
            <a href="#perfis" className="btn !border !border-white/25 !px-6 !py-3 !text-base text-white hover:bg-white/10">Explorar com perfil fictício</a>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[{ i: Brain, t: 'Diagnóstico do erro', d: 'Dez categorias de erro direcionam os próximos exercícios.' }, { i: Target, t: 'Questão gêmea', d: 'Mesmo conceito, novo contexto: verifica transferência.' }, { i: PenLine, t: 'Laboratório de redação', d: 'Feedback formativo pelas 5 competências.' }, { i: Layers, t: 'Repetição espaçada', d: 'Regras transparentes e Mapa de Esquecimento.' }].map(({ i: I, t, d }) => (
            <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5"><I className="text-mint-400" /><div className="mt-3 font-semibold">{t}</div><p className="mt-1 text-sm text-slate-400">{d}</p></div>
          ))}
        </div>

        <section id="perfis" className="mt-16">
          <h2 className="text-2xl font-bold !text-white">Começar com um perfil de exemplo</h2>
          <p className="mt-1 text-slate-400">O perfil apenas preenche o cadastro. Tudo começa zerado — sem histórico, XP, flashcards ou redações —, como um estudante que acabou de entrar.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(Object.keys(PERSONAS) as (keyof typeof PERSONAS)[]).map((k) => (
              <button key={k} onClick={() => enter(k)} className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-mint-400/60 hover:bg-white/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-500 font-bold text-navy-950">{PERSONAS[k].profile.nickname[0]}</div>
                <div className="mt-3 font-semibold">{PERSONAS[k].label}</div>
                <p className="mt-1 text-sm text-slate-400">{PERSONAS[k].desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-mint-400">Entrar <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn !border !border-white/20 text-white hover:bg-white/10" onClick={() => { loginPersona('avancado'); loginRole('admin'); useStore.getState().finishDiagnostic(); nav('/admin'); }}><ShieldCheck size={16} /> Painel administrativo (demo)</button>
          </div>
        </section>
        <p className="mt-16 text-xs text-slate-500">Nesta demonstração nenhum dado pessoal real é coletado: tudo fica salvo apenas no seu navegador (localStorage) e pode ser apagado em Perfil → Privacidade. Análises de “IA” são simulações por regras, identificadas como tal.</p>
      </main>
    </div>
  );
}
