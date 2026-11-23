import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, School, Medal, Swords, ShieldCheck, Lock, CheckCircle2, Star, Handshake } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CHALLENGES, LEAGUES, MIN_PARTICIPANTS, SCHOOLS, TEAMS, TOURNAMENTS } from '../data/demo';
import { achievements, leagueOf, levelInfo, masteryPoints, schoolRanking, totalXP } from '../engine/gamification';
import { allMastery, solid } from '../engine/mastery';
import { PageHeader, Tabs, Card, Badge, Progress, cx, Ring } from '../components/ui';

type Tab = 'progresso' | 'desafios' | 'equipes' | 'escolas' | 'ligas' | 'torneios';

export default function Arena() {
  const [tab, setTab] = useState<Tab>('progresso');
  return (
    <div>
      <PageHeader title="NEXO Arena" subtitle="Gamificação que premia aprendizagem demonstrada — não volume. Competir é opcional; há caminhos cooperativos para quem prefere." />
      <Tabs tabs={[{ id: 'progresso', label: 'Minha progressão' }, { id: 'desafios', label: 'Desafios e missões' }, { id: 'equipes', label: 'Equipes' }, { id: 'escolas', label: 'Ranking de escolas' }, { id: 'ligas', label: 'Ligas' }, { id: 'torneios', label: 'Torneios' }]} value={tab} onChange={setTab} />
      {tab === 'progresso' && <Progression />}
      {tab === 'desafios' && <Challenges />}
      {tab === 'equipes' && <Teams />}
      {tab === 'escolas' && <Schools />}
      {tab === 'ligas' && <Leagues />}
      {tab === 'torneios' && <Tournaments />}
      <Card className="mt-6 !p-4 text-xs"><div className="mb-1 flex items-center gap-2 font-semibold"><ShieldCheck size={14} /> Regras de integridade e privacidade</div><ul className="muted list-disc space-y-0.5 pl-4"><li>Repetir a mesma questão em menos de 24 h não gera XP; cada questão rende XP no máximo 3 vezes.</li><li>Acertos marcados como “chutei” valem pouco e não contam como domínio.</li><li>Não é possível comprar XP, posições, notas ou vantagens acadêmicas.</li><li>Rankings mostram apenas apelidos; perfis são privados por padrão; notas individuais nunca são públicas.</li></ul></Card>
    </div>
  );
}

function Progression() {
  const { xpEvents, attempts, cardStates, essays } = useStore();
  const xp = totalXP(xpEvents); const lv = levelInfo(xp);
  const ach = achievements(attempts, xp, Object.values(cardStates).reduce((s, c) => s + c.reviews.length, 0), essays.filter((e) => e.versions.length > 1).length);
  const today = attempts.filter((a) => new Date(a.ts).toDateString() === new Date().toDateString());
  const daily = [
    { t: 'Acertar 2 questões com segurança', p: today.filter(solid).length, g: 2 },
    { t: 'Resolver 1 questão gêmea', p: today.filter((a) => a.isTwin).length, g: 1 },
    { t: 'Revisar 5 flashcards', p: Object.values(cardStates).flatMap((c) => c.reviews).filter((r) => new Date(r.ts).toDateString() === new Date().toDateString()).length, g: 5 },
  ];
  const milestones = xpEvents.filter((e) => e.reason.startsWith('Novo marco') || e.reason.startsWith('Transferência')).slice(-6).reverse();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="text-center"><Ring value={lv.progress} size={120} stroke={10}><div className="text-xs text-slate-500">Nível</div><div className="font-display text-3xl">{lv.level}</div></Ring><div className="mt-3 font-semibold">{xp} XP</div><p className="muted text-xs">{lv.toNext} XP para o nível {lv.level + 1}</p></Card>
      <Card><h2 className="section-title mb-3">Missões diárias</h2>{daily.map((d) => <div key={d.t} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{d.t}</span><span className="muted text-xs">{Math.min(d.p, d.g)}/{d.g}</span></div><Progress value={d.p / d.g} /></div>)}<p className="muted text-xs">Missão semanal: atingir domínio provisório em 1 nova habilidade.</p></Card>
      <Card><h2 className="section-title mb-3">Marcos pessoais</h2>{milestones.length ? <ul className="space-y-2 text-sm">{milestones.map((m) => <li key={m.key} className="flex gap-2"><Star size={16} className="mt-0.5 text-amber-500" /><span>{m.reason} <span className="muted text-xs">· {new Date(m.ts).toLocaleDateString('pt-BR')}</span></span></li>)}</ul> : <p className="muted text-sm">Acerte uma questão gêmea para registrar seu primeiro marco.</p>}</Card>
      <Card className="lg:col-span-3"><h2 className="section-title mb-3">Conquistas</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ach.map((a) => <div key={a.id} className={cx('rounded-xl border p-3', a.got ? 'border-mint-400 bg-mint-50 dark:bg-mint-500/10' : 'border-slate-200 opacity-60 dark:border-navy-700')}><div className="flex items-center gap-2 font-semibold">{a.got ? <Medal size={16} className="text-amber-500" /> : <Lock size={16} />}{a.name}</div><p className="muted text-xs">{a.desc}</p></div>)}</div></Card>
      <Card className="lg:col-span-3"><h2 className="section-title mb-3">Histórico de XP</h2><ul className="divide-y divide-slate-100 text-sm dark:divide-navy-800">{[...xpEvents].reverse().slice(0, 12).map((e, i) => <li key={i} className="flex justify-between py-2"><span>{e.reason}</span><span className={cx('font-semibold', e.amount ? 'text-mint-700 dark:text-mint-400' : 'muted')}>+{e.amount}</span></li>)}</ul></Card>
    </div>
  );
}

