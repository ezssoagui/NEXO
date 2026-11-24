import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import Welcome from './pages/Welcome';
import Onboarding from './pages/Onboarding';
import Inicio from './pages/Inicio';
import { Toast } from './components/ui';
import { startSync } from './services/sync';
startSync();

const Percurso = lazy(() => import('./pages/Percurso'));
const Conteudos = lazy(() => import('./pages/Conteudos'));
const Bloco = lazy(() => import('./pages/Bloco'));
const Habilidade = lazy(() => import('./pages/Habilidade'));
const Aula = lazy(() => import('./pages/Aula'));
const Questoes = lazy(() => import('./pages/Questoes'));
const Resolver = lazy(() => import('./pages/Resolver'));
const Atividade = lazy(() => import('./pages/Atividade'));
const Revisoes = lazy(() => import('./pages/Revisoes'));
const Redacao = lazy(() => import('./pages/Redacao'));
const Simulados = lazy(() => import('./pages/Simulados'));
const Professor = lazy(() => import('./pages/Professor'));
const Desempenho = lazy(() => import('./pages/Desempenho'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Sessao = lazy(() => import('./pages/Sessao'));
const Diagnostico = lazy(() => import('./pages/Diagnostico'));
const Single = { Explicar: lazy(() => import('./pages/Praticas').then((m) => ({ default: m.Explicar }))), Comparar: lazy(() => import('./pages/Praticas').then((m) => ({ default: m.Comparar }))), Gemea: lazy(() => import('./pages/Praticas').then((m) => ({ default: m.Gemea }))) };

export default function App() {
  const profile = useStore((s) => s.profile); const dark = useStore((s) => s.settings.dark); const loc = useLocation();
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  if (!profile) return <><Routes><Route path="/" element={<Welcome />} /><Route path="/comecar" element={<Onboarding />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes><Toast /></>;
  return (
    <Layout>
      <Suspense fallback={<p className="muted py-10 text-sm">Carregando…</p>}>
        <Routes>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/percurso" element={<Percurso />} />
          <Route path="/conteudos" element={<Conteudos />} />
          <Route path="/conteudos/habilidade/:id" element={<Habilidade />} />
          <Route path="/conteudos/:id" element={<Bloco />} />
          <Route path="/aulas/:id" element={<Aula />} />
          <Route path="/questoes" element={<Questoes />} />
          <Route path="/questoes/:id" element={<Resolver />} />
          <Route path="/atividade/:id" element={<Atividade />} />
          <Route path="/revisoes" element={<Revisoes />} />
          <Route path="/redacao" element={<Redacao />} />
          <Route path="/simulados" element={<Simulados />} />
          <Route path="/professor" element={<Professor />} />
          <Route path="/desempenho" element={<Desempenho />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/sessao/:id" element={<Sessao />} />
          <Route path="/diagnostico" element={<Diagnostico />} />
          <Route path="/explicar/:skillId" element={<Single.Explicar />} />
          <Route path="/comparar/:id" element={<Single.Comparar />} />
          <Route path="/gemea/:skillId" element={<Single.Gemea />} />
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
