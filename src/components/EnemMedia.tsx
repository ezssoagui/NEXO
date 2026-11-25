import { useEffect, useState } from 'react';
import { ImageOff, Maximize2, X } from 'lucide-react';
import { cx } from './ui';

export type MediaSegment =
  | { type: 'text'; text: string }
  | { type: 'image'; alt: string; src: string };

const INLINE_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Quebra um enunciado Markdown em segmentos de texto e imagens inline,
 * evitando que marcações `![](url)` apareçam como texto bruto.
 */
export function parseEnemMarkdown(md: string): MediaSegment[] {
  if (!md) return [];
  const segments: MediaSegment[] = [];
  let lastIndex = 0;

  for (const m of md.matchAll(INLINE_IMAGE_RE)) {
    const start = m.index ?? 0;
    if (start > lastIndex) {
      const text = md.slice(lastIndex, start);
      if (text.trim()) segments.push({ type: 'text', text });
    }
    const alt = (m[1] ?? '').trim();
    const src = (m[2] ?? '').trim();
    if (src) segments.push({ type: 'image', alt, src });
    lastIndex = start + m[0].length;
  }

  if (lastIndex < md.length) {
    const tail = md.slice(lastIndex);
    if (tail.trim()) segments.push({ type: 'text', text: tail });
  }

  return segments;
}

/**
 * Remove da lista de anexos `assets[]` qualquer URL que já esteja renderizada
 * inline dentro de `contextMd`, impedindo duplicação visual da mesma figura.
 */
export function dedupeExtraAssets(md: string, assets: string[]): string[] {
  const inlineUrls = new Set(
    parseEnemMarkdown(md)
      .filter((s): s is Extract<MediaSegment, { type: 'image' }> => s.type === 'image')
      .map((s) => s.src.trim()),
  );
  const seen = new Set<string>();
  const extra: string[] = [];
  for (const raw of assets) {
    const url = raw.trim();
    if (!url || inlineUrls.has(url) || seen.has(url)) continue;
    seen.add(url);
    extra.push(url);
  }
  return extra;
}

/**
 * Remove marcações de imagem do texto para gerar um resumo limpo na lista do catálogo.
 */
export function stripMarkdownImages(md: string): string {
  return md.replace(INLINE_IMAGE_RE, ' ').replace(/\s+/g, ' ').trim();
}

function renderFormattedText(text: string) {
  return text.split(/\n\n+/).map((para, i) => (
    <p key={i} className="leading-relaxed text-ink-700 dark:text-ink-200">
      {para.split('\n').map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={k} className="font-semibold text-ink-900 dark:text-white">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            ),
          )}
        </span>
      ))}
    </p>
  ));
}

export function EnemImage({
  src,
  alt,
  className,
  onZoom,
}: {
  src: string;
  alt: string;
  className?: string;
  onZoom?: (src: string, alt: string) => void;
}) {
  const isSourceBroken = src.includes('broken-image.svg');
  const [failed, setFailed] = useState(isSourceBroken);

  useEffect(() => {
    setFailed(src.includes('broken-image.svg'));
  }, [src]);

  if (failed || isSourceBroken) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <ImageOff size={15} className="shrink-0" aria-hidden />
        <span>
          {isSourceBroken
            ? 'A fonte original desta questão não disponibilizou a figura. Você pode usar “Relatar erro” acima.'
            : 'Não foi possível carregar esta imagem. Você pode usar “Relatar erro” acima para avisar a equipe.'}
        </span>
      </div>
    );
  }

  return (
    <figure className="group relative inline-block max-w-full">
      <button
        type="button"
        onClick={() => onZoom?.(src, alt)}
        aria-label={`Ampliar imagem: ${alt}`}
        className="block max-w-full overflow-hidden rounded-lg border border-ink-200 bg-white text-left transition hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-ink-700 dark:bg-ink-900"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cx('max-h-[28rem] w-auto max-w-full object-contain', className)}
        />
        {onZoom && (
          <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-900/75 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Maximize2 size={12} aria-hidden /> Ampliar
          </span>
        )}
      </button>
    </figure>
  );
}

export function EnemImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visualização ampliada: ${alt}`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar imagem ampliada"
        className="fixed right-4 top-4 rounded-full bg-white/90 p-2 text-ink-900 shadow-lg transition hover:bg-white"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[95vw] rounded-lg bg-white object-contain shadow-2xl"
      />
    </div>
  );
}

export default function EnemMedia({
  contextMd,
  assets,
  questionLabel,
  onZoom,
}: {
  contextMd: string;
  assets: string[];
  questionLabel: string;
  onZoom: (src: string, alt: string) => void;
}) {
  const segments = parseEnemMarkdown(contextMd);
  const extraAssets = dedupeExtraAssets(contextMd, assets);

  return (
    <div className="space-y-4">
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <div key={i} className="space-y-3 text-[15px]">
            {renderFormattedText(seg.text)}
          </div>
        ) : (
          <div key={i} className="my-2">
            <EnemImage
              src={seg.src}
              alt={seg.alt || `Imagem da questão ${questionLabel}`}
              onZoom={onZoom}
            />
          </div>
        ),
      )}

      {extraAssets.length > 0 && (
        <div className="space-y-3">
          {extraAssets.map((src, i) => (
            <EnemImage
              key={src}
              src={src}
              alt={`Figura ${i + 1} da questão ${questionLabel}`}
              onZoom={onZoom}
            />
          ))}
        </div>
      )}
    </div>
  );
}
