import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { nextExamYear } from '../store/demoStudent';
import { Logo } from '../components/ui';

/** Cadastro mínimo: sem diagnóstico obrigatório; o NEXO conhece o estudante conforme o uso. */
export default function Onboarding() {
  const nav = useNavigate(); const create = useStore((s) => s.createProfile); const y = nextExamYear();
  const [p, setP] = useState({ nickname: '', course: '', examYear: y, weeklyHours: 8 });
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <button onClick={() => nav('/')} aria-label="Voltar"><Logo /></button>
      <h1 className="mt-10 text-2xl font-semibold">Vamos começar</h1>
      <p className="muted mt-1 text-sm">Nenhuma prova inicial. Você escolhe por onde entrar.</p>
      <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); create({ ...p, nickname: p.nickname.trim(), course: p.course.trim(), goal: 'ENEM' }); nav('/inicio'); }}>
        <div><label className="label" htmlFor="nick">Apelido</label><input id="nick" className="input" maxLength={20} required minLength={2} value={p.nickname} onChange={(e) => setP({ ...p, nickname: e.target.value })} /></div>
        <div><label className="label" htmlFor="course">Curso pretendido <span className="muted font-normal">(opcional)</span></label><input id="course" className="input" value={p.course} onChange={(e) => setP({ ...p, course: e.target.value })} /></div>
        <div><label className="label" htmlFor="year">Ano da prova</label><select id="year" className="input" value={p.examYear} onChange={(e) => setP({ ...p, examYear: +e.target.value })}>{[0, 1, 2, 3].map((i) => <option key={i} value={y + i}>{y + i}</option>)}</select></div>
        <div><label className="label" htmlFor="h">Tempo por semana: {p.weeklyHours} h</label><input id="h" type="range" min={2} max={40} value={p.weeklyHours} onChange={(e) => setP({ ...p, weeklyHours: +e.target.value })} className="w-full accent-brand-600" /></div>
        <button className="btn-primary w-full" disabled={p.nickname.trim().length < 2}>Entrar</button>
      </form>
      <p className="muted mt-6 text-xs">Use só um apelido. Não pedimos nome, e-mail ou documento.</p>
    </div>
  );
}
