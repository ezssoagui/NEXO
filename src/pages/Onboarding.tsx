import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import type { Profile, Subject } from '../types';
import { useStore } from '../store/useStore';
import { loadStudentWithHistory } from '../store/demoStudent';
import { SUBJECTS } from '../data/skills';
import { SCHOOLS } from '../data/demo';
import { Logo, cx, Progress } from '../components/ui';

export default function Onboarding() {
  const nav = useNavigate(); const createProfile = useStore((s) => s.createProfile);
  const [step, setStep] = useState(0);
  const [withHistory, setWithHistory] = useState(true);
  const [p, setP] = useState<Profile>({ nickname: '', grade: '3º ano do ensino médio', schoolType: 'publica', institution: '', goal: 'ENEM', course: '', difficulties: [], weeklyHours: 6, examYear: new Date().getFullYear() + 1, personalGoal: '' });
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  const steps = ['Sobre você', 'Escola', 'Objetivo', 'Rotina e metas'];
  const valid = [p.nickname.trim().length >= 2, true, p.course.trim().length >= 2, p.difficulties.length > 0];
  const finish = () => {
    if (withHistory) { loadStudentWithHistory({ ...p, persona: 'custom' }); nav('/inicio'); }
    else { createProfile(p); nav('/diagnostico'); }
  };
  const Opt = ({ active, onClick, children }: any) => <button type="button" onClick={onClick} aria-pressed={active} className={cx('rounded-xl border px-4 py-3 text-left text-sm font-medium transition', active ? 'border-mint-500 bg-mint-50 text-navy-900 dark:bg-mint-500/10 dark:text-white' : 'border-slate-200 hover:border-slate-300 dark:border-navy-700')}>{children}</button>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-navy-950">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between"><Logo /><span className="muted text-xs">Passo {step + 1} de 4</span></div>
        <Progress value={(step + 1) / 4} className="mb-6" label="Progresso do cadastro" />
        <div className="card !p-6">
          <h1 className="text-2xl font-bold">{steps[step]}</h1>
          <div className="mt-2 flex gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-200"><Info size={14} className="mt-0.5 shrink-0" />Use apenas um apelido. Não pedimos nome completo, e-mail, CPF ou foto. Na demonstração, tudo fica só no seu navegador.</div>
          <div className="mt-5 space-y-4">
            {step === 0 && <>
              <div><label className="label" htmlFor="nick">Apelido</label><input id="nick" className="input" maxLength={20} value={p.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Ex.: Lu, JP, Nanda" /></div>
              <div><label className="label" htmlFor="grade">Série ou etapa</label><select id="grade" className="input" value={p.grade} onChange={(e) => set('grade', e.target.value)}>{['9º ano do fundamental', '1º ano do ensino médio', '2º ano do ensino médio', '3º ano do ensino médio', 'Ensino médio concluído', 'Cursinho / pré-vestibular'].map((g) => <option key={g}>{g}</option>)}</select></div>
            </>}
            {step === 1 && <>
              <div className="label">Tipo de escola</div>
              <div className="grid grid-cols-2 gap-2">{[['federal', 'Instituto federal'], ['publica', 'Pública estadual/municipal'], ['particular', 'Particular'], ['outra', 'Outra']].map(([v, l]) => <Opt key={v} active={p.schoolType === v} onClick={() => set('schoolType', v as any)}>{l}</Opt>)}</div>
              <div><label className="label" htmlFor="inst">Instituição (opcional)</label>
                <select id="inst" className="input" value={p.schoolId ?? ''} onChange={(e) => { const s = SCHOOLS.find((x) => x.id === e.target.value); setP({ ...p, schoolId: s?.id, institution: s ? `${s.name} (fictícia)` : '' }); }}>
                  <option value="">Prefiro não informar</option>{SCHOOLS.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.category} (fictícia)</option>)}
                </select>
                <p className="muted mt-1 text-xs">O vínculo informado não é verificado institucionalmente. Serve só para rankings opcionais e grupos.</p></div>
            </>}
            {step === 2 && <>
              <div className="label">Objetivo principal</div>
              <div className="grid grid-cols-2 gap-2">{(['ENEM', 'Vestibular', 'Olimpíadas', 'Combinada'] as const).map((g) => <Opt key={g} active={p.goal === g} onClick={() => set('goal', g)}>{g === 'Combinada' ? 'Preparação combinada' : g}</Opt>)}</div>
              <div><label className="label" htmlFor="course">Curso pretendido</label><input id="course" className="input" value={p.course} onChange={(e) => set('course', e.target.value)} placeholder="Ex.: Medicina, Engenharia, Direito" /></div>
              <div><label className="label" htmlFor="year">Ano da prova</label><select id="year" className="input" value={p.examYear} onChange={(e) => set('examYear', +e.target.value)}>{[0, 1, 2, 3].map((i) => <option key={i}>{new Date().getFullYear() + i}</option>)}</select></div>
            </>}
            {step === 3 && <>
              <div className="label">Áreas de maior dificuldade</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{SUBJECTS.map((s) => <Opt key={s} active={p.difficulties.includes(s)} onClick={() => set('difficulties', p.difficulties.includes(s) ? p.difficulties.filter((x) => x !== s) : [...p.difficulties, s as Subject])}>{s}</Opt>)}</div>
              <div><label className="label" htmlFor="hours">Tempo disponível: <strong>{p.weeklyHours} h por semana</strong></label><input id="hours" type="range" min={1} max={25} value={p.weeklyHours} onChange={(e) => set('weeklyHours', +e.target.value)} className="w-full accent-mint-500" /></div>
              <div><label className="label" htmlFor="goal">Meta pessoal</label><input id="goal" className="input" value={p.personalGoal} onChange={(e) => set('personalGoal', e.target.value)} placeholder="Ex.: dominar Física até junho" /></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-mint-500" checked={withHistory} onChange={(e) => setWithHistory(e.target.checked)} /><span>Começar com dados de exemplo<span className="muted block text-xs">3 semanas de histórico fictício. Desmarque para começar do zero, pelo diagnóstico.</span></span></label>
            </>}
          </div>
          <div className="mt-6 flex justify-between">
            <button className="btn-ghost" onClick={() => (step ? setStep(step - 1) : nav('/'))}><ArrowLeft size={16} /> Voltar</button>
            {step < 3 ? <button className="btn-primary" disabled={!valid[step]} onClick={() => setStep(step + 1)}>Continuar <ArrowRight size={16} /></button> : <button className="btn-primary" disabled={!valid[3]} onClick={finish}>{withHistory ? 'Criar perfil' : 'Ir para o diagnóstico'} <ArrowRight size={16} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}
