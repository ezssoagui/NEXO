import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Flag, ShieldCheck } from 'lucide-react';
import { Badge, Card, Empty, cx } from '../components/ui';
import { apiRequest, type OfficialEnemQuestionDTO } from '../services/api';
import { OFFICIAL_ENEM_SKILL_BY_ID } from '../data/enemSkills';

export default function Resolver() {
  const { id = '' } = useParams();
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    setChosen(null);
    setSubmitted(false);
    setReportSent(false);
    apiRequest<{ question: OfficialEnemQuestionDTO }>(`/api/enem/questions/${encodeURIComponent(id)}`).then((res) => {
      if (!res.ok) {
        setError(res.message || 'Questão não encontrada.');
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

  if (loading) return <Card className="mx-auto max-w-3xl py-10 text-center text-sm text-slate-500">Carregando questão oficial do ENEM…</Card>;
  if (error || !question) {
    return <Empty title={error || 'Questão não encontrada'} action={<Link className="btn-primary" to="/questoes">Voltar ao banco ENEM</Link>} />;
  }

  const isCorrect = submitted && chosen === question.correctAlternative;
  const skill = question.skillId ? OFFICIAL_ENEM_SKILL_BY_ID.get(question.skillId) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="btn-ghost btn-sm" onClick={() => nav('/questoes')}><ArrowLeft size={14} /> Banco ENEM</button>
        <button className="btn-ghost btn-sm text-slate-500" onClick={() => setReportOpen((v) => !v)}><Flag size={14} /> Reportar erro na questão</button>
      </div>

      {reportOpen && (
        <Card className="space-y-2 border-amber-300">
          <label className="label text-xs" htmlFor="rep">Descreva o problema de formatação ou imagem:</label>
          <textarea id="rep" className="input text-sm" rows={2} value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setReportOpen(false)}>Cancelar</button>
            <button className="btn-primary btn-sm" onClick={sendReport}>Enviar reporte</button>
          </div>
        </Card>
      )}
      {reportSent && <div className="rounded-xl bg-mint-50 p-3 text-xs text-mint-800 dark:bg-mint-500/10 dark:text-mint-200">Reporte enviado para a fila operacional do Admin. Obrigado!</div>}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="navy">ENEM {question.year} · Questão {question.questionIndex}</Badge>
          <Badge>{question.area}</Badge>
          {question.language && <Badge tone="sky">{question.language}</Badge>}
          {question.skillId && <Badge tone="violet">{question.skillId}</Badge>}
          {question.triB !== null && <Badge tone="slate">TRI b = {question.triB.toFixed(2)}</Badge>}
        </div>

        {skill && <p className="muted text-xs"><strong>Habilidade oficial:</strong> {skill.description}</p>}

        {question.contextMd && (
          <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-100">{question.contextMd}</div>
        )}

        {question.assets.length > 0 && (
          <div className="space-y-2">
            {question.assets.map((src) => (
              <img key={src} src={src} alt="Imagem oficial da questão ENEM" className="max-h-96 rounded-lg border border-slate-200 object-contain dark:border-navy-700" />
            ))}
          </div>
        )}

        {question.alternativesIntro && <p className="text-sm font-semibold text-navy-900 dark:text-white">{question.alternativesIntro}</p>}

        <div className="space-y-2">
          {question.alternatives.map((alt) => {
            const selected = chosen === alt.letter;
            const correct = submitted && alt.letter === question.correctAlternative;
            const wrongSelected = submitted && selected && !correct;
            return (
              <button
                key={alt.letter}
                disabled={submitted}
                onClick={() => setChosen(alt.letter)}
                className={cx(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition',
                  correct
                    ? 'border-mint-500 bg-mint-50 dark:bg-mint-500/15'
                    : wrongSelected
                      ? 'border-red-400 bg-red-50 dark:bg-red-500/15'
                      : selected
                        ? 'border-navy-700 bg-navy-50 dark:border-mint-400 dark:bg-navy-800'
                        : 'border-slate-200 hover:border-slate-300 dark:border-navy-700',
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold dark:bg-navy-800">{alt.letter}</span>
                <div className="flex-1 space-y-1">
                  {alt.text && <span>{alt.text}</span>}
                  {alt.assetUrl && <img src={alt.assetUrl} alt={`Alternativa ${alt.letter}`} className="max-h-40 rounded border object-contain" />}
                </div>
              </button>
            );
          })}
        </div>

        {!submitted ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-navy-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="muted">Confiança:</span>
              {(['certeza', 'duvida', 'chute'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConfidence(c)}
                  className={cx('rounded-lg px-2.5 py-1 font-medium capitalize', confidence === c ? 'bg-navy-800 text-white dark:bg-mint-500 dark:text-navy-950' : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300')}
                >
                  {c === 'duvida' ? 'Dúvida' : c === 'chute' ? 'Chute' : 'Certeza'}
                </button>
              ))}
            </div>
            <button className="btn-primary" disabled={!chosen} onClick={() => setSubmitted(true)}>
              Responder
            </button>
          </div>
        ) : (
          <div className={cx('rounded-xl p-4 text-sm', isCorrect ? 'bg-mint-50 text-mint-900 dark:bg-mint-500/15 dark:text-mint-100' : 'bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100')}>
            <div className="flex items-center gap-2 font-semibold">
              {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {isCorrect ? 'Acertou!' : `Gabarito oficial: alternativa ${question.correctAlternative}`}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs opacity-80">
              <ShieldCheck size={14} /> Fonte oficial ENEM {question.year} · Confiança registrada: {confidence}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
