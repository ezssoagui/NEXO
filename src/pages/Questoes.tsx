import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Wand2, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Filter } from 'lucide-react';
import { QUESTIONS } from '../data/questions';
import { SKILLS, SUBJECTS, skillById } from '../data/skills';
import { useStore } from '../store/useStore';
import { PageHeader, Tabs, Badge, Card, DemoBadge, Empty, cx } from '../components/ui';
import { AI } from '../services/ai';
import { GENERATOR_SKILLS, parseRequest } from '../engine/generator';
import type { Difficulty, GeneratedQuestion } from '../types';
import { recommendations } from '../engine/learning';
import { prerequisitesOf } from '../data/skills';
import { Shuffle } from 'lucide-react';

export default function Questoes() {
  const [sp] = useSearchParams();
  const [tab, setTab] = useState<'banco' | 'gerador'>(sp.get('tab') === 'gerador' ? 'gerador' : 'banco');
  return (
    <div>
      <PageHeader title="Banco de questões" subtitle="38 questões autorais revisadas (estilo ENEM, vestibular e olimpíada), integradas ao Motor de Domínio. Questões oficiais de provas anteriores não estão cadastradas nesta versão; questões geradas por IA ficam separadas e identificadas." />
      <Tabs tabs={[{ id: 'banco', label: 'Banco inteligente' }, { id: 'gerador', label: 'Gerador de questões com IA' }]} value={tab} onChange={setTab} />
      {tab === 'banco' ? <Bank initialSkill={sp.get('skill') ?? ''} /> : <Generator />}
    </div>
  );
}