function Challenges() {
  const { joinedChallenges, joinChallenge, challengeProgress, attempts, addXP, notify, xpEvents } = useStore();
  const cnDominated = allMastery(attempts).filter((m) => m.skill.area === 'Ciências da Natureza' && (m.state === 'provisorio' || m.state === 'consistente')).length;
  const progressOf = (id: string) => id === 'c1' ? Math.min(5, cnDominated + 2) : challengeProgress[id] ?? 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CHALLENGES.map((c) => { const joined = joinedChallenges.includes(c.id); const p = progressOf(c.id); const done = p >= c.goal; const claimed = xpEvents.some((e) => e.key === `ch-${c.id}`); return (
        <Card key={c.id}>
          <div className="flex items-center gap-2"><Badge tone={c.kind === 'equipe' ? 'sky' : c.kind === 'torneio' ? 'violet' : 'mint'}>{c.kind === 'equipe' ? 'Missão colaborativa' : c.kind === 'torneio' ? 'Confronto' : 'Individual'}</Badge><Badge tone="amber">+{c.xp} XP</Badge></div>
          <h3 className="mt-2 font-bold">{c.title}</h3><p className="muted text-sm">{c.description}</p>
          <div className="mt-3"><div className="mb-1 flex justify-between text-xs"><span>{p}/{c.goal} {c.unit}</span>{c.id === 'c1' && <span className="muted">inclui 2 de colegas fictícios</span>}</div><Progress value={p / c.goal} /></div>
          {joined && c.questionIds.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{c.questionIds.map((q) => <Link key={q} to={`/questoes/${q}`} className={cx('chip', attempts.some((a) => a.qid === q && a.correct && a.confidence !== 'chute') ? 'bg-mint-100 text-mint-800' : 'bg-slate-100 dark:bg-navy-800')}>{q}</Link>)}</div>}
          <div className="mt-4">{!joined ? <button className="btn-primary btn-sm" onClick={() => { joinChallenge(c.id); notify('Você entrou no desafio!'); }}>Participar</button> : done ? (claimed ? <Badge tone="mint"><CheckCircle2 size={12} /> Concluído e XP recebido</Badge> : <button className="btn-primary btn-sm" onClick={() => { if (addXP(c.xp, `Desafio concluído: ${c.title}`, `ch-${c.id}`)) notify(`+${c.xp} XP!`); }}>Receber {c.xp} XP</button>) : <Badge tone="sky">Em andamento</Badge>}</div>
        </Card>
      ); })}
    </div>
  );
}

