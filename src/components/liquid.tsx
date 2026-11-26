/**
 * Recipiente preenchido por líquido (10.1): representa a PORCENTAGEM DE HABILIDADES CONSOLIDADAS
 * de um conteúdo — não o índice D individual. Valor numérico sempre visível (não depende só da cor);
 * animação contida e desativada com prefers-reduced-motion.
 */
export function LiquidContainer({ percent, label, size = 72 }: { percent: number | null; label: string; size?: number }) {
  const p = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const h = size * 1.2;
  const inner = h - 12;
  const level = 6 + inner * (1 - p / 100);
  const id = `clip-${label.replace(/[^a-z0-9]/gi, '').slice(0, 24)}-${size}`;
  return (
    <figure className="flex flex-col items-center gap-1" aria-label={`${label}: ${percent === null ? 'sem dados' : `${Math.round(p)}% das habilidades consolidadas`}`}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} role="img" aria-hidden>
        <defs>
          <clipPath id={id}>
            <rect x={6} y={6} width={size - 12} height={inner} rx={size * 0.18} />
          </clipPath>
        </defs>
        <rect x={6} y={6} width={size - 12} height={inner} rx={size * 0.18} fill="var(--surface-2)" />
        <g clipPath={`url(#${id})`}>
          <path
            d={`M0 ${level} q ${size / 4} -4 ${size / 2} 0 t ${size / 2} 0 V ${h} H 0 Z`}
            fill="var(--success)"
            opacity={0.85}
            className="motion-safe:transition-all motion-safe:duration-700"
          />
        </g>
        <rect x={6} y={6} width={size - 12} height={inner} rx={size * 0.18} fill="none" stroke="var(--border)" strokeWidth={2} />
        <text x={size / 2} y={h / 2 + 5} textAnchor="middle" fontSize={size * 0.2} fontWeight={700} fill="var(--text)">
          {percent === null ? '—' : `${Math.round(p)}%`}
        </text>
      </svg>
      <figcaption className="max-w-[9rem] text-center text-xs leading-tight text-muted">{label}</figcaption>
    </figure>
  );
}
