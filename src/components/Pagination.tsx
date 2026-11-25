import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from './ui';

export type PageToken = number | 'ellipsis';

/**
 * Gera a sequência compacta de páginas para navegação de catálogo
 * (sempre exibe primeira, última e janela ao redor da página atual).
 */
export function buildPageRange(current: number, total: number): PageToken[] {
  if (total <= 1) return [1];
  const safeCurrent = Math.max(1, Math.min(total, Math.floor(current)));
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const tokens: PageToken[] = [1];
  let start = Math.max(2, safeCurrent - 1);
  let end = Math.min(total - 1, safeCurrent + 1);

  if (safeCurrent <= 3) {
    start = 2;
    end = 4;
  } else if (safeCurrent >= total - 2) {
    start = total - 3;
    end = total - 1;
  }

  if (start > 2) tokens.push('ellipsis');
  for (let p = start; p <= end; p++) tokens.push(p);
  if (end < total - 1) tokens.push('ellipsis');
  tokens.push(total);

  return tokens;
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const tokens = buildPageRange(page, totalPages);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-200 pt-4 dark:border-ink-800 sm:flex-row">
      <p className="muted text-xs">
        {total > 0 ? (
          <>
            Exibindo <strong className="font-medium text-ink-900 dark:text-white">{from}–{to}</strong> de{' '}
            <strong className="font-medium text-ink-900 dark:text-white">{total.toLocaleString('pt-BR')}</strong> questões
            {' · '}Página {page} de {totalPages}
          </>
        ) : (
          '0 questões'
        )}
      </p>

      {totalPages > 1 && (
        <nav aria-label="Paginação do catálogo" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} aria-hidden />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          {tokens.map((t, i) =>
            t === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1.5 text-xs text-ink-400" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={t}
                type="button"
                disabled={disabled}
                aria-current={t === page ? 'page' : undefined}
                onClick={() => t !== page && onPageChange(t)}
                className={cx(
                  'min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  t === page
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
                )}
              >
                {t}
              </button>
            ),
          )}

          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight size={14} aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}