function Bank({ initialSkill }: { initialSkill: string }) {
  const { attempts, generated, skillReviews, profile } = useStore();
  const [f, setF] = useState({ q: '', exam: '', subject: '', skill: initialSkill, difficulty: '', type: '', status: '', year: '', foco: '', origem: '' });
  const recSkills = useMemo(() => new Set(recommendations(attempts, skillReviews, Date.now(), 5, profile?.goal).map((r) => r.skillId)), [attempts, skillReviews, profile?.goal]);
  const prereqSkills = useMemo(() => new Set([...recSkills].flatMap((s) => prerequisitesOf(s))), [recSkills]);
  const pool = useMemo(() => [...QUESTIONS, ...generated.filter((g) => g.status === 'aprovada').map((g) => g.q)], [generated]);
  const statusOf = (id: string) => { const a = attempts.filter((x) => x.qid === id).sort((x, y) => y.ts - x.ts)[0]; if (!a) return 'nao_resolvida'; if (!a.correct) return 'errada'; if (a.confidence !== 'certeza') return 'duvida'; return 'acertada'; };
  const list = pool.filter((q) => (!f.q || (q.statement + q.context + q.topic).toLowerCase().includes(f.q.toLowerCase())) && (!f.exam || q.exam === f.exam) && (!f.subject || q.subject === f.subject) && (!f.skill || q.skillId === f.skill) && (!f.difficulty || q.difficulty === f.difficulty) && (!f.type || q.type === f.type) && (!f.year || String(q.year) === f.year) && (!f.status || (f.status === 'ia' ? q.source === 'gerada_ia_demo' : statusOf(q.id) === f.status)) && (!f.foco || (f.foco === 'recomendadas' ? recSkills.has(q.skillId) && statusOf(q.id) !== 'acertada' : f.foco === 'transferencia' ? !!q.integrates?.length : prereqSkills.has(q.skillId))) && (!f.origem || (f.origem === 'ia' ? q.source === 'gerada_ia_demo' : f.origem === 'autoral' ? q.source === 'original_nexo' : false)));
  const sel = (k: keyof typeof f, label: string, opts: [string, string][]) => <div><label className="label !text-xs" htmlFor={`f-${k}`}>{label}</label><select id={`f-${k}`} className="input !py-2" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">Todos</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
  const statusBadge = (id: string) => { const s = statusOf(id); return s === 'errada' ? <Badge tone="red">Errada</Badge> : s === 'duvida' ? <Badge tone="amber">Acertada com dúvida</Badge> : s === 'acertada' ? <Badge tone="mint">Acertada</Badge> : <Badge>Não resolvida</Badge>; };
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit space-y-3 lg:sticky lg:top-20">
        <div className="flex items-center gap-2 font-semibold"><Filter size={16} /> Filtros</div>
        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Buscar" className="input !pl-9" placeholder="Buscar conteúdo…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
        {sel('exam', 'Exame ou olimpíada', [['ENEM', 'ENEM'], ['Vestibular', 'Vestibular (estilo)'], ['Olimpíada', 'Olimpíada']])}
        {sel('subject', 'Disciplina', SUBJECTS.map((s) => [s, s]))}
        {sel('skill', 'Conteúdo / habilidade', SKILLS.map((s) => [s.id, s.name]))}
        {sel('year', 'Ano de elaboração', [...new Set(pool.map((q) => String(q.year)))].map((y) => [y, y]))}
        {sel('difficulty', 'Dificuldade', [['Fácil', 'Fácil'], ['Média', 'Média'], ['Difícil', 'Difícil']])}
        {sel('type', 'Tipo de questão', [['objetiva', 'Objetiva'], ['aberta', 'Aberta / demonstração']])}
        {sel('foco', 'Foco de estudo', [['recomendadas', 'Recomendadas para mim'], ['transferencia', 'Questões de transferência (integração)'], ['prerequisitos', 'Pré-requisitos das recomendadas']])}
        {sel('origem', 'Origem', [['autoral', 'Autorais NEXO (revisadas)'], ['ia', 'Geradas por IA (aprovadas)'], ['oficial', 'Oficiais (nenhuma cadastrada nesta versão)']])}
        {sel('status', 'Meu histórico', [['errada', 'Questões erradas'], ['duvida', 'Acertadas com dúvida'], ['nao_resolvida', 'Não resolvidas'], ['acertada', 'Acertadas'], ['ia', 'Criadas pela IA (aprovadas)']])}
        <button className="btn-ghost btn-sm w-full" onClick={() => setF({ q: '', exam: '', subject: '', skill: '', difficulty: '', type: '', status: '', year: '', foco: '', origem: '' })}>Limpar filtros</button>
        <Link to="/flashcards" className="btn-dark btn-sm w-full"><Shuffle size={14} /> Prática intercalada</Link>
      </Card>
      <div className="space-y-3">
        <p className="muted text-sm">{list.length} questão(ões)</p>
        {list.length === 0 && <Empty title="Nenhuma questão com esses filtros" text="Tente remover algum filtro." />}
        {list.map((q) => (
          <Link key={q.id} to={`/questoes/${q.id}`} className="card block !p-4 transition hover:border-mint-400 hover:shadow-md">
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-400">{q.id}</span><Badge tone={q.source === 'gerada_ia_demo' ? 'violet' : 'navy'}>{q.source === 'gerada_ia_demo' ? 'Gerada por IA' : 'Autoral revisada'}</Badge>{q.integrates?.length ? <Badge tone="sky">Transferência</Badge> : null}{recSkills.has(q.skillId) && statusOf(q.id) !== 'acertada' ? <Badge tone="mint">Recomendada</Badge> : null}<Badge>{q.subject}</Badge><Badge tone={q.difficulty === 'Difícil' ? 'red' : q.difficulty === 'Média' ? 'amber' : 'mint'}>{q.difficulty}</Badge>{q.type === 'aberta' && <Badge tone="sky">Resposta aberta</Badge>}{q.cpe && <Badge tone="violet">C-P-E</Badge>}<span className="ml-auto">{statusBadge(q.id)}</span></div>
            <div className="font-medium">{skillById(q.skillId)?.name}</div>
            <p className="muted mt-1 line-clamp-2 text-sm">{q.context ?? q.statement}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Generator() {
  const { addGenerated, generated, setGeneratedStatus, consume, plan, limits, usage, notify } = useStore();
  const [text, setText] = useState('Crie três questões sobre potência elétrica, estilo ENEM, com contextualização e armadilhas envolvendo resistência constante.');
  const [skill, setSkill] = useState(GENERATOR_SKILLS[0].id);
  const [qty, setQty] = useState(3); const [diff, setDiff] = useState<Difficulty>('Média');
  const [fault, setFault] = useState(false); const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<GeneratedQuestion[]>([]);
  const fromText = () => { const r = parseRequest(text); if (r.skill) setSkill(r.skill); setQty(r.qty); setDiff(r.difficulty); notify(r.skill ? `Pedido interpretado: ${r.qty} questão(ões), ${GENERATOR_SKILLS.find((g) => g.id === r.skill)?.label}, ${r.difficulty}.` : 'Conteúdo não reconhecido pelo gerador demonstrativo. Escolha um dos conteúdos disponíveis.'); };
  async function run() {
    setBusy(true); const out: GeneratedQuestion[] = [];
    for (let i = 0; i < qty; i++) {
      if (!consume('gen')) { notify(`Limite mensal de geração do plano ${plan === 'free' ? 'Free' : 'Plus'} atingido (simulação de créditos).`); break; }
      const r = await AI.generate(skill, { difficulty: diff, injectFault: fault && i === 0, request: text });
      if (r.data) { addGenerated(r.data); out.push(r.data); }
    }
    setLast(out); setBusy(false);
  }
  const icon = (s: GeneratedQuestion['status']) => s === 'aprovada' ? <Badge tone="mint"><ShieldCheck size={12} /> Aprovada na validação</Badge> : s === 'revisao' ? <Badge tone="amber"><AlertTriangle size={12} /> Sinalizada para revisão</Badge> : <Badge tone="red"><XCircle size={12} /> Rejeitada</Badge>;
  const shown = last.length ? generated.filter((g) => last.some((l) => l.q.id === g.q.id)) : generated.slice(0, 6);
  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="section-title">Peça exercícios originais</h2><DemoBadge label="Gerador paramétrico (sem LLM)" /><span className="muted ml-auto text-xs">Créditos: {usage.gen}/{limits[plan].gen} no mês</span></div>
        <label className="label" htmlFor="req">Seu pedido</label>
        <textarea id="req" className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-ghost btn-sm mt-2" onClick={fromText}>Interpretar pedido</button>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><label className="label" htmlFor="gs">Conteúdo</label><select id="gs" className="input" value={skill} onChange={(e) => setSkill(e.target.value)}>{GENERATOR_SKILLS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
          <div><label className="label" htmlFor="gq">Quantidade</label><select id="gq" className="input" value={qty} onChange={(e) => setQty(+e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></div>
          <div><label className="label" htmlFor="gd">Dificuldade</label><select id="gd" className="input" value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)}>{['Fácil', 'Média', 'Difícil'].map((d) => <option key={d}>{d}</option>)}</select></div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={fault} onChange={(e) => setFault(e.target.checked)} className="accent-mint-500" /> Simular falha do modelo na 1ª questão (para ver a validação rejeitar)</label>
        <button className="btn-primary mt-4" disabled={busy} onClick={run}><Wand2 size={16} /> {busy ? 'Gerando e validando…' : 'Gerar questões'}</button>
        <p className="muted mt-3 text-xs">Prova: ENEM (estilo). Cada questão passa por validação automática de coerência, unicidade da resposta, recálculo independente, unidades, qualidade dos distratores e correspondência ao exame. Questões com inconsistências não entram no banco oficial. Questões geradas são sempre identificadas como “originais geradas”, nunca como questões de provas anteriores.</p>
      </Card>
      {shown.length === 0 && <Empty title="Nenhuma questão gerada ainda" />}
      {shown.map((g) => (
        <Card key={g.q.id}>
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-400">{g.q.id}</span><Badge tone="violet">Questão original gerada (demo)</Badge><Badge>{g.q.subject} · {g.q.topic}</Badge><Badge>{g.q.difficulty}</Badge>{icon(g.status)}</div>
          <p className="text-sm">{g.q.context}</p><p className="mt-1 text-sm font-medium">{g.q.statement}</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{g.q.alternatives!.map((a) => <li key={a.letter} className={cx(a.correct && 'font-semibold text-mint-700 dark:text-mint-400')}>{a.letter}) {a.text}{a.correct && ' ✓'}</li>)}</ul>
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Metadados, resposta justificada e validação</summary>
            <p className="mt-2"><strong>Habilidade:</strong> {skillById(g.q.skillId)?.name} · <strong>Estilo:</strong> {g.q.style} · <strong>Pedido:</strong> “{g.request}”</p>
            <p className="mt-1"><strong>Resolução:</strong> {g.q.explanation}</p>
            <ul className="mt-2 space-y-1">{g.validation.map((v) => <li key={v.check} className="flex items-start gap-2">{v.ok ? <CheckCircle2 size={16} className="mt-0.5 text-mint-600" /> : <XCircle size={16} className="mt-0.5 text-red-500" />}<span><strong>{v.check}:</strong> {v.detail}</span></li>)}</ul>
          </details>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.status === 'aprovada' && <Link className="btn-primary btn-sm" to={`/questoes/${g.q.id}`}>Resolver</Link>}
            {g.status === 'revisao' && <><button className="btn-ghost btn-sm" onClick={() => setGeneratedStatus(g.q.id, 'rejeitada')}>Descartar</button><span className="muted text-xs">Aguardando revisão humana (painel administrativo).</span></>}
          </div>
        </Card>
      ))}
    </div>
  );
}
