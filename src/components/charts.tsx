import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from 'recharts';
import type { Attempt } from '../types';
import { allMastery, MASTERY_COLOR, MASTERY_LABEL, solid } from '../engine/mastery';
import { SUBJECTS } from '../data/skills';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

const DAY = 86400000;
export function evolutionSeries(attempts: Attempt[], days = 14) {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const end = now - (days - 1 - i) * DAY; const startW = end - 7 * DAY;
    const win = attempts.filter((a) => a.ts <= end && a.ts > startW);
    const d = new Date(end);
    return { dia: `${d.getDate()}/${d.getMonth() + 1}`, acerto: win.length ? Math.round((win.filter((a) => a.correct).length / win.length) * 100) : null, solidos: win.filter(solid).length };
  });
}

function useAxisColor() { return useStore((s) => s.settings.dark) ? '#94a3b8' : '#64748b'; }

export function EvolutionChart({ attempts }: { attempts: Attempt[] }) {
  const data = evolutionSeries(attempts); const c = useAxisColor();
  return (
    <div className="h-56" role="img" aria-label="Gráfico de evolução: taxa de acerto e acertos sólidos em janela móvel de 7 dias">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c} strokeOpacity={0.2} />
          <XAxis dataKey="dia" tick={{ fontSize: 11, fill: c }} interval={2} />
          <YAxis yAxisId="l" tick={{ fontSize: 11, fill: c }} domain={[0, 100]} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: c }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="l" type="monotone" dataKey="acerto" name="Taxa de acerto (%)" stroke="#2f5494" strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
          <Line yAxisId="r" type="monotone" dataKey="solidos" name="Acertos sólidos (7 dias)" stroke="#14b88d" strokeWidth={2.5} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SubjectRadar({ data }: { data: { subject: string; mastery: number; accuracy: number }[] }) {
  const c = useAxisColor();
  return (
    <div className="h-64" role="img" aria-label="Radar de domínio por disciplina">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={c} strokeOpacity={0.3} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: c }} />
          <Radar name="Habilidades em domínio (%)" dataKey="mastery" stroke="#14b88d" fill="#14b88d" fillOpacity={0.3} />
          <Radar name="Acerto (%)" dataKey="accuracy" stroke="#2f5494" fill="#2f5494" fillOpacity={0.12} />
          <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkillMap({ attempts, compact }: { attempts: Attempt[]; compact?: boolean }) {
  const m = allMastery(attempts);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs">{(Object.keys(MASTERY_LABEL) as (keyof typeof MASTERY_LABEL)[]).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: MASTERY_COLOR[k] }} />{MASTERY_LABEL[k]}</span>)}</div>
      <div className="space-y-3">
        {SUBJECTS.map((sub) => (
          <div key={sub}><div className="muted mb-1 text-xs font-semibold">{sub}</div>
            <div className="flex flex-wrap gap-1.5">{m.filter((x) => x.skill.subject === sub).map((x) => (
              <Link key={x.skillId} to={`/questoes?skill=${x.skillId}`} title={`${x.skill.name}: ${MASTERY_LABEL[x.state]}\n${x.reasons.join('\n')}`} className={compact ? 'h-6 w-6 rounded-md ring-offset-1 hover:ring-2 hover:ring-navy-400' : 'rounded-lg px-2.5 py-1.5 text-xs font-medium ring-offset-1 hover:ring-2 hover:ring-navy-400'} style={{ background: MASTERY_COLOR[x.state] + (compact ? '' : '33'), borderLeft: compact ? undefined : `3px solid ${MASTERY_COLOR[x.state]}` }}>
                {!compact && x.skill.name}<span className="sr-only">{x.skill.name}: {MASTERY_LABEL[x.state]}</span>
              </Link>
            ))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
