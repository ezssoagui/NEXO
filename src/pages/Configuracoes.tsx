import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { DEFAULT_PARAMS, PARAM_INFO, type Params } from '../engine/params';
import { deleteServer } from '../services/sync';
import AccountCard from '../components/AccountCard';
import { Modal, PageHeader, Tabs } from '../components/ui';

type Tab = 'perfil' | 'estudo' | 'parametros' | 'dados';
export default function Configuracoes() {
  const [tab, setTab] = useState<Tab>('perfil');
  return <div className="max-w-2xl"><PageHeader title="Configurações" /><Tabs tabs={[{ id: 'perfil', label: 'Perfil' }, { id: 'estudo', label: 'Preferências' }, { id: 'parametros', label: 'Parâmetros' }, { id: 'dados', label: 'Dados e privacidade' }]} value={tab} onChange={setTab} />{tab === 'perfil' ? <Perfil /> : tab === 'estudo' ? <Estudo /> : tab === 'parametros' ? <Parametros /> : <Dados />}</div>;
}
function Perfil() {
  const p = useStore((s) => s.profile)!; const update = useStore((s) => s.updateProfile); const y = new Date().getFullYear();
  return <div className="space-y-5"><div><label className="label" htmlFor="n">Apelido</label><input id="n" className="input" maxLength={20} value={p.nickname} onChange={(e) => update({ nickname: e.target.value })} /></div><div><label className="label" htmlFor="c">Curso pretendido</label><input id="c" className="input" value={p.course} onChange={(e) => update({ course: e.target.value })} /></div><div><label className="label" htmlFor="y">Ano da prova</label><select id="y" className="input" value={p.examYear} onChange={(e) => update({ examYear: +e.target.value })}>{[...new Set([p.examYear, y, y + 1, y + 2, y + 3])].sort().map((v) => <option key={v}>{v}</option>)}</select></div><div><label className="label" htmlFor="h">Tempo por semana: {p.weeklyHours} h</label><input id="h" type="range" min={2} max={40} className="w-full accent-brand-600" value={p.weeklyHours} onChange={(e) => update({ weeklyHours: +e.target.value })} /></div></div>;
}
function Estudo() {
  const s = useStore((x) => x.settings); const set = useStore((x) => x.setSetting);
  const T = ({ k, label, hint }: { k: 'dark' | 'askConfidence' | 'showTimer'; label: string; hint: string }) => <label className="row cursor-pointer"><span className="flex-1"><span className="text-sm font-medium">{label}</span><span className="muted block text-xs">{hint}</span></span><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={s[k]} onChange={(e) => set(k, e.target.checked)} /></label>;
  return <div><T k="dark" label="Modo escuro" hint="Aparência da plataforma." /><T k="askConfidence" label="Perguntar confiança" hint="Sempre opcional ao responder." /><T k="showTimer" label="Mostrar cronômetro" hint="Nas questões avulsas." /></div>;
}
function Parametros() {
  const p = useStore((s) => s.params); const set = useStore((s) => s.setParam); const reset = useStore((s) => s.resetParams);
  return <div><p className="muted mb-5 text-sm">Valores experimentais do protótipo, sem validação científica. Alterar recalcula domínio, dificuldades e recomendações a partir do mesmo histórico.</p>{(Object.keys(PARAM_INFO) as (keyof Params)[]).map((k) => { const i = PARAM_INFO[k]; return <div key={k} className="row"><label htmlFor={k} className="flex-1"><span className="text-sm font-medium">{i.label}</span><span className="muted block text-xs">{i.hint}{p[k] !== DEFAULT_PARAMS[k] ? ` Padrão: ${DEFAULT_PARAMS[k]}.` : ''}</span></label><input id={k} type="number" className="input !w-24" min={i.min} max={i.max} step={i.step} value={p[k]} onChange={(e) => { const v = +e.target.value; if (v >= i.min && v <= i.max) set(k, v); }} /></div>; })}<button className="btn-ghost btn-sm mt-4" onClick={reset}>Restaurar padrões</button></div>;
}
function Dados() {
  const nav = useNavigate(); const [del, setDel] = useState(false); const [txt, setTxt] = useState(''); const deleteAll = useStore((s) => s.deleteAll); const logout = useStore((s) => s.logout); const demo = useStore((s) => s.demo);
  const exp = () => { const data = Object.fromEntries(Object.entries(useStore.getState()).filter(([k, v]) => typeof v !== 'function' && k !== 'account')); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' })); a.download = 'nexo-meus-dados.json'; a.click(); };
  return <div className="space-y-6"><p className="muted text-sm">Coletamos o mínimo: apelido e atividade de estudo, guardados neste navegador. Nada é vendido nem usado para publicidade.</p><div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={exp}>Exportar meus dados</button><button className="btn-ghost" onClick={() => { logout(); nav('/'); }}>{demo ? 'Sair da demonstração' : 'Sair e começar outro perfil'}</button><button className="btn-danger" onClick={() => setDel(true)}>Excluir tudo</button></div><p className="muted text-xs">Sair apaga o perfil deste navegador. Exporte antes, se quiser guardar.</p><AccountCard />
    <Modal open={del} onClose={() => setDel(false)} title="Excluir perfil e histórico"><p className="text-sm">Isso apaga tudo deste navegador e do servidor, se houver conta. Digite EXCLUIR para confirmar.</p><input aria-label="Confirmação" className="input mt-3" value={txt} onChange={(e) => setTxt(e.target.value)} /><button className="btn-danger mt-3" disabled={txt !== 'EXCLUIR'} onClick={async () => { try { await deleteServer(); } catch { /* sem backend: apaga só o local */ } deleteAll(); nav('/'); }}>Excluir definitivamente</button></Modal></div>;
}
