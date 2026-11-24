import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ESSAY_THEMES, DEMO_ESSAYS } from '../data/essays';
import { COMP_INFO, essaySkillById } from '../data/essaySkills';
import { useStore } from '../store/useStore';
import { AI } from '../services/ai';
import { compareParagraph, compareVersions, evaluateEssay, type ParagraphRole } from '../engine/essay';
import { competencyViews, ESSAY_STATE_LABEL, type EssayState } from '../engine/essayProfile';
import { essayRecommendation, essaySession } from '../engine/recommender';
import type { CompId, EssayEval, EssayVersion } from '../types';
import { Badge, Card, DemoTag, Empty, PageHeader, Progress, Tabs, cx } from '../components/ui';

type Tab = 'competencias' | 'escrever' | 'correcao' | 'paragrafos' | 'repertorios' | 'evolucao';
const SERIF = 'font-[Georgia,serif] text-[15px] leading-7';
const COMPS = Object.keys(COMP_INFO) as CompId[];

export default function Redacao() {
  const [sp] = useSearchParams(); const diag = sp.get('diagnostica') === '1'; const essays = useStore((s) => s.essays);
  const [tab, setTab] = useState<Tab>(diag ? 'escrever' : 'competencias');
  const [themeId, setThemeId] = useState(diag ? (ESSAY_THEMES.find((t) => !essays.some((e) => e.themeId === t.id && e.versions.length)) ?? ESSAY_THEMES[0]).id : essays.at(-1)?.themeId ?? ESSAY_THEMES[0].id);
  return (
    <div>
      <PageHeader title="Redação" subtitle="Uma disciplina completa: aprender, treinar, escrever e reescrever." />
      <Tabs tabs={[{ id: 'competencias', label: 'Competências' }, { id: 'escrever', label: 'Escrever' }, { id: 'correcao', label: 'Correção' }, { id: 'paragrafos', label: 'Parágrafos' }, { id: 'repertorios', label: 'Repertórios' }, { id: 'evolucao', label: 'Evolução' }]} value={tab} onChange={setTab} />
      {tab === 'competencias' && <Competencies onWrite={() => setTab('escrever')} />}
      {tab === 'escrever' && <Write themeId={themeId} setThemeId={setThemeId} diagnostic={diag} onDone={() => setTab('correcao')} />}
      {tab === 'correcao' && <CorrectionView themeId={themeId} setThemeId={setThemeId} onWrite={() => setTab('escrever')} />}
      {tab === 'paragrafos' && <Paragraphs themeId={themeId} setThemeId={setThemeId} />}
      {tab === 'repertorios' && <Repertoire />}
      {tab === 'evolucao' && <Evolution />}
    </div>
  );
}
function ThemeSelect({ id, value, onChange, only }: { id: string; value: string; onChange: (v: string) => void; only?: string[] }) {
  return <div><label className="label" htmlFor={id}>Tema</label><select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>{ESSAY_THEMES.filter((t) => !only || only.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>;
}

const STATE_TONE: Record<EssayState, 'slate' | 'amber' | 'green'> = { nao_avaliado: 'slate', dificuldade: 'amber', em_aprendizagem: 'slate', comprovada: 'green' };
function Competencies({ onWrite }: { onWrite: () => void }) {
  const nav = useNavigate(); const essays = useStore((s) => s.essays); const practice = useStore((s) => s.essayPractice); const start = useStore((s) => s.startSession);
  const views = competencyViews(essays, practice); const rec = essayRecommendation({ essays, essayPractice: practice }); const [open, setOpen] = useState<CompId | null>(rec ? (rec.title.slice(0, 2) as CompId) : null);
  return (
    <div>
      {rec ? (
        <Card className="mb-8"><p className="text-xs font-medium text-brand-700 dark:text-brand-300">Recomendação · cerca de {rec.minutes} min</p><h2 className="mt-1 text-lg font-semibold">{rec.question}</h2><p className="muted mt-1 text-sm">{rec.title}. {rec.reason}</p>
          <ol className="mt-4 space-y-1 text-sm text-ink-600 dark:text-ink-300">{rec.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="w-4 text-ink-400">{i + 1}</span>{s.title}</li>)}</ol><button className="btn-primary mt-5" onClick={() => nav(`/sessao/${start({ ...rec, priority: 0 })}`)}>Iniciar sessão</button></Card>
      ) : <Card className="mb-8"><p className="text-sm">{essays.some((e) => e.versions.length) ? 'Nenhuma dificuldade recorrente identificada até aqui.' : 'Escreva um texto para o NEXO conhecer sua escrita, ou treine por competência.'}</p><button className="btn-primary mt-4" onClick={onWrite}>Escrever</button></Card>}
      <ul>{views.map((v) => (
        <li key={v.id} className="border-b border-ink-100 dark:border-ink-800">
          <button className="flex w-full items-center gap-4 py-4 text-left" aria-expanded={open === v.id} onClick={() => setOpen(open === v.id ? null : v.id)}>
            <span className="w-7 text-sm font-semibold text-brand-700 dark:text-brand-300">{v.id}</span><span className="min-w-0 flex-1"><span className="text-sm font-medium">{v.name}</span><span className="muted block text-xs">{COMP_INFO[v.id].desc}</span></span>
            {v.difficulties.length > 0 && <Badge tone="amber">{v.difficulties.length} dificuldade(s)</Badge>}{v.n > 0 && <span className="text-right text-sm" title="Estimativa formativa">~{v.avg}<span className="muted text-xs"> /200</span></span>}
          </button>
          {open === v.id && <ul className="pb-4 sm:pl-11">{v.skills.map((s) => <li key={s.skill.id} className="row flex-wrap"><span className="min-w-[10rem] flex-1"><span className="text-sm">{s.skill.name}</span><span className="muted block text-xs">{s.note}</span></span><Badge tone={STATE_TONE[s.state]}>{ESSAY_STATE_LABEL[s.state]}</Badge><button className="link text-xs" onClick={() => nav(`/sessao/${start(essaySession(s.skill))}`)}>Treinar</button></li>)}</ul>}
        </li>))}</ul>
      <p className="muted mt-6 text-xs">Valores são estimativas formativas, não notas oficiais. Uma habilidade só é comprovada em temas diferentes.</p>
    </div>
  );
}

function Write({ themeId, setThemeId, diagnostic, onDone }: { themeId: string; setThemeId: (v: string) => void; diagnostic: boolean; onDone: () => void }) {
  const theme = ESSAY_THEMES.find((t) => t.id === themeId)!; const { saveDraft, saveVersion, notify, setOpenQuestion } = useStore.getState();
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [texts, setTexts] = useState(false);
  useEffect(() => { setText(useStore.getState().essays.find((e) => e.themeId === themeId)?.draft ?? ''); }, [themeId]);
  useEffect(() => { const t = setTimeout(() => { if (text) saveDraft(themeId, text); }, 800); return () => clearTimeout(t); }, [text, themeId, saveDraft]);
  useEffect(() => { if (!diagnostic) return; setOpenQuestion(`red:${themeId}`); return () => setOpenQuestion(null); }, [diagnostic, themeId, setOpenQuestion]);
  const words = (text.match(/[A-Za-zÀ-ú0-9]+/g) ?? []).length;
  const send = async () => { if (words < 60) return notify('Escreva pelo menos 60 palavras.'); setBusy(true); const r = await AI.evaluate(text, theme); saveVersion(themeId, { text, ts: Date.now(), eval: r.data, diagnostic: diagnostic || undefined }); setBusy(false); onDone(); };
  return (
    <div className="max-w-3xl space-y-5">
      {diagnostic && <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm dark:border-brand-500/30 dark:bg-brand-500/10"><strong className="font-medium">Redação diagnóstica.</strong> Opcional e independente da avaliação de questões. Escreva sem consulta; a IA fica indisponível até o envio.</p>}
      <ThemeSelect id="th" value={themeId} onChange={setThemeId} />
      <div><button className="link text-sm" aria-expanded={texts} onClick={() => setTexts(!texts)}>{texts ? 'Ocultar' : 'Ler'} textos motivadores</button>{texts && <div className="mt-3 space-y-3 border-l-2 border-ink-200 pl-4 text-sm dark:border-ink-700">{theme.texts.map((t) => <p key={t.title}><strong className="font-medium">{t.title}.</strong> {t.body}</p>)}</div>}</div>
      <div><label className="sr-only" htmlFor="essay">Texto</label><textarea id="essay" className={cx('input min-h-[420px]', SERIF)} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva seu texto dissertativo-argumentativo." /></div>
      <div className="flex flex-wrap items-center gap-3"><button className="btn-primary" disabled={busy || words < 60} onClick={send}>{busy ? 'Analisando…' : 'Enviar para correção'}</button><span className="muted text-xs">{words} palavras · cerca de {Math.ceil(text.length / 75)} linhas · rascunho salvo neste navegador</span></div>
    </div>
  );
}

function Highlighted({ text, ev, onPick }: { text: string; ev: EssayEval; onPick: (i: number) => void }) {
  const parts: React.ReactNode[] = []; let pos = 0;
  ev.highlights.forEach((h, i) => {
    if (h.start < pos) return;
    parts.push(text.slice(pos, h.start));
    parts.push(<mark key={i} tabIndex={0} role="button" onClick={() => onPick(i)} onKeyDown={(e) => e.key === 'Enter' && onPick(i)} title={h.message} className={cx('cursor-pointer rounded px-0.5 text-inherit', h.severity === 'erro' ? 'bg-red-200/70 dark:bg-red-500/30' : 'bg-amber-200/70 dark:bg-amber-500/30')}>{text.slice(h.start, h.end)}</mark>);
    pos = h.end;
  });
  parts.push(text.slice(pos));
  return <div className={cx('whitespace-pre-wrap', SERIF)}>{parts}</div>;
}
function CorrectionView({ themeId, setThemeId, onWrite }: { themeId: string; setThemeId: (v: string) => void; onWrite: () => void }) {
  const essays = useStore((s) => s.essays); const withV = essays.filter((e) => e.versions.some((v) => v.eval)).map((e) => e.themeId); const essay = essays.find((e) => e.themeId === (withV.includes(themeId) ? themeId : withV.at(-1)));
  const [pick, setPick] = useState<number | null>(null); const [open, setOpen] = useState<CompId | null>(null); const [sample, setSample] = useState(false);
  const v = essay ? [...essay.versions].reverse().find((x) => x.eval) : undefined;
  if (!v?.eval || !essay) return <div><Empty title="Nenhum texto corrigido" action={<><button className="btn-primary" onClick={onWrite}>Escrever</button><button className="btn-ghost" onClick={() => setSample(!sample)}>Ver exemplos comentados</button></>} />{sample && <Samples />}</div>;
  const ev = v.eval;
  return (
    <div>
      {withV.length > 1 && <div className="mb-6 max-w-xl"><ThemeSelect id="cv" value={essay.themeId} onChange={(t) => { setPick(null); setThemeId(t); }} only={withV} /></div>}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2"><div><p className="muted text-xs">Estimativa formativa</p><p className="text-3xl font-semibold">~{ev.total}<span className="muted text-base font-normal"> de 1000</span></p></div><DemoTag title={ev.engine}>{ev.engine.startsWith('IA real') ? 'Estimativa por IA' : 'Estimativa por regras, sem IA'}</DemoTag><span className="muted text-xs">Não equivale à nota oficial.</span></div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div><Highlighted text={v.text} ev={ev} onPick={setPick} />{pick !== null && ev.highlights[pick] && <p className="mt-4 rounded-lg border border-ink-200 px-4 py-3 text-sm dark:border-ink-700"><strong className="font-medium">{ev.highlights[pick].comp}.</strong> {ev.highlights[pick].message}</p>}<button className="btn-ghost mt-6" onClick={onWrite}>Reescrever</button></div>
        <ul>{ev.competencies.map((c) => (
          <li key={c.id} className="border-b border-ink-100 py-3 last:border-0 dark:border-ink-800">
            <button className="w-full text-left" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}><span className="flex justify-between gap-3 text-sm"><span className="font-medium">{c.id} · {COMP_INFO[c.id].name}</span><span>{c.score}</span></span><Progress value={c.score / 200} className="mt-2" /></button>
            {open === c.id && <div className="mt-3 space-y-2 text-xs"><p>{c.justification ?? c.summary}</p>{!!c.evidence?.length && <ul className="muted space-y-1">{c.evidence.map((e) => <li key={e} className="font-[Georgia,serif]">{e}</li>)}</ul>}{!!c.problems?.length && <ul className="list-disc pl-4">{c.problems.map((p) => <li key={p}>{p}</li>)}</ul>}{!!c.suggestions?.length && <ul className="muted list-disc pl-4">{c.suggestions.map((p) => <li key={p}>{p}</li>)}</ul>}{c.exercise && <p><strong className="font-medium">Exercício:</strong> {c.exercise}</p>}</div>}
          </li>))}</ul>
      </div>
    </div>
  );
}
function Samples() {
  const [sel, setSel] = useState(0); const d = DEMO_ESSAYS[sel]; const theme = ESSAY_THEMES.find((t) => t.id === d.themeId)!; const ev = useMemo(() => evaluateEssay(d.text, theme), [d, theme]);
  return <div className="mt-8"><div className="flex flex-wrap gap-2">{DEMO_ESSAYS.map((e, i) => <button key={e.id} className={cx('btn-ghost btn-sm', i === sel && '!border-brand-500')} onClick={() => setSel(i)}>{e.label}</button>)}</div><p className="muted mt-4 text-sm">{theme.title}</p><div className="mt-3"><Highlighted text={d.text} ev={ev} onPick={() => undefined} /></div><ul className="muted mt-4 list-disc space-y-1 pl-5 text-sm">{d.comments.map((c) => <li key={c}>{c}</li>)}</ul></div>;
}

function Paragraphs({ themeId, setThemeId }: { themeId: string; setThemeId: (v: string) => void }) {
  const essays = useStore((s) => s.essays); const withV = essays.filter((e) => e.versions.length).map((e) => e.themeId); const id = withV.includes(themeId) ? themeId : withV.at(-1); const essay = essays.find((e) => e.themeId === id); const { saveVersion, notify } = useStore.getState();
  const last = essay?.versions.at(-1); const paras = (last?.text ?? '').split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean);
  const [idx, setIdx] = useState(1); const [draft, setDraft] = useState(''); const [res, setRes] = useState<ReturnType<typeof compareParagraph> | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(paras[Math.min(idx, paras.length - 1)] ?? ''); setRes(null); }, [idx, last?.ts, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!essay || !last) return <Empty title="Faça a primeira correção para reescrever parágrafos" text="Ou treine parágrafos por competência na aba Competências." />;
  const i = Math.min(idx, paras.length - 1); const role: ParagraphRole = i === 0 ? 'introducao' : i === paras.length - 1 ? 'conclusao' : 'desenvolvimento'; const same = draft.trim() === paras[i];
  const save = async () => { setBusy(true); const full = paras.map((p, k) => (k === i ? draft.trim() : p)).join('\n\n'); const r = await AI.evaluate(full, ESSAY_THEMES.find((t) => t.id === essay.themeId)!); saveVersion(essay.themeId, { text: full, ts: Date.now(), eval: r.data }); setBusy(false); notify('Nova versão salva e reavaliada.'); };
  return (
    <div>{withV.length > 1 && <div className="mb-6 max-w-xl"><ThemeSelect id="pv" value={essay.themeId} onChange={setThemeId} only={withV} /></div>}
      <div className="grid gap-8 lg:grid-cols-2">
        <ul className="space-y-2">{paras.map((p, k) => <li key={k}><button onClick={() => setIdx(k)} className={cx('w-full rounded-lg border p-3 text-left text-sm', k === i ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-ink-200 dark:border-ink-700')}><span className="muted text-xs">{k === 0 ? 'Introdução' : k === paras.length - 1 ? 'Conclusão' : `Desenvolvimento ${k}`}</span><span className="mt-0.5 line-clamp-2">{p}</span></button></li>)}</ul>
        <div><label className="label" htmlFor="pd">Reescreva com suas palavras</label><textarea id="pd" rows={9} className={cx('input', SERIF)} value={draft} onChange={(e) => setDraft(e.target.value)} /><div className="mt-3 flex gap-2"><button className="btn-ghost" disabled={same} onClick={() => setRes(compareParagraph(paras[i], draft, role))}>Comparar</button><button className="btn-primary" disabled={same || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar versão'}</button></div>
          {res && <div className="mt-4 space-y-3 text-sm">{([['Melhorou', res.improved], ['Atenção', res.regressed], ['Ainda pode desenvolver', res.remaining]] as const).map(([t, xs]) => xs.length > 0 && <div key={t}><p className="font-medium">{t}</p><ul className="muted list-disc pl-5">{xs.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</div>}</div>
      </div>
      {essay.versions.length > 1 && <Versions versions={essay.versions} />}
    </div>
  );
}
function Versions({ versions }: { versions: EssayVersion[] }) {
  const a = versions[0].eval, b = versions.at(-1)!.eval; if (!a || !b) return null;
  return <section className="mt-10"><h2 className="section-title">Primeira × última versão</h2><div className="mt-3 grid grid-cols-5 gap-2 text-center text-sm">{compareVersions(a, b).map((c) => <div key={c.id}><div className="muted text-xs">{c.id}</div><div>{c.before} → {c.after}</div><div className={cx('text-xs', c.delta > 0 ? 'text-emerald-700 dark:text-emerald-300' : c.delta < 0 ? 'text-red-600 dark:text-red-300' : 'muted')}>{c.delta > 0 ? '+' : ''}{c.delta}</div></div>)}</div></section>;
}

function Repertoire() {
  const nav = useNavigate(); const essays = useStore((s) => s.essays); const start = useStore((s) => s.startSession);
  const rows = essays.flatMap((e) => {
    const v = [...e.versions].reverse().find((x) => x.eval); if (!v) return [];
    const c2 = v.eval!.competencies.find((c) => c.id === 'C2')!; const has = v.eval!.aspects.find((a) => a.label === 'Repertório sociocultural');
    return [{ theme: ESSAY_THEMES.find((t) => t.id === e.themeId)!.title, quotes: has?.status === 'ausente' ? [] : c2.evidence ?? [], use: v.eval!.aspects.find((a) => a.label === 'Relação repertório–argumento'), warn: v.eval!.highlights.filter((h) => h.comp === 'C2').map((h) => h.message) }];
  });
  return (
    <div className="max-w-3xl"><p className="muted text-sm">Repertório produtivo é explicado e ligado ao argumento. Aqui estão os que você usou.</p>
      {rows.length ? <ul className="mt-5 space-y-8">{rows.map((r) => <li key={r.theme}><h2 className="text-sm font-semibold">{r.theme}</h2>{r.quotes.length ? <ul className="mt-2 space-y-1 text-sm">{r.quotes.map((q) => <li key={q} className="border-l-2 border-ink-200 pl-3 font-[Georgia,serif] dark:border-ink-700">{q}</li>)}</ul> : <p className="muted mt-2 text-sm">Nenhum repertório identificado.</p>}<div className="mt-2 flex flex-wrap items-center gap-2">{r.use && <Badge tone={r.use.status === 'ok' ? 'green' : 'amber'}>{r.use.status === 'ok' ? 'Uso produtivo' : r.use.status === 'parcial' ? 'Pouco articulado' : 'Sem articulação'}</Badge>}{r.warn.map((w) => <span key={w} className="text-xs text-amber-800 dark:text-amber-300">{w}</span>)}</div></li>)}</ul> : <p className="muted mt-5 text-sm">Nenhum texto corrigido ainda.</p>}
      <button className="btn-ghost mt-8" onClick={() => nav(`/sessao/${start(essaySession(essaySkillById('c2-repertorio')!))}`)}>Treinar uso de repertório</button></div>
  );
}
const COLORS = ['#2556e4', '#0f9d74', '#8b5cf6', '#d97706', '#db2777'];
function Evolution() {
  const essays = useStore((s) => s.essays); const practice = useStore((s) => s.essayPractice); const dark = useStore((s) => s.settings.dark); const axis = dark ? '#9aa3b0' : '#667080';
  const vs = essays.flatMap((e) => e.versions.map((v) => ({ v, themeId: e.themeId }))).filter((x) => x.v.eval).sort((a, b) => a.v.ts - b.v.ts);
  if (!vs.length && !practice.length) return <Empty title="Sem histórico ainda" />;
  const data = vs.map((x, i) => ({ n: `Texto ${i + 1}`, ...Object.fromEntries(x.v.eval!.competencies.map((c) => [c.id, c.score])) }));
  return (
    <div className="space-y-10">
      {data.length > 1 && <section><h2 className="section-title">Estimativas por competência</h2><div className="mt-3 flex flex-wrap gap-4 text-xs">{COMPS.map((c, i) => <span key={c} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{c}</span>)}</div><div className="mt-3 h-64" role="img" aria-label="Estimativas por competência em cada texto"><ResponsiveContainer><LineChart data={data} margin={{ left: -16, right: 24, top: 8 }}><CartesianGrid stroke={axis} strokeOpacity={0.15} vertical={false} /><XAxis dataKey="n" tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} /><YAxis domain={[0, 200]} ticks={[0, 40, 80, 120, 160, 200]} tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, background: dark ? '#171b22' : '#fff', borderColor: dark ? '#363d49' : '#e4e7ec' }} />{COMPS.map((c, i) => <Line key={c} dataKey={c} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 2.5 }} />)}</LineChart></ResponsiveContainer></div></section>}
      {vs.length > 0 && <section><h2 className="section-title">Textos</h2><ul>{[...vs].reverse().map((x) => <li key={x.v.ts} className="row"><span className="min-w-0 flex-1 text-sm">{ESSAY_THEMES.find((t) => t.id === x.themeId)?.title}</span>{x.v.diagnostic && <Badge>diagnóstica</Badge>}<span className="muted text-xs">{new Date(x.v.ts).toLocaleDateString('pt-BR')}</span><span className="text-sm">~{x.v.eval!.total}</span></li>)}</ul></section>}
      {practice.length > 0 && <section><h2 className="section-title">Treinos</h2><ul>{[...practice].reverse().slice(0, 15).map((p) => <li key={p.id} className="row"><span className="flex-1 text-sm">{essaySkillById(p.skillId)?.name}</span><span className="muted text-xs">{{ analise: 'análise', explicacao: 'explicação', paragrafo: 'parágrafo', verificacao: 'verificação' }[p.kind]}</span><Badge tone={p.ok ? 'green' : 'amber'}>{p.ok ? 'demonstrada' : 'a desenvolver'}</Badge></li>)}</ul></section>}
    </div>
  );
}
