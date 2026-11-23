import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldCheck, FileClock } from 'lucide-react';
import { LESSONS } from '../data/lessons';
import { SUBJECTS, SUBJECT_COLORS } from '../data/skills';
import { PageHeader, Badge, cx } from '../components/ui';

export default function Aulas() {
  const [sub, setSub] = useState(''); const [lvl, setLvl] = useState('');
  const list = LESSONS.filter((l) => (!sub || l.subject === sub) && (!lvl || l.level === lvl));
  return (
    <div>
      <PageHeader title="Aulas e materiais" subtitle="Microaulas interativas em texto estruturado, com perguntas curtas durante a explicação. Sem exigir vídeo — mais leve e acessível." />
      <div className="mb-5 flex flex-wrap gap-2">
        {['', ...SUBJECTS].map((s) => <button key={s} onClick={() => setSub(s)} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', sub === s ? 'border-navy-800 bg-navy-800 text-white dark:bg-mint-500 dark:text-navy-950' : 'border-slate-300 dark:border-navy-700')}>{s || 'Todas'}</button>)}
        <select aria-label="Nível" className="input !w-auto !py-1.5 text-xs" value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">Todos os níveis</option><option>Fundamentos</option><option>Intermediário</option><option>Avançado</option></select>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="card !p-4"><div className="font-semibold">Trilha de fundamentos</div><p className="muted text-sm">Para quem tem lacunas escolares: {LESSONS.filter((l) => l.level === 'Fundamentos').length} aulas de base.</p><button className="btn-ghost btn-sm mt-2" onClick={() => setLvl('Fundamentos')}>Ver trilha</button></div>
        <div className="card !p-4"><div className="font-semibold">Trilha avançada</div><p className="muted text-sm">Vestibulares e olimpíadas: aulas intermediárias + problemas abertos no banco.</p><button className="btn-ghost btn-sm mt-2" onClick={() => setLvl('Intermediário')}>Ver trilha</button></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((l) => (
          <Link key={l.id} to={`/aulas/${l.id}`} className="card group !p-0 transition hover:shadow-md">
            <div className="h-1.5 rounded-t-2xl" style={{ background: SUBJECT_COLORS[l.subject] }} />
            <div className="p-5">
              <div className="flex flex-wrap gap-2"><Badge>{l.subject}</Badge><Badge tone="navy">{l.level}</Badge></div>
              <h2 className="mt-3 text-base font-bold group-hover:text-mint-700 dark:group-hover:text-mint-400">{l.title}</h2>
              <p className="muted mt-1 line-clamp-3 text-sm">{l.micro}</p>
              <div className="muted mt-4 flex items-center gap-3 text-xs"><span className="flex items-center gap-1"><Clock size={12} /> {l.minutes} min</span>{l.origin === 'curado' ? <span className="flex items-center gap-1 text-mint-700 dark:text-mint-400"><ShieldCheck size={12} /> Revisado (equipe demo)</span> : <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400"><FileClock size={12} /> Rascunho de IA em revisão</span>}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