function Teams() {
  const { teamId, joinTeam, profile, notify } = useStore();
  const [kind, setKind] = useState('');
  return (
    <div className="space-y-4">
      <p className="muted text-sm">Grupos por escola, turma, amigos ou objetivo de vestibular. Nas missões colaborativas, a equipe vence junta — ninguém é exposto individualmente.</p>
      <div className="flex gap-2">{['', 'Escola', 'Turma', 'Amigos', 'Objetivo'].map((k) => <button key={k} onClick={() => setKind(k)} className={cx('rounded-full border px-3 py-1 text-xs font-semibold', kind === k ? 'border-navy-800 bg-navy-800 text-white' : 'border-slate-300 dark:border-navy-700')}>{k || 'Todas'}</button>)}</div>
      <div className="grid gap-4 md:grid-cols-3">{TEAMS.filter((t) => !kind || t.kind === kind).map((t) => <Card key={t.id} className={cx(teamId === t.id && '!border-mint-500')}><div className="flex items-center gap-2"><Users size={18} /><span className="font-semibold">{t.name}</span></div><Badge>{t.kind}</Badge><p className="muted mt-2 text-sm">Membros: {[...t.members, ...(teamId === t.id ? [profile?.nickname ?? 'Você'] : [])].join(', ')}</p>{teamId === t.id ? <Badge tone="mint">Sua equipe</Badge> : <button className="btn-ghost btn-sm mt-3" onClick={() => { joinTeam(t.id); notify(`Você entrou na equipe ${t.name}.`); }}>Entrar na equipe</button>}</Card>)}</div>
      <Card className="!p-4"><div className="flex items-center gap-2 font-semibold"><Handshake size={16} /> Prefere não competir?</div><p className="muted text-sm">Todas as missões colaborativas e individuais funcionam sem participar de rankings. Desative a participação em Perfil → Privacidade.</p></Card>
    </div>
  );
}

function Schools() {
  const { schoolId, setSchool, settings, setSetting } = useStore();
  const [cat, setCat] = useState('');
  const rows = schoolRanking(cat || undefined);
  return (
    <div className="space-y-4">
      <Card className="!p-4"><div className="flex flex-wrap items-center gap-3"><School size={18} /><label htmlFor="sch" className="text-sm font-medium">Minha instituição (fictícia):</label><select id="sch" className="input !w-auto !py-2" value={schoolId ?? ''} onChange={(e) => setSchool(e.target.value)}><option value="">Nenhuma</option>{SCHOOLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" className="accent-mint-500" checked={settings.rankingOptIn} onChange={(e) => setSetting('rankingOptIn', e.target.checked)} /> Contribuir para o ranking da minha escola</label></div></Card>
      <div className="flex flex-wrap gap-2">{['', 'Instituto Federal', 'Pública', 'Particular'].map((c) => <button key={c} onClick={() => setCat(c)} className={cx('rounded-full border px-3 py-1 text-xs font-semibold', cat === c ? 'border-navy-800 bg-navy-800 text-white' : 'border-slate-300 dark:border-navy-700')}>{c || 'Classificação geral'}</button>)}</div>
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-navy-950"><tr><th className="p-3">#</th><th className="p-3">Escola (fictícia)</th><th className="p-3">Categoria</th><th className="p-3">Acerto em desafios equivalentes</th><th className="p-3">Evolução</th><th className="p-3">Participação</th><th className="p-3">Regularidade</th><th className="p-3">Índice</th></tr></thead>
          <tbody>{rows.map((s, i) => <tr key={s.id} className={cx('border-t border-slate-100 dark:border-navy-800', s.id === schoolId && 'bg-mint-50 dark:bg-mint-500/10', !s.eligible && 'opacity-60')}><td className="p-3 font-bold">{s.eligible ? i + 1 : '—'}</td><td className="p-3 font-medium">{s.name}{s.id === schoolId && <Badge tone="mint">sua escola</Badge>}{!s.eligible && <div className="text-xs text-amber-700 dark:text-amber-300">Abaixo do mínimo de {MIN_PARTICIPANTS} participantes ativos</div>}</td><td className="p-3">{s.category}</td><td className="p-3">{Math.round(s.accuracy * 100)}%</td><td className="p-3">+{Math.round(s.growth * 100)}%</td><td className="p-3">{Math.round(s.participation * 100)}%</td><td className="p-3">{Math.round(s.regularity * 100)}%</td><td className="p-3 font-bold">{s.score}</td></tr>)}</tbody></table>
      </Card>
      <p className="muted text-xs">Índice normalizado = 40% acerto em desafios equivalentes + 25% evolução + 20% participação (proporção de alunos ativos) + 15% regularidade. Usa taxas, e não totais, para reduzir a vantagem de escolas com mais usuários. Dados fictícios.</p>
    </div>
  );
}

const PEERS = [{ n: 'Estudante fictício A', p: 9, r: 5 }, { n: 'Estudante fictício B', p: 6, r: 6 }, { n: 'Estudante fictício C', p: 4, r: 3 }, { n: 'Estudante fictício D', p: 2, r: 4 }];
function Leagues() {
  const { attempts, settings, profile } = useStore();
  const pts = masteryPoints(attempts); const l = leagueOf(pts);
  const days = new Set(attempts.filter((a) => a.ts > Date.now() - 7 * 86400000).map((a) => new Date(a.ts).toDateString())).size;
  const board = [...PEERS.map((x) => ({ ...x, me: false })), ...(settings.rankingOptIn ? [{ n: profile?.nickname ?? 'Você', p: pts, r: days, me: true }] : [])].map((x) => ({ ...x, score: x.p * 10 + Math.min(x.r, 5) * 4 })).sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-4">
      <Card><p className="text-sm">Sua liga é definida por <strong>pontos de domínio</strong> (domínio provisório = 1, consistente = 2) — não por quantidade de exercícios. Você tem <strong>{pts} pontos</strong>.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{LEAGUES.map((x, i) => <div key={x.name} className={cx('rounded-xl border-2 p-3 text-center', i === l.idx ? 'border-mint-500 bg-mint-50 dark:bg-mint-500/10' : 'border-slate-200 dark:border-navy-700')}><Trophy className="mx-auto" style={{ color: x.color }} /><div className="mt-1 text-sm font-bold">{x.name}</div><div className="muted text-[11px]">≥ {x.min} pts</div></div>)}</div>
        {l.next && <><Progress className="mt-4" value={(pts - l.min) / (l.next.min - l.min)} /><p className="muted mt-1 text-xs">{l.next.min - pts} ponto(s) de domínio para a liga {l.next.name}.</p></>}
      </Card>
      <Card><h2 className="section-title mb-1">Ranking entre estudantes da liga</h2><p className="muted mb-3 text-xs">Pontuação = 10 × pontos de domínio (comprovados, não volume) + 4 × dias de estudo na semana (máx. 5). Repetições, chutes e compras não contam. Apenas apelidos; participação opcional (Perfil). Colegas listados são fictícios nesta versão.</p>
        <ol className="space-y-1 text-sm">{board.map((x, i) => <li key={x.n} className={cx('flex justify-between rounded-lg px-3 py-2', x.me ? 'bg-mint-50 font-semibold dark:bg-mint-500/10' : 'bg-slate-50 dark:bg-navy-950')}><span>{i + 1}. {x.n}</span><span>{x.score}</span></li>)}</ol>
        {!settings.rankingOptIn && <p className="muted mt-2 text-xs">Você optou por não participar de rankings.</p>}
      </Card>
    </div>
  );
}

