import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Flag, ShieldCheck, XCircle } from 'lucide-react';
import { getQuestion, useStore } from '../store/useStore';
import { QUESTIONS } from '../data/questions';
import { nextUnseen } from '../engine/strategy';
import QuestionPlayer from '../components/QuestionPlayer';
import { Badge, Empty, cx } from '../components/ui';
import EnemMedia, { EnemImage, EnemImageLightbox } from '../components/EnemMedia';
import { OFFICIAL_ENEM_SKILL_BY_ID } from '../data/enemSkills';
import { apiRequest, type OfficialEnemQuestionDTO } from '../services/api';

const AREA_LABELS: Record<OfficialEnemQuestionDTO['area'], string> = {
  LC: 'Linguagens',
  CH: 'Ciências Humanas',
  CN: 'Ciências da Natureza',
  MT: 'Matemática',
};

function OfficialEnemResolver({ id, backTo }: { id: string; backTo: string }) {
  const nav = useNavigate();
  const [question, setQuestion] = useState<OfficialEnemQuestionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<'certeza' | 'duvida' | 'chute'>('certeza');
  const [submitted, setSubmitted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setChosen(null);
    setSubmitted(false);
    setReportSent(false);
    setReportOpen(false);
    setZoom(null);

    apiRequest<{ question: OfficialEnemQuestionDTO }>(`/api/enem/questions/${encodeURIComponent(id)}`).then((res) => {
      if (!res.ok) {
        setError(res.message || 'Questão oficial não encontrada.');
        setQuestion(null);
      } else {
        setQuestion(res.data.question);
      }
      setLoading(false);
    });
  }, [id]);

  async function sendReport() {
    if (!question || reportReason.trim().length < 5) return;
    const res = await apiRequest(`/api/enem/questions/${encodeURIComponent(question.id)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: reportReason }),
    });
    if (res.ok) {
      setReportSent(true);
      setReportOpen(false);
      setReportReason('');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-sm text-ink-500">
        Carregando questão oficial do ENEM…
      </div>
    );
  }

  if (error || !question) {
    return (
      <Empty
        title={error || 'Questão não encontrada'}
        action={
          <Link className="btn-primary" to={backTo}>
            Voltar ao catálogo
          </Link>
        }
      />
    );
  }

  const isCorrect = submitted && chosen === question.correctAlternative;
  const skill = question.skillId ? OFFICIAL_ENEM_SKILL_BY_ID.get(question.skillId) : null;
  const questionLabel = `ENEM ${question.year} · Questão ${question.questionIndex}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="muted inline-flex items-center gap-1.5 text-sm hover:text-ink-900 hover:underline dark:hover:text-white"
          onClick={() => nav(backTo)}
        >
          <ArrowLeft size={14} aria-hidden /> Voltar ao catálogo
        </button>
        <button
          type="button"
          className="muted inline-flex items-center gap-1.5 text-xs hover:text-ink-900 hover:underline dark:hover:text-white"
          onClick={() => setReportOpen((v) => !v)}
        >
          <Flag size={13} aria-hidden /> Relatar erro na questão
        </button>
      </div>

      {reportOpen && (
        <div className="card space-y-2 border-amber-300 dark:border-amber-500/40">
          <label className="label text-xs" htmlFor="rep-enem">
            Descreva o problema de formatação, texto ou imagem:
          </label>
          <textarea
            id="rep-enem"
            className="input text-sm"
            rows={2}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Ex.: Imagem cortada ou alternativa desalinhada…"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setReportOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={reportReason.trim().length < 5}
              onClick={sendReport}
            >
              Enviar relato
            </button>
          </div>
        </div>
      )}

      {reportSent && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Relato enviado para revisão editorial. Obrigado!
        </div>
      )}

      <article className="card space-y-5">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge>{questionLabel}</Badge>
            <Badge>{AREA_LABELS[question.area]}</Badge>
            {question.language && (
              <Badge>{question.language === 'ingles' ? 'Inglês' : 'Espanhol'}</Badge>
            )}
            {question.skillId && <Badge>{question.skillId}</Badge>}
            {question.triB !== null && <Badge>TRI b = {question.triB.toFixed(2)}</Badge>}
          </div>
          {skill && (
            <p className="muted text-xs leading-relaxed">
              <strong className="font-medium text-ink-700 dark:text-ink-200">Habilidade oficial:</strong>{' '}
              {skill.description}
            </p>
          )}
        </header>

        <EnemMedia
          contextMd={question.contextMd}
          assets={question.assets}
          questionLabel={questionLabel}
          onZoom={(src, alt) => setZoom({ src, alt })}
        />

        {question.alternativesIntro && (
          <p className="text-[15px] font-medium leading-relaxed text-ink-900 dark:text-white">
            {question.alternativesIntro}
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="sr-only">Alternativas</legend>
          {question.alternatives.map((alt) => {
            const selected = chosen === alt.letter;
            const correct = submitted && alt.letter === question.correctAlternative;
            const wrongSelected = submitted && selected && !correct;

            return (
              <div
                key={alt.letter}
                className={cx(
                  'rounded-lg border px-3 py-2.5 text-[15px] transition-colors',
                  correct
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                    : wrongSelected
                      ? 'border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10'
                      : selected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15'
                        : 'border-ink-200 hover:border-ink-300 dark:border-ink-700',
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => setChosen(alt.letter)}
                    aria-pressed={selected}
                    className="flex flex-1 items-start gap-3 text-left disabled:cursor-default"
                  >
                    <span
                      className={cx(
                        'w-5 shrink-0 pt-0.5 text-sm font-semibold',
                        selected ? 'text-brand-700 dark:text-brand-300' : 'text-ink-400',
                      )}
                    >
                      {alt.letter}
                    </span>
                    <span className="flex-1 leading-relaxed text-ink-800 dark:text-ink-100">
                      {alt.text || (alt.assetUrl ? `Alternativa ${alt.letter} (imagem abaixo)` : '')}
                    </span>
                  </button>
                  {correct && (
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-600"
                      aria-label="Correta"
                    />
                  )}
                  {wrongSelected && (
                    <XCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-red-500"
                      aria-label="Sua resposta"
                    />
                  )}
                </div>

                {alt.assetUrl && (
                  <div className="mt-2 pl-8">
                    <EnemImage
                      src={alt.assetUrl}
                      alt={`Imagem da alternativa ${alt.letter} — ${questionLabel}`}
                      className="max-h-56"
                      onZoom={(src, a) => setZoom({ src, alt: a })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>

        {!submitted ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4 dark:border-ink-800">
            <div className="flex flex-wrap items-center gap-2 text-xs" role="radiogroup" aria-label="Confiança">
              <span className="muted">Confiança:</span>
              {(['certeza', 'duvida', 'chute'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={confidence === c}
                  onClick={() => setConfidence(c)}
                  className={cx(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    confidence === c
                      ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'border-ink-200 text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300',
                  )}
                >
                  {c === 'duvida' ? 'Dúvida' : c === 'chute' ? 'Chute' : 'Certeza'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!chosen}
              onClick={() => setSubmitted(true)}
            >
              Responder
            </button>
          </div>
        ) : (
          <div
            className={cx(
              'rounded-lg border p-4 text-sm',
              isCorrect
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                : 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {isCorrect
                ? 'Resposta correta!'
                : `Gabarito oficial: alternativa ${question.correctAlternative}`}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs opacity-85">
              <ShieldCheck size={14} aria-hidden /> Fonte oficial ENEM {question.year} · Confiança:{' '}
              {confidence === 'duvida' ? 'Dúvida' : confidence === 'chute' ? 'Chute' : 'Certeza'}
            </p>
            <div className="mt-3">
              <button type="button" className="btn-ghost btn-sm" onClick={() => nav(backTo)}>
                Voltar ao catálogo
              </button>
            </div>
          </div>
        )}
      </article>

      <EnemImageLightbox
        src={zoom?.src ?? null}
        alt={zoom?.alt ?? ''}
        onClose={() => setZoom(null)}
      />
    </div>
  );
}

/**
 * Resolve questões oficiais do ENEM (`enem-*`) com exibição completa de imagens e lightbox,
 * mantendo compatibilidade com questões locais da interface V0.2 (vindas de Percurso/Sessão).
 */
export default function Resolver() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from || '/questoes';

  if (id.startsWith('enem-')) {
    return <OfficialEnemResolver id={id} backTo={backTo} />;
  }

  const q = getQuestion(id);
  if (!q) {
    return (
      <Empty
        title="Questão não encontrada"
        action={
          <Link className="btn-primary" to={backTo}>
            Ver questões
          </Link>
        }
      />
    );
  }

  const next = () => {
    const at = useStore.getState().attempts;
    const seen = new Set(at.map((a) => a.qid));
    const n =
      nextUnseen(q.skillId, at) ??
      QUESTIONS.find((x) => x.area === q.area && !seen.has(x.id)) ??
      QUESTIONS.find((x) => !seen.has(x.id));
    nav(n ? `/questoes/${n.id}` : '/questoes');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={backTo} className="muted mb-5 inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft size={14} /> Questões
      </Link>
      <QuestionPlayer key={q.id} q={q} onDone={next} doneLabel="Próxima questão" />
    </div>
  );
}
