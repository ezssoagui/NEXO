import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import { useStore } from '../store/useStore';
import { skillById } from '../data/skills';
import { STAGE_LABEL, STAGES } from '../engine/cycle';
import { SITUATION_LABEL } from '../engine/intervention';
import { Badge, Card, cx } from './ui';

/** Ciclos de Domínio em andamento: Diagnóstico → Investigação → Ensino → Comprovação → Consolidação. */
export default function CyclesCard({ limit = 4 }: { limit?: number }) {
  const cycles = useStore((s) => s.cycles).filter((c) => c.status !== 'concluido').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  const doneCount = useStore((s) => s.cycles).filter((c) => c.status === 'concluido').length;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between"><h2 className="section-title flex items-center gap-2"><Repeat size={18} /> Ciclos de domínio</h2><span className="muted text-xs">{doneCount} concluído(s)</span></div>
      {cycles.length === 0 ? <p className="muted text-sm">Nenhuma dificuldade aberta. Quando você errar (ou acertar com fragilidade), a NEXO abre um ciclo curto: entender o erro, comprovar com questão inédita e consolidar com revisão.</p> : (
        <ul className="space-y-3">{cycles.map((c) => {
          const idx = STAGES.indexOf(c.stage as any);
          return (
            <li key={c.id} className="rounded-xl border border-slate-200 p-3 dark:border-navy-700">
              <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{skillById(c.skillId)?.name}</span><Badge tone={c.status === 'ativo' ? 'mint' : c.status === 'adiado' ? 'amber' : 'slate'}>{c.status}</Badge><span className="muted text-xs">{SITUATION_LABEL[c.situation]}</span></div>
              <div className="mt-2 flex gap-1" aria-label={`Etapa atual: ${STAGE_LABEL[c.stage]}`}>{STAGES.map((s, i) => <div key={s} className="flex-1"><div className={cx('h-1.5 rounded-full', i <= idx ? 'bg-mint-500' : 'bg-slate-200 dark:bg-navy-800')} /><div className={cx('mt-1 text-[10px]', i === idx ? 'font-semibold' : 'muted')}>{STAGE_LABEL[s]}</div></div>)}</div>
              {c.stage !== 'consolidacao' && <Link to={`/questoes/${c.originQid}?gemea=1`} className="btn-ghost btn-sm mt-2">{c.stage === 'comprovacao' || c.status !== 'ativo' ? 'Comprovar agora' : 'Continuar'}</Link>}
              {c.stage === 'consolidacao' && <p className="muted mt-2 text-xs">Comprovado. Aguardando a revisão espaçada (em outro dia) para concluir.</p>}
            </li>
          );
        })}</ul>
      )}
    </Card>
  );
}
