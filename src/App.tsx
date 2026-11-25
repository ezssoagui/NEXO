import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import Welcome from './pages/Welcome';
import Onboarding from './pages/Onboarding';
import { startSync } from './services/sync';
startSync();

const Diagnostico = lazy(() => import('./pages/Diagnostico'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trilha = lazy(() => import('./pages/Trilha'));
const Questoes = lazy(() => import('./pages/Questoes'));
const Resolver = lazy(() => import('./pages/Resolver'));
const Tutor = lazy(() => import('./pages/Tutor'));
const Redacao = lazy(() => import('./pages/Redacao'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const Simulados = lazy(() => import('./pages/Simulados'));
const Desempenho = lazy(() => import('./pages/Desempenho'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Planos = lazy(() => import('./pages/Planos'));
const Admin = lazy(() => import('./pages/Admin'));
const Sessao = lazy(() => import('./pages/Sessao'));

export default function App() {
  const profile = useStore((s) => s.profile);
  const dark = useStore((s) => s.settings.dark);
  const loc = useLocation();
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const fallback = <div className="muted p-10 text-center text-sm">Carregando…</div>;

  if (!profile) return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/cadastro" element={<Onboarding />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
  if (loc.pathname === '/diagnostico') return <Suspense fallback={fallback}><Diagnostico /></Suspense>;
  return (
    <Layout>
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="/inicio" element={<Dashboard />} />
          <Route path="/trilha" element={<Trilha />} />
          <Route path="/questoes" element={<Questoes />} />
          <Route path="/questoes/:id" element={<Resolver />} />
          <Route path="/tutor" element={<Tutor />} />
          <Route path="/redacao" element={<Redacao />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/simulados" element={<Simulados />} />
          <Route path="/desempenho" element={<Desempenho />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/sessao" element={<Sessao />} />
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
