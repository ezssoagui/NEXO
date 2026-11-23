import { useEffect, useMemo, useState } from 'react';
import { Clock, Upload, Save, Send, FileText, Info, CheckCircle2, AlertTriangle, XCircle, History, FlaskConical } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { ESSAY_THEMES, DEMO_ESSAYS } from '../data/essays';
import { useStore } from '../store/useStore';
import { AI } from '../services/ai';
import { evaluateParagraph, compareVersions, evaluateEssay, compareParagraph, type ParagraphRole } from '../engine/essay';
import type { EssayEval } from '../types';
import { PageHeader, Tabs, Card, Badge, DemoBadge, Modal, Empty, cx, Progress } from '../components/ui';

type Tab = 'escrever' | 'correcao' | 'paragrafo' | 'treino' | 'versoes' | 'c3' | 'c5' | 'exemplos' | 'historico';
const COMP_COLORS = ['#2f5494', '#0a9573', '#7c3aed', '#d97706', '#db2777'];

export default function Redacao() {
  const { essays, saveDraft, saveVersion, consume, notify, usage, limits, plan, addXP } = useStore();
  const [tab, setTab] = useState<Tab>('escrever');
  const [themeId, setThemeId] = useState(essays[0]?.themeId ?? 't1');
  const theme = ESSAY_THEMES.find((t) => t.id === themeId)!;
  const essay = essays.find((e) => e.themeId === themeId);
  const [text, setText] = useState(essay?.draft ?? essay?.versions.at(-1)?.text ?? '');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(false); const [sec, setSec] = useState(0);
  const [upload, setUpload] = useState(false);
  const [c3Prompt, setC3Prompt] = useState<string | null>(null);
  useEffect(() => { const e = essays.find((x) => x.themeId === themeId); setText(e?.draft ?? e?.versions.at(-1)?.text ?? ''); /* eslint-disable-next-line */ }, [themeId]);
  useEffect(() => { const t = setTimeout(() => { if (text && text !== essay?.draft) saveDraft(themeId, text); }, 800); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [text]);
  useEffect(() => { if (!timer) return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, [timer]);
  const words = (text.match(/[A-Za-zÀ-ú0-9]+/g) ?? []).length;
  const lines = Math.ceil(text.length / 75);
  const last = essay?.versions.at(-1);

  async function correct() {
    if (words < 60) return notify('Escreva pelo menos 60 palavras para solicitar a correção.');
    if (!consume('essay')) return notify('Limite mensal de correções atingido (créditos simulados). Veja os planos.');
    setBusy(true); const r = await AI.evaluate(text, theme);
    saveVersion(themeId, { text, title, ts: Date.now(), eval: r.data });
    if ((essay?.versions.length ?? 0) >= 1) addXP(20, 'Reescrita de redação', `essay-${themeId}-${essay?.versions.length}`);
    setBusy(false); setTab('correcao');
  }

  return (
    <div>
      <PageHeader title="Laboratório de redação" subtitle="Escreva, receba feedback formativo pelas cinco competências do ENEM, reescreva e compare versões.">
        <DemoBadge label="Correção heurística (sem IA real)" />
      </PageHeader>
      <Tabs tabs={[{ id: 'escrever', label: 'Escrever' }, { id: 'correcao', label: 'Correção' }, { id: 'paragrafo', label: 'Reescrever parágrafo' }, { id: 'treino', label: 'Treino por competência' }, { id: 'versoes', label: 'Versões' }, { id: 'c3', label: 'Laboratório C3' }, { id: 'c5', label: 'Laboratório C5' }, { id: 'exemplos', label: 'Redações comentadas' }, { id: 'historico', label: 'Histórico' }]} value={tab} onChange={setTab} />

      {tab === 'escrever' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <Card className="!p-4">
              <label className="label" htmlFor="theme">Tema</label>
              <select id="theme" className="input" value={themeId} onChange={(e) => setThemeId(e.target.value)}>{ESSAY_THEMES.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
              <p className="muted mt-2 text-xs">Proposta: a partir dos textos motivadores e de seus conhecimentos, redija um texto dissertativo-argumentativo em norma-padrão sobre o tema, apresentando proposta de intervenção que respeite os direitos humanos.</p>
            </Card>
            <Card className="!p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input aria-label="Título (opcional)" className="input !w-auto flex-1" placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
                <button className={cx('btn-ghost btn-sm', timer && '!border-mint-500')} onClick={() => setTimer(!timer)}><Clock size={14} />{timer ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'Cronômetro'}</button>
                <button className="btn-ghost btn-sm" onClick={() => setUpload(true)}><Upload size={14} /> Foto/PDF</button>
              </div>
              <label htmlFor="essay" className="sr-only">Texto da redação</label>
              <textarea id="essay" className="input min-h-[420px] font-[Georgia,serif] text-[15px] leading-7" value={text} onChange={(e) => setText(e.target.value)} placeholder="Comece pela introdução: contextualize o tema e apresente sua tese com os eixos que serão desenvolvidos." />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs"><span className="muted">{words} palavras · ~{lines} linhas (de 30)</span><span className="muted flex items-center gap-1"><Save size={12} /> Rascunho salvo automaticamente</span><span className="muted">Créditos: {usage.essay}/{limits[plan].essay}</span>
                <button className="btn-primary ml-auto" disabled={busy} onClick={correct}><Send size={16} /> {busy ? 'Analisando…' : 'Solicitar correção demonstrativa'}</button></div>
            </Card>
          </div>
          <div className="space-y-3">
            <Card className="!p-4"><h2 className="mb-2 font-bold">Textos motivadores</h2><p className="muted mb-2 text-xs">Elaborados para esta demonstração.</p>{theme.texts.map((t) => <div key={t.title} className="mb-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-navy-950"><div className="text-xs font-bold">{t.title}</div>{t.body}</div>)}</Card>
            <Card className="!p-4 text-sm"><h2 className="mb-2 font-bold">Estrutura sugerida</h2><ol className="list-decimal space-y-1 pl-5 text-xs"><li>Introdução: contexto + tese + 2 eixos</li><li>D1: tópico frasal → repertório → articulação → consequência</li><li>D2: idem, segundo eixo</li><li>Conclusão: agente, ação, meio, finalidade, detalhamento</li></ol></Card>
            {last && <Card className="!p-4"><div className="text-sm font-semibold">Última correção</div><div className="font-display text-3xl font-bold">{last.eval?.total}<span className="muted text-base"> /1000</span></div><button className="btn-ghost btn-sm mt-2" onClick={() => setTab('correcao')}>Ver feedback</button></Card>}
          </div>
        </div>
      )}

      {tab === 'correcao' && (last?.eval ? <Correction text={last.text} ev={last.eval} versions={essay!.versions} onC3={(p) => { setC3Prompt(p); setTab('c3'); }} onEdit={() => setTab('escrever')} onCompare={() => setTab('versoes')} /> : <Empty title="Nenhuma correção para este tema" text="Escreva e solicite a correção demonstrativa." action={<button className="btn-primary" onClick={() => setTab('escrever')}>Escrever</button>} />)}
      {tab === 'paragrafo' && (last ? <ParagraphRewrite text={last.text} onSave={async (full) => { if (!consume('essay')) return notify('Limite mensal de correções atingido (créditos simulados).'); const r = await AI.evaluate(full, theme); saveVersion(themeId, { text: full, title, ts: Date.now(), eval: r.data }); setText(full); addXP(10, 'Reescrita de parágrafo', `para-${themeId}-${Date.now()}`); notify('Nova versão salva e reavaliada.'); }} /> : <Empty title="Faça a primeira correção para reescrever parágrafos" />)}
      {tab === 'treino' && <Training onGo={setTab} />}
      {tab === 'versoes' && <Versions versions={essay?.versions ?? []} />}
      {tab === 'c3' && <LabC3 prompt={c3Prompt} theme={theme.title} />}
      {tab === 'c5' && <LabC5 />}
      {tab === 'exemplos' && <Examples />}
      {tab === 'historico' && <Longitudinal />}

      <Modal open={upload} onClose={() => setUpload(false)} title="Enviar foto ou PDF (demonstração)">
        <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center dark:border-navy-600"><FileText className="mx-auto text-slate-400" /><p className="mt-2 text-sm">Arraste uma imagem ou PDF aqui</p><input type="file" accept="image/*,application/pdf" className="mt-3 text-xs" aria-label="Selecionar arquivo" onChange={() => notify('Arquivo recebido apenas localmente. A transcrição (OCR) não está disponível nesta demonstração.')} /></div>
        <p className="muted mt-3 text-xs">Em produção: OCR no servidor → texto revisável pelo estudante antes da correção. Nesta versão, nenhum arquivo é enviado ou processado.</p>
      </Modal>
    </div>
  );
}

function Highlighted({ text, ev, onPick }: { text: string; ev: EssayEval; onPick: (i: number) => void }) {
  const parts: React.ReactNode[] = []; let pos = 0;
  ev.highlights.forEach((h, i) => { if (h.start < pos) return; parts.push(text.slice(pos, h.start)); parts.push(<mark key={i} tabIndex={0} role="button" onClick={() => onPick(i)} onKeyDown={(e) => e.key === 'Enter' && onPick(i)} title={h.message} className={cx('cursor-pointer rounded px-0.5', h.severity === 'erro' ? 'bg-red-200/80 dark:bg-red-500/30' : h.severity === 'atencao' ? 'bg-amber-200/80 dark:bg-amber-500/30' : 'bg-mint-200')}>{text.slice(h.start, h.end)}</mark>); pos = h.end; });
  parts.push(text.slice(pos));
  return <div className="whitespace-pre-wrap font-[Georgia,serif] text-[15px] leading-7">{parts}</div>;
}

function Correction({ text, ev, versions, onC3, onEdit, onCompare }: { text: string; ev: EssayEval; versions: { eval?: EssayEval }[]; onC3: (p: string) => void; onEdit: () => void; onCompare: () => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [answer, setAnswer] = useState<{ q: string; body: React.ReactNode } | null>(null);
  const c = (id: string) => ev.competencies.find((x) => x.id === id)!;
  const ask = (q: string) => {
    if (q === 'erro') setAnswer({ q: 'Explique meu erro', body: ev.highlights.filter((h) => h.severity === 'erro').length ? <ul className="list-disc space-y-1 pl-5">{ev.highlights.filter((h) => h.severity === 'erro').map((h, i) => <li key={i}><mark className="bg-red-200/70 px-1 dark:bg-red-500/30">{text.slice(h.start, h.end)}</mark> — {h.message}</li>)}</ul> : 'Não encontrei desvios classificados como erro pelas regras. Isso não garante ausência de problemas: a correção humana é soberana.' });
    if (q === 'arg') setAnswer({ q: 'Como desenvolver melhor este argumento?', body: <ul className="list-disc space-y-1 pl-5">{c('C3').points.map((p) => <li key={p}>{p}</li>)}<li>Use a sequência: tópico frasal → repertório → articulação (“Isso evidencia que…”) → consequência (“Como resultado…”).</li><li>Explique a causa antes da consequência e evite afirmações genéricas (“é muito grave”).</li></ul> });
    if (q === 'rep') setAnswer({ q: 'Meu repertório foi produtivo?', body: <ul className="list-disc space-y-1 pl-5">{c('C2').points.map((p) => <li key={p}>{p}</li>)}<li>Repertório produtivo é aquele que você explica e conecta ao argumento — não basta citar.</li></ul> });
    if (q === 'gram') setAnswer({ q: 'Problemas de gramática', body: <ul className="list-disc space-y-1 pl-5">{ev.highlights.filter((h) => h.comp === 'C1').map((h, i) => <li key={i}><mark className="bg-amber-200/70 px-1 dark:bg-amber-500/30">{text.slice(h.start, h.end).slice(0, 60)}</mark> — {h.message}</li>)}{!ev.highlights.some((h) => h.comp === 'C1') && <li>Nenhum padrão de desvio detectado pelas regras demonstrativas.</li>}</ul> });
  };
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"><Info size={14} className="mt-0.5 shrink-0" />Estimativa formativa produzida por regras locais ({ev.engine}). Não equivale à nota oficial e pode divergir da correção humana. Use-a como orientação para reescrever.</div>
        <Card><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Seu texto com destaques</h2><span className="muted text-xs">Clique em um trecho destacado</span></div><Highlighted text={text} ev={ev} onPick={setPick} />
          {pick !== null && <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-navy-800"><Badge tone={ev.highlights[pick].severity === 'erro' ? 'red' : 'amber'}>{ev.highlights[pick].comp}</Badge> <span className="ml-1">{ev.highlights[pick].message}</span></div>}
        </Card>
        <Card><h2 className="section-title mb-3">O que pedir agora</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => ask('erro')}>Explique meu erro.</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('arg')}>Como desenvolver melhor este argumento?</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('rep')}>Meu repertório foi produtivo?</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('gram')}>Aponte problemas de gramática.</button>
            <button className="btn-ghost btn-sm" onClick={() => onC3('Escreva um parágrafo de desenvolvimento que aprofunde a principal causa do problema apontado em sua redação.')}>Me dê um exercício para melhorar a C3.</button>
            <button className="btn-ghost btn-sm" disabled={versions.length < 2} onClick={onCompare}>Compare minha primeira e minha segunda versão.</button>
          </div>
          {answer && <div className="mt-4 rounded-xl bg-navy-50 p-4 text-sm dark:bg-navy-800"><div className="mb-2 font-semibold">{answer.q}</div>{answer.body}</div>}
          <button className="btn-primary mt-4" onClick={onEdit}>Editar e reescrever</button>
        </Card>
        <Card><h2 className="section-title mb-3">Aspectos avaliados</h2><div className="grid gap-2 sm:grid-cols-2">{ev.aspects.map((a) => <div key={a.label} className="flex gap-2 text-sm">{a.status === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint-600" /> : a.status === 'parcial' ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />}<span><strong>{a.label}.</strong> <span className="muted">{a.note}</span></span></div>)}</div></Card>
      </div>
      <div className="space-y-3">
        <Card className="text-center"><div className="muted text-xs font-semibold uppercase">Estimativa total</div><div className="font-display text-5xl font-extrabold text-navy-900 dark:text-white">{ev.total}</div><div className="muted text-xs">de 1000 · não é nota oficial</div></Card>
        {ev.competencies.map((k, i) => <Card key={k.id} className="!p-4"><div className="flex items-center justify-between"><div className="font-semibold"><span style={{ color: COMP_COLORS[i] }}>{k.id}</span> · {k.name}</div><div className="font-display font-bold">{k.score}</div></div><Progress className="mt-2" value={k.score / 200} hex={COMP_COLORS[i]} />
          <p className="mt-2 text-sm">{k.justification ?? k.summary}</p>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Trechos, problemas e sugestões</summary>
            {k.evidence?.length ? <div className="mt-2"><div className="font-semibold">Trechos que sustentam a avaliação</div><ul className="mt-1 space-y-1">{k.evidence.map((e) => <li key={e} className="rounded bg-slate-100 px-2 py-1 font-[Georgia,serif] dark:bg-navy-800">{e}</li>)}</ul></div> : <p className="muted mt-2">Nenhum trecho específico associado.</p>}
            {!!k.problems?.length && <div className="mt-2"><div className="font-semibold">Problemas identificados</div><ul className="list-disc pl-4">{k.problems.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            {!!k.suggestions?.length && <div className="mt-2"><div className="font-semibold">Sugestões</div><ul className="list-disc pl-4">{k.suggestions.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            {k.exercise && <div className="mt-2 rounded bg-mint-50 p-2 dark:bg-mint-500/10"><strong>Exercício de reescrita:</strong> {k.exercise}</div>}
          </details></Card>)}
        <Card className="!p-4 text-xs"><div className="mb-1 font-semibold">C5 — elementos da proposta</div>{Object.entries(ev.intervention).map(([k, v]) => <div key={k} className="flex items-center gap-2">{v ? <CheckCircle2 size={14} className="text-mint-600" /> : <XCircle size={14} className="text-red-500" />}{k}</div>)}</Card>
      </div>
    </div>
  );
}

function Versions({ versions }: { versions: { text: string; ts: number; eval?: EssayEval }[] }) {
  const [a, setA] = useState(0); const [b, setB] = useState(Math.max(0, versions.length - 1));
  if (!versions.length) return <Empty title="Nenhuma versão salva" text="Cada correção salva uma versão." />;
  const ea = versions[a]?.eval, eb = versions[b]?.eval;
  const cmp = ea && eb ? compareVersions(ea, eb) : [];
  return (
    <div className="space-y-4">
      <Card><div className="flex flex-wrap items-end gap-3"><History size={18} /><div><label className="label !text-xs" htmlFor="va">Versão A</label><select id="va" className="input !py-2" value={a} onChange={(e) => setA(+e.target.value)}>{versions.map((v, i) => <option key={i} value={i}>v{i + 1} · {new Date(v.ts).toLocaleDateString('pt-BR')} · {v.eval?.total}</option>)}</select></div><div><label className="label !text-xs" htmlFor="vb">Versão B</label><select id="vb" className="input !py-2" value={b} onChange={(e) => setB(+e.target.value)}>{versions.map((v, i) => <option key={i} value={i}>v{i + 1} · {new Date(v.ts).toLocaleDateString('pt-BR')} · {v.eval?.total}</option>)}</select></div></div>
        {cmp.length > 0 && <div className="mt-4 grid grid-cols-5 gap-2 text-center">{cmp.map((c) => <div key={c.id} className="rounded-xl bg-slate-50 p-2 dark:bg-navy-950"><div className="text-xs font-bold">{c.id}</div><div className="text-sm">{c.before} → {c.after}</div><div className={cx('text-xs font-semibold', c.delta > 0 ? 'text-mint-600' : c.delta < 0 ? 'text-red-500' : 'muted')}>{c.delta > 0 ? '+' : ''}{c.delta}</div></div>)}</div>}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">{[a, b].map((i, k) => <Card key={k}><div className="mb-2 font-semibold">Versão {i + 1} <span className="muted text-xs">· {versions[i].eval?.total} pts</span></div><div className="whitespace-pre-wrap font-[Georgia,serif] text-sm leading-6">{diffView(versions[k === 0 ? b : a].text, versions[i].text, k === 1)}</div></Card>)}</div>
      <p className="muted text-xs">Na versão B, trechos novos aparecem destacados em verde.</p>
    </div>
  );
}
function diffView(other: string, text: string, highlightNew: boolean) {
  if (!highlightNew) return text;
  const otherSentences = new Set(other.split(/(?<=[.!?])\s+/).map((s) => s.trim()));
  return text.split(/(?<=[.!?])\s+/).map((s, i) => otherSentences.has(s.trim()) ? <span key={i}>{s} </span> : <mark key={i} className="bg-mint-200/80 dark:bg-mint-500/30">{s} </mark>);
}

function LabC3({ prompt, theme }: { prompt: string | null; theme: string }) {
  const [p, setP] = useState({ topico: '', repertorio: '', articulacao: '', consequencia: '' });
  const [fb, setFb] = useState<ReturnType<typeof evaluateParagraph> | null>(null);
  const addXP = useStore((s) => s.addXP);
  const fields: [keyof typeof p, string, string][] = [['topico', 'Tópico frasal', 'Ex.: Em primeiro lugar, a lógica de engajamento das plataformas favorece conteúdos sensacionalistas.'], ['repertorio', 'Repertório', 'Ex.: Segundo o sociólogo Zygmunt Bauman, as relações na modernidade líquida tornam-se fluidas…'], ['articulacao', 'Articulação argumentativa', 'Ex.: Isso evidencia que a confiança nas fontes também se fragiliza, já que…'], ['consequencia', 'Consequência', 'Ex.: Como consequência, o debate público é empobrecido…']];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <h2 className="section-title">Construa um parágrafo argumentativo</h2>
        <p className="muted mt-1 text-sm">{prompt ?? `Tema: ${theme}. Desenvolva um argumento seguindo a estrutura abaixo.`} A estrutura tópico frasal → repertório → articulação → consequência é uma sugestão útil, não uma regra obrigatória.</p>
        <div className="mt-4 space-y-3">{fields.map(([k, l, ph], i) => <div key={k}><label className="label" htmlFor={k}>{i + 1}. {l}</label><textarea id={k} rows={2} className="input" placeholder={ph} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></div>)}</div>
        <button className="btn-primary mt-4" onClick={() => { const r = evaluateParagraph(p); setFb(r); if (r.every((x) => x.ok)) addXP(15, 'Parágrafo completo no laboratório C3', `c3-${p.topico.slice(0, 20)}`); }}>Analisar parágrafo</button>
        {fb && <div className="mt-4 space-y-2">{fb.map((f) => <div key={f.part} className="flex gap-2 text-sm">{f.ok ? <CheckCircle2 size={16} className="mt-0.5 text-mint-600" /> : <AlertTriangle size={16} className="mt-0.5 text-amber-500" />}<span><strong>{f.part}:</strong> {f.msg}</span></div>)}<div className="rounded-xl bg-slate-50 p-3 font-[Georgia,serif] text-sm leading-6 dark:bg-navy-950">{Object.values(p).filter(Boolean).join(' ')}</div></div>}
      </Card>
      <Card className="h-fit text-sm"><h3 className="mb-2 font-bold">Exercícios para a C3</h3><ol className="list-decimal space-y-2 pl-5"><li>Reescreva um parágrafo seu trocando uma afirmação genérica por uma relação de causa e consequência.</li><li>Para cada argumento, responda: “por quê?” duas vezes seguidas.</li><li>Garanta que o tópico frasal retome um eixo anunciado na tese.</li></ol><p className="muted mt-3 text-xs">Análise por padrões textuais (demonstração). A qualidade argumentativa real exige leitura humana.</p></Card>
    </div>
  );
}

function LabC5() {
  const [v, setV] = useState({ agente: '', acao: '', meio: '', finalidade: '', detalhamento: '' });
  const [out, setOut] = useState<string | null>(null);
  const tips: Record<keyof typeof v, string> = { agente: 'Quem fará? Seja específico (ex.: Ministério da Educação, não “o governo”).', acao: 'O que será feito? Verbo concreto (implementar, ampliar, fiscalizar).', meio: 'Como? “por meio de…”, “mediante…”.', finalidade: 'Para quê? “a fim de…”, “para que…”.', detalhamento: 'Detalhe um dos elementos (ex.: como funcionariam as oficinas).' };
  const generic = /^(o )?governo$|^(a )?sociedade$|^todos$/i.test(v.agente.trim());
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><h2 className="section-title mb-3">Monte sua proposta de intervenção</h2>
        {(Object.keys(v) as (keyof typeof v)[]).map((k) => <div key={k} className="mb-3"><label className="label capitalize" htmlFor={`c5-${k}`}>{k}</label><input id={`c5-${k}`} className="input" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /><p className="muted mt-1 text-xs">{tips[k]}</p></div>)}
        <button className="btn-primary" onClick={() => setOut(`${v.agente ? v.agente[0].toUpperCase() + v.agente.slice(1) : '[Agente]'} deve ${v.acao || '[ação]'}, por meio de ${v.meio || '[meio]'}, a fim de ${v.finalidade || '[finalidade]'}${v.detalhamento ? `, ou seja, ${v.detalhamento}` : ''}.`)}>Montar proposta</button>
      </Card>
      <Card><h2 className="section-title mb-3">Resultado e verificação</h2>
        {out ? <><p className="rounded-xl bg-slate-50 p-4 font-[Georgia,serif] leading-7 dark:bg-navy-950">{out}</p>
          <ul className="mt-3 space-y-1 text-sm">{(Object.keys(v) as (keyof typeof v)[]).map((k) => <li key={k} className="flex items-center gap-2">{v[k].trim().length > 3 ? <CheckCircle2 size={16} className="text-mint-600" /> : <XCircle size={16} className="text-red-500" />}<span className="capitalize">{k}</span></li>)}</ul>
          {generic && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Agente genérico: especifique o órgão ou ator social.</p>}
          <p className="muted mt-3 text-xs">Lembre-se: além dos cinco elementos, a proposta precisa ser pertinente ao problema discutido e respeitar os direitos humanos.</p></> : <p className="muted text-sm">Preencha os campos e clique em “Montar proposta”.</p>}
      </Card>
    </div>
  );
}

function Examples() {
  const [sel, setSel] = useState(DEMO_ESSAYS[0].id);
  const d = DEMO_ESSAYS.find((x) => x.id === sel)!; const theme = ESSAY_THEMES.find((t) => t.id === d.themeId)!;
  const ev = useMemo(() => evaluateEssay(d.text, theme), [d, theme]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{DEMO_ESSAYS.map((e) => <button key={e.id} onClick={() => setSel(e.id)} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', sel === e.id ? 'border-navy-800 bg-navy-800 text-white' : 'border-slate-300 dark:border-navy-700')}>{e.label}</button>)}</div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card><div className="muted mb-1 text-xs">Tema: {theme.title}</div><Highlighted text={d.text} ev={ev} onPick={() => {}} /></Card>
        <div className="space-y-3">
          <Card className="!p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><FlaskConical size={14} /> Comentários pedagógicos</div><ul className="list-disc space-y-2 pl-4 text-sm">{d.comments.map((c) => <li key={c}>{c}</li>)}</ul></Card>
          <Card className="!p-4"><div className="font-semibold">Estimativa heurística: {ev.total}/1000</div><div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">{ev.competencies.map((c) => <div key={c.id} className="rounded bg-slate-100 py-1 dark:bg-navy-800"><div className="font-bold">{c.id}</div>{c.score}</div>)}</div></Card>
        </div>
      </div>
    </div>
  );
}

function Longitudinal() {
  const essays = useStore((s) => s.essays);
  const data = essays.flatMap((e) => e.versions).filter((v) => v.eval).sort((a, b) => a.ts - b.ts).map((v, i) => ({ n: `v${i + 1}`, ...Object.fromEntries(v.eval!.competencies.map((c) => [c.id, c.score])), total: v.eval!.total }));
  if (!data.length) return <Empty title="Sem correções ainda" />;
  return (
    <Card><h2 className="section-title mb-3">Desempenho por competência ao longo do tempo</h2>
      <div className="h-72"><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} /><XAxis dataKey="n" tick={{ fontSize: 12 }} /><YAxis domain={[0, 200]} tick={{ fontSize: 12 }} /><Tooltip /><Legend />{['C1', 'C2', 'C3', 'C4', 'C5'].map((c, i) => <Line key={c} dataKey={c} stroke={COMP_COLORS[i]} strokeWidth={2} />)}</LineChart></ResponsiveContainer></div>
      <p className="muted mt-2 text-xs">Cada ponto é uma versão corrigida (todas as redações). Estimativas formativas.</p>
    </Card>
  );
}

function ParagraphRewrite({ text, onSave }: { text: string; onSave: (full: string) => Promise<void> }) {
  const paras = text.split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean);
  const [idx, setIdx] = useState(Math.min(1, paras.length - 1));
  const role: ParagraphRole = idx === 0 ? 'introducao' : idx === paras.length - 1 ? 'conclusao' : 'desenvolvimento';
  const [draft, setDraft] = useState(paras[idx] ?? '');
  const [res, setRes] = useState<ReturnType<typeof compareParagraph> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(paras[idx] ?? ''); setRes(null); }, [idx, text]); // eslint-disable-line
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card><h2 className="section-title">Escolha um parágrafo</h2>
        <div className="mt-3 space-y-2">{paras.map((p, i) => <button key={i} onClick={() => setIdx(i)} className={cx('w-full rounded-xl border p-3 text-left text-sm', i === idx ? 'border-mint-500 bg-mint-50 dark:bg-mint-500/10' : 'border-slate-200 dark:border-navy-700')}><span className="muted text-xs font-semibold">{i === 0 ? 'Introdução' : i === paras.length - 1 ? 'Conclusão' : `Desenvolvimento ${i}`}</span><p className="line-clamp-2">{p}</p></button>)}</div>
      </Card>
      <Card><h2 className="section-title">Reescreva com suas palavras</h2><p className="muted text-xs">A NEXO compara as versões e explica o que melhorou — sem reescrever por você.</p>
        <label htmlFor="para-ed" className="sr-only">Parágrafo</label><textarea id="para-ed" rows={8} className="input mt-2 font-[Georgia,serif] leading-7" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2"><button className="btn-ghost" disabled={draft.trim() === paras[idx]} onClick={() => setRes(compareParagraph(paras[idx], draft, role))}>Comparar com a versão anterior</button>
          <button className="btn-primary" disabled={busy || draft.trim() === paras[idx]} onClick={async () => { setBusy(true); setRes(compareParagraph(paras[idx], draft, role)); const full = paras.map((p, i) => (i === idx ? draft.trim() : p)).join('\n\n'); await onSave(full); setBusy(false); }}>{busy ? 'Reavaliando…' : 'Salvar e reavaliar a redação'}</button></div>
        {res && <div className="mt-4 space-y-2 text-sm">
          {res.improved.length > 0 && <div><div className="font-semibold text-mint-700 dark:text-mint-400">O que melhorou</div><ul className="list-disc pl-5">{res.improved.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {res.regressed.length > 0 && <div><div className="font-semibold text-red-600">Atenção</div><ul className="list-disc pl-5">{res.regressed.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {res.remaining.length > 0 && <div><div className="font-semibold text-amber-700 dark:text-amber-300">Ainda pode desenvolver</div><ul className="list-disc pl-5">{res.remaining.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {!res.improved.length && !res.remaining.length && !res.regressed.length && <p className="muted">Sem mudanças detectáveis pelas regras.</p>}
          <p className="muted text-xs">{res.note}</p>
        </div>}
      </Card>
    </div>
  );
}

/** Acompanhamento de erros recorrentes e treino individualizado pela competência mais fraca. */
function Training({ onGo }: { onGo: (t: Tab) => void }) {
  const essays = useStore((s) => s.essays);
  const evals = essays.flatMap((e) => e.versions.map((v) => ({ v, themeId: e.themeId }))).filter((x) => x.v.eval).sort((a, b) => a.v.ts - b.v.ts);
  if (!evals.length) return <Empty title="Sem correções ainda" text="O treino aparece depois da primeira correção." />;
  const recent = evals.slice(-3);
  const avg = (['C1', 'C2', 'C3', 'C4', 'C5'] as const).map((id) => ({ id, v: Math.round(recent.reduce((s, x) => s + (x.v.eval!.competencies.find((c) => c.id === id)?.score ?? 0), 0) / recent.length) }));
  const weakest = [...avg].sort((a, b) => a.v - b.v)[0];
  const counts = new Map<string, number>();
  evals.forEach((x) => new Set([...x.v.eval!.highlights.map((h) => h.message), ...x.v.eval!.competencies.flatMap((c) => c.problems ?? [])]).forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1)));
  const recurring = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const last = evals[evals.length - 1].v;
  const c1Snippets = last.eval!.highlights.filter((h) => h.comp === 'C1' && h.severity === 'erro').map((h) => last.text.slice(h.start, h.end)).slice(0, 4);
  const plan: Record<string, { title: string; body: React.ReactNode }> = {
    C1: { title: 'Revisão da norma-padrão', body: c1Snippets.length ? <><p>Reescreva os trechos abaixo corrigindo o desvio, sem mudar a ideia:</p><ul className="mt-2 list-disc pl-5">{c1Snippets.map((t) => <li key={t} className="font-[Georgia,serif]">“{t}”</li>)}</ul></> : <p>Releia sua última redação em voz alta procurando períodos longos e concordância.</p> },
    C2: { title: 'Repertório produtivo', body: <p>Escolha um repertório que você consegue confirmar e escreva duas frases: uma apresentando-o e outra explicando por que ele sustenta sua tese (“Isso evidencia que…”).</p> },
    C3: { title: 'Desenvolvimento argumentativo', body: <><p>Use o Laboratório C3 para reescrever um desenvolvimento, aprofundando causa e consequência.</p><button className="btn-primary btn-sm mt-2" onClick={() => onGo('c3')}>Abrir Laboratório C3</button></> },
    C4: { title: 'Coesão', body: <p>Reescreva o início de cada parágrafo de desenvolvimento com um articulador diferente (Em primeiro lugar, Além disso, Sob essa ótica) e inclua um conectivo de causa dentro de cada parágrafo.</p> },
    C5: { title: 'Proposta de intervenção', body: <><p>Monte a proposta com agente, ação, meio, finalidade e detalhamento, pertinente ao problema discutido.</p><button className="btn-primary btn-sm mt-2" onClick={() => onGo('c5')}>Abrir Laboratório C5</button></> },
  };
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card><h2 className="section-title mb-2">Média das últimas {recent.length} correção(ões) — estimativas</h2>
        <div className="space-y-2">{avg.map((c, i) => <div key={c.id}><div className="flex justify-between text-sm"><span>{c.id}</span><span>{c.v}</span></div><Progress value={c.v / 200} hex={COMP_COLORS[i]} /></div>)}</div>
        <h3 className="mt-5 font-semibold">Problemas recorrentes (em 2+ versões)</h3>
        {recurring.length ? <ul className="mt-2 space-y-1 text-sm">{recurring.map(([m, n]) => <li key={m} className="flex justify-between gap-2"><span>{m}</span><Badge tone="red">{n}×</Badge></li>)}</ul> : <p className="muted text-sm">Nenhum problema se repetiu até agora.</p>}
      </Card>
      <Card><h2 className="section-title mb-1">Treino recomendado: {weakest.id}</h2><p className="muted mb-3 text-xs">Competência com a menor estimativa média recente. A correção automática orienta, não substitui a correção humana.</p>
        <div className="font-semibold">{plan[weakest.id].title}</div><div className="mt-2 text-sm">{plan[weakest.id].body}</div>
        <button className="btn-ghost btn-sm mt-4" onClick={() => onGo('paragrafo')}>Reescrever um parágrafo e reavaliar</button>
      </Card>
    </div>
  );
}