function Tournaments() {
  const { attempts, joinedChallenges, joinChallenge } = useStore();
  const myScore = attempts.filter((a) => ['q19', 'q20', 'q22'].includes(a.qid) && solid(a)).length * 10;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{TOURNAMENTS.map((t) => <Card key={t.id}><div className="flex items-center gap-2 font-semibold"><Trophy size={16} className="text-amber-500" /> {t.name}</div><div className="mt-2 flex gap-2"><Badge tone={t.status === 'Em andamento' ? 'mint' : t.status === 'Inscrições abertas' ? 'sky' : 'slate'}>{t.status}</Badge><Badge>{t.ends}</Badge></div><p className="muted mt-2 text-xs">{t.participants ? `${t.participants} participantes (fictício)` : 'Inscrições em breve'}</p></Card>)}</div>
      <Card><h2 className="section-title mb-3 flex items-center gap-2"><Swords size={18} /> Confronto demonstrativo — Batalha de Matemática</h2>
        <div className="grid grid-cols-3 items-center text-center"><div><div className="font-semibold">Você</div><div className="font-display text-4xl font-bold text-mint-600">{myScore}</div></div><div className="muted">vs</div><div><div className="font-semibold">Equipe Delta (fictícia)</div><div className="font-display text-4xl font-bold text-navy-600 dark:text-navy-300">20</div></div></div>
        <p className="muted mt-3 text-center text-sm">10 pontos por acerto sólido (sem chute) nas questões q19, q20 e q22. Repetir não pontua de novo.</p>
        <div className="mt-3 text-center">{joinedChallenges.includes('c2') ? <Link className="btn-primary" to="/questoes/q19">Jogar rodada</Link> : <button className="btn-primary" onClick={() => joinChallenge('c2')}>Entrar no confronto</button>}</div>
        {myScore > 20 && <p className="mt-3 text-center font-semibold text-mint-700 dark:text-mint-400">🏆 Troféu digital: Vitória na rodada 1</p>}
      </Card>
    </div>
  );
}
