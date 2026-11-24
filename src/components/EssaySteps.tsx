import { useState } from 'react';
import type { StepKind } from '../types';
import type { EssaySkill } from '../data/essaySkills';
import { ESSAY_THEMES } from '../data/essays';
import { paragraphChecklist, type ParagraphRole } from '../engine/essay';
import { useStore } from '../store/useStore';
import { Badge, Choice, DemoTag, Rich, cx } from './ui';

const roleOf = (s: EssaySkill): ParagraphRole => (s.comp === 'C5' ? 'conclusao' : s.id === 'c3-tese' || s.id === 'c2-recorte' ? 'introducao' : 'desenvolvimento');
/** Etapas da sessão de redação: aula, análise, explicação, produção e verificação em outro tema. */
export function EssayStep({ kind, skill, onDone }: { kind: StepKind; skill: EssaySkill; onDone: (ok: boolean) => void }) {
  if (kind === 'red_aula') return <div><Badge tone="brand">Aula · {skill.comp}</Badge><h2 className="mt-3 text-lg font-semibold">{skill.name}</h2><ul className="mt-4 space-y-3 text-[15px]">{skill.lesson.map((l) => <li key={l}><Rich text={l} /></li>)}</ul><button className="btn-primary mt-6" onClick={() => onDone(true)}>Continuar</button></div>;
  if (kind === 'red_analise') return <Analysis skill={skill} onDone={onDone} />;
  if (kind === 'red_explicacao') return <ExplainEssay skill={skill} onDone={onDone} />;
  return <Produce key={kind} skill={skill} verify={kind === 'red_verificacao'} onDone={onDone} />;
}
export function Analysis({ skill, onDone }: { skill: EssaySkill; onDone: (ok: boolean) => void }) {
  const a = skill.analysis!; const [pick, setPick] = useState<number | null>(null); const add = useStore((s) => s.addEssayPractice);
  return <div><Badge tone="brand">Análise de parágrafo</Badge><blockquote className="mt-4 border-l-2 border-ink-200 pl-4 font-[Georgia,serif] leading-relaxed dark:border-ink-700">{a.text}</blockquote><p className="mt-4 text-sm font-medium">{a.question}</p><div className="mt-2 flex flex-col gap-2">{a.options.map((o, i) => <Choice key={o} disabled={pick !== null} active={pick === i} onClick={() => { setPick(i); add({ skillId: skill.id, ok: i === a.answer, kind: 'analise' }); }}>{o}</Choice>)}</div>{pick !== null && <><p className={cx('mt-3 text-sm', pick === a.answer ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')}>{a.feedback}</p><button className="btn-primary mt-5" onClick={() => onDone(pick === a.answer)}>Continuar</button></>}</div>;
}
export function ExplainEssay({ skill, onDone }: { skill: EssaySkill; onDone: (ok: boolean) => void }) {
  const [t, setT] = useState(''); const [res, setRes] = useState<boolean | null>(null); const add = useStore((s) => s.addEssayPractice);
  const submit = () => { const ok = t.trim().split(/\s+/).length >= 12 && skill.explain.need.every((r) => r.test(t)); setRes(ok); add({ skillId: skill.id, ok, kind: 'explicacao' }); };
  return <div><Badge tone="brand">Explicação ativa</Badge><h2 className="mt-3 text-lg font-semibold">{skill.explain.prompt}</h2><textarea aria-label="Sua explicação" className="input mt-4" rows={5} value={t} onChange={(e) => setT(e.target.value)} disabled={res !== null} />{res === null ? <button className="btn-primary mt-3" disabled={t.trim().length < 20} onClick={submit}>Enviar</button> : <div className="mt-4 space-y-3 text-sm"><div className="flex gap-2"><Badge tone={res ? 'green' : 'amber'}>{res ? 'Ideias centrais reconhecidas' : 'Faltaram ideias centrais'}</Badge><DemoTag>Avaliação simulada por regras</DemoTag></div><p><span className="muted">Uma explicação possível:</span> {skill.explain.reference}</p><button className="btn-primary" onClick={() => onDone(res)}>Continuar</button></div>}</div>;
}
/** Produção (tema atual) ou verificação (tema diferente do último treino). */
export function Produce({ skill, verify, onDone }: { skill: EssaySkill; verify?: boolean; onDone: (ok: boolean) => void }) {
  const essays = useStore((s) => s.essays); const practice = useStore((s) => s.essayPractice); const add = useStore((s) => s.addEssayPractice);
  const used = new Set([...essays.filter((e) => e.versions.length).map((e) => e.themeId), ...practice.filter((p) => p.kind === 'paragrafo').map((p) => p.themeId)]);
  const [theme] = useState(() => (verify ? ESSAY_THEMES.find((t) => !used.has(t.id)) ?? ESSAY_THEMES.at(-1)! : ESSAY_THEMES.find((t) => used.has(t.id)) ?? ESSAY_THEMES[0]));
  const role = roleOf(skill); const [t, setT] = useState(''); const [res, setRes] = useState<{ ok: boolean; items: { ok: boolean; msg: string }[] } | null>(null); const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  const submit = () => {
    const items = paragraphChecklist(t, role, theme).map((c) => ({ ok: c.ok, msg: c.label }));
    const ok = items.filter((i) => i.ok).length >= Math.ceil(items.length * 0.7) && words >= 35; setRes({ ok, items }); add({ skillId: skill.id, themeId: theme.id, ok, kind: verify ? 'verificacao' : 'paragrafo' });
  };
  return <div><div className="flex flex-wrap gap-2"><Badge tone="brand">{verify ? 'Verificação em outro tema' : 'Produção'}</Badge><Badge>{{ introducao: 'Introdução', desenvolvimento: 'Desenvolvimento', conclusao: 'Conclusão' }[role]}</Badge></div><h2 className="mt-3 text-lg font-semibold">{theme.title}</h2><p className="muted mt-1 text-sm">{verify ? 'Aplique a mesma habilidade em um tema novo, sem consultar.' : skill.practice}</p><textarea aria-label="Seu parágrafo" className="input mt-4 font-[Georgia,serif] text-[15px] leading-relaxed" rows={8} value={t} onChange={(e) => setT(e.target.value)} disabled={!!res} />{!res ? <div className="mt-3 flex items-center gap-3"><button className="btn-primary" disabled={words < 15} onClick={submit}>Verificar</button><span className="muted text-xs">{words} palavras</span></div> : <div className="mt-4"><div className="flex gap-2"><Badge tone={res.ok ? 'green' : 'amber'}>{res.ok ? (verify ? 'Aprendizagem verificada' : 'Bom parágrafo') : 'Ainda incompleto'}</Badge><DemoTag>Estimativa por regras</DemoTag></div><ul className="mt-3 space-y-1 text-sm">{res.items.map((i) => <li key={i.msg} className="flex gap-2"><span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', i.ok ? 'bg-emerald-500' : 'bg-amber-400')} />{i.msg}</li>)}</ul><div className="mt-5 flex gap-2"><button className="btn-primary" onClick={() => onDone(res.ok)}>Continuar</button><button className="btn-ghost" onClick={() => setRes(null)}>Reescrever</button></div></div>}</div>;
}
