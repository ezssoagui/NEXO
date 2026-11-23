import { Link } from 'react-router-dom';
import { Printer, Share2, Lock, Medal } from 'lucide-react';
import { useStore } from '../store/useStore';
import { allMastery, subjectStats } from '../engine/mastery';
import { achievements, levelInfo, totalXP, leagueOf, masteryPoints } from '../engine/gamification';
import { PageHeader, Card, Badge, Logo } from '../components/ui';
import { SubjectRadar } from '../components/charts';

export default function Portfolio() {
  const { profile, attempts, xpEvents, cardStates, essays, settings, notify } = useStore();
  const xp = totalXP(xpEvents); const m = allMastery(attempts);
  const dominated = m.filter((x) => x.state === 'consistente' || x.state === 'provisorio');
  const ach = achievements(attempts, xp, Object.values(cardStates).reduce((s, c) => s + c.reviews.length, 0), essays.filter((e) => e.versions.length > 1).length).filter((a) => a.got);
  const essayGain = essays.filter((e) => e.versions.length > 1).map((e) => (e.versions.at(-1)!.eval?.total ?? 0) - (e.versions[0].eval?.total ?? 0));
  return (
    <div>
      <PageHeader title="Meu Portfólio de Evolução" subtitle="Relatório visual das suas conquistas. Nada é publicado sem sua escolha explícita.">
        <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Imprimir / PDF</button>
        {settings.portfolioPublic ? <button className="btn-primary" onClick={() => notify('Link de compartilhamento gerado (simulação). Contém apenas apelido, habilidades e conquistas — sem notas.')}><Share2 size={16} /> Gerar link</button> : <Link to="/perfil" className="btn-ghost"><Lock size={16} /> Habilite o compartilhamento em Perfil</Link>}
      </PageHeader>
      <div className="mx-auto max-w-3xl space-y-4 print:max-w-none">
        <Card className="!bg-gradient-to-br !from-navy-900 !to-navy-700 !text-white"><div className="[&_span]:!text-white"><Logo /></div><h2 className="mt-4 text-3xl font-extrabold !text-white">{profile?.nickname}</h2><p className="text-slate-300">{profile?.goal} · {profile?.course} · prova em {profile?.examYear}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone="mint">Nível {levelInfo(xp).level}</Badge><Badge tone="mint">Liga {leagueOf(masteryPoints(attempts)).name}</Badge><Badge tone="mint">{dominated.length} habilidades dominadas</Badge></div></Card>
        <Card><h3 className="section-title mb-2">Domínio por disciplina</h3><SubjectRadar data={subjectStats(attempts)} /></Card>
        <Card><h3 className="section-title mb-2">Habilidades dominadas</h3>{dominated.length ? <ul className="grid gap-1 text-sm sm:grid-cols-2">{dominated.map((d) => <li key={d.skillId}>✓ {d.skill.name} <span className="muted text-xs">({d.state === 'consistente' ? 'consistente' : 'provisório'})</span></li>)}</ul> : <p className="muted text-sm">Em construção.</p>}</Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><h3 className="section-title mb-2">Conquistas</h3><ul className="space-y-1 text-sm">{ach.map((a) => <li key={a.id} className="flex gap-2"><Medal size={16} className="text-amber-500" />{a.name}</li>)}{!ach.length && <li className="muted">—</li>}</ul></Card>
          <Card><h3 className="section-title mb-2">Metas e progresso</h3><p className="text-sm"><strong>Meta pessoal:</strong> {profile?.personalGoal || '—'}</p><p className="mt-2 text-sm"><strong>Questões resolvidas:</strong> {attempts.length}</p>{essayGain.length > 0 && <p className="mt-2 text-sm"><strong>Evolução na reescrita de redação:</strong> {essayGain.map((g) => `${g >= 0 ? '+' : ''}${g}`).join(', ')} pts (estimativa)</p>}</Card>
        </div>
        <p className="muted text-center text-xs">Gerado pela NEXO (protótipo). Estimativas formativas, não oficiais.</p>
      </div>
    </div>
  );
}
