import { useState } from 'react';
import { Check, X, Sparkles, Gift, GraduationCap, CalendarRange, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PLANS, DEFAULT_LIMITS } from '../engine/billing';
import { PageHeader, Card, Modal, Badge, DemoBadge } from '../components/ui';

const ROWS: [string, string | boolean, string | boolean][] = [
  ['Diagnóstico inicial e Radar de Domínio', true, true],
  ['Banco de questões e questões gêmeas', 'Essenciais', 'Completo'],
  ['Mensagens com a IA Tutora / mês', `${DEFAULT_LIMITS.free.tutor}`, `${DEFAULT_LIMITS.plus.tutor}`],
  ['Correções de redação / mês', `${DEFAULT_LIMITS.free.essay}`, `${DEFAULT_LIMITS.plus.essay}`],
  ['Questões geradas / mês', `${DEFAULT_LIMITS.free.gen}`, `${DEFAULT_LIMITS.plus.gen}`],
  ['Flashcards e repetição espaçada', 'Básico', 'Completo + Mapa de Esquecimento'],
  ['Simulados', 'Rápido', 'Todos os modos'],
  ['Detetive de Erros e análises aprofundadas', false, true],
  ['Trilhas avançadas (vestibular/olimpíada)', false, true],
  ['Desafios e Arena', true, true],
];

export default function Planos() {
  const { plan, subscribe, notify } = useStore();
  const [checkout, setCheckout] = useState(false); const [step, setStep] = useState<'form' | 'ok'>('form'); const [annual, setAnnual] = useState(false);
  const Cell = ({ v }: { v: string | boolean }) => typeof v === 'boolean' ? (v ? <Check size={16} className="mx-auto text-mint-600" aria-label="Incluído" /> : <X size={16} className="mx-auto text-slate-300" aria-label="Não incluído" />) : <span className="text-xs">{v}</span>;
  return (
    <div className="space-y-6">
      <PageHeader title="Planos" subtitle="Valores ilustrativos. Nenhuma cobrança real é feita nesta demonstração."><DemoBadge label="Sem cobrança real" /></PageHeader>
      <div className="flex justify-center"><div className="flex rounded-xl bg-slate-100 p-1 dark:bg-navy-900"><button onClick={() => setAnnual(false)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!annual ? 'bg-white shadow dark:bg-navy-700' : ''}`}>Mensal</button><button onClick={() => setAnnual(true)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${annual ? 'bg-white shadow dark:bg-navy-700' : ''}`}>Anual <Badge tone="mint">em breve</Badge></button></div></div>
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        {PLANS.map((p) => <Card key={p.id} className={p.id === 'plus' ? '!border-2 !border-mint-500' : ''}><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{p.name}</h2>{p.id === 'plus' && <Badge tone="mint"><Sparkles size={12} /> Recomendado</Badge>}</div><div className="mt-2 font-display text-3xl font-extrabold">{p.id === 'plus' && annual ? 'R$ 19,90/mês*' : p.price}</div>{p.id === 'plus' && annual && <p className="muted text-xs">*Plano anual ilustrativo, ainda não disponível.</p>}<ul className="mt-4 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-mint-600" />{f}</li>)}</ul>
          <div className="mt-5">{plan === p.id ? <Badge tone="navy">Seu plano atual</Badge> : p.id === 'plus' ? <button className="btn-primary w-full" onClick={() => { setStep('form'); setCheckout(true); }}>Assinar o Plus (simulação)</button> : <button className="btn-ghost w-full" onClick={() => { subscribe('free'); notify('Plano alterado para Free (simulação).'); }}>Voltar ao Free</button>}</div></Card>)}
      </div>
      <Card className="!p-0 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-50 dark:bg-navy-950"><tr><th className="p-3 text-left">Recurso</th><th className="p-3">Free</th><th className="p-3">Plus</th></tr></thead><tbody>{ROWS.map(([r, a, b]) => <tr key={r} className="border-t border-slate-100 dark:border-navy-800"><td className="p-3">{r}</td><td className="p-3 text-center"><Cell v={a} /></td><td className="p-3 text-center"><Cell v={b} /></td></tr>)}</tbody></table></Card>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="!p-4"><Gift size={18} /><div className="mt-1 font-semibold">Programa de indicação</div><p className="muted text-xs">Espaço reservado. Benefícios nunca darão vantagem competitiva ou acadêmica.</p></Card>
        <Card className="!p-4"><GraduationCap size={18} /><div className="mt-1 font-semibold">Bolsas de acesso</div><p className="muted text-xs">Espaço reservado para bolsas a estudantes de escolas públicas.</p></Card>
        <Card className="!p-4"><CalendarRange size={18} /><div className="mt-1 font-semibold">Planos anuais</div><p className="muted text-xs">Em estudo. Limites de IA garantem sustentabilidade financeira.</p></Card>
      </div>
      <p className="muted flex items-center gap-2 text-xs"><ShieldCheck size={14} /> Assinaturas não compram XP, posições em ranking, notas ou vantagens em desafios.</p>
      <Modal open={checkout} onClose={() => setCheckout(false)} title={step === 'form' ? 'Confirmar assinatura (simulação)' : 'Assinatura confirmada'}>
        {step === 'form' ? <form onSubmit={(e) => { e.preventDefault(); subscribe('plus'); setStep('ok'); }}>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Ambiente de demonstração: nenhum dado de pagamento é solicitado ou processado. Em produção, o pagamento ocorreria em provedor certificado, com consentimento do responsável legal para menores de idade.</div>
          <div className="mt-4 flex justify-between text-sm"><span>NEXO Plus — mensal</span><strong>R$ 24,90</strong></div>
          <label className="mt-4 flex items-start gap-2 text-sm"><input required type="checkbox" className="mt-1 accent-mint-500" /> Entendo que esta é uma simulação, sem cobrança.</label>
          <button className="btn-primary mt-4 w-full">Confirmar assinatura simulada</button>
        </form> : <div className="text-center"><Check className="mx-auto text-mint-600" size={40} /><p className="mt-2 font-semibold">NEXO Plus ativado (simulação).</p><p className="muted text-sm">Os limites de IA foram ampliados. Nenhum valor foi cobrado.</p><button className="btn-primary mt-4" onClick={() => setCheckout(false)}>Continuar estudando</button></div>}
      </Modal>
    </div>
  );
}
