'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, uuid } from '@/lib/api';
import { Button, Card, ErrorState, Loading } from '@/components/ui';
import { QuestionView, useQuestionState, type Correction, type QuestionPayload } from '@/components/question-view';
import { FeedbackButton } from '@/components/app-shell';
import { useToast } from '@/components/toast';

interface AnswerResult { attemptId: string; isCorrect: boolean | null; correctAlternative: string | null; annulled: boolean; solution: string | null; cpeEligible: boolean; classificationOffered: boolean }
const CAUSES: [string, string][] = [['knowledge_gap', 'Lacuna de conhecimento'], ['conceptual', 'Conceitual'], ['interpretive', 'Interpretação'], ['application', 'Aplicação'], ['procedural', 'Procedimento/cálculo'], ['attention', 'Atenção'], ['unknown', 'Não sei']];

/** Questão avulsa: correção após confirmação (2.4). */
export default function QuestionPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<QuestionPayload | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const st = useQuestionState();
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [key, setKey] = useState(uuid);
  const [busy, setBusy] = useState(false);
  const [classified, setClassified] = useState<string | null>(null);
  const [started, setStarted] = useState(() => Date.now());
  const toast = useToast();
  useEffect(() => {
    api<QuestionPayload>(`/api/questions/${id}`).then(setQ).catch((e) => setErr(e as ApiError));
  }, [id]);
  if (err) return <ErrorState message={err.message} />;
  if (!q) return <Loading />;
  const correction: Correction | null = result ? { correctAlternative: result.correctAlternative, isCorrect: result.isCorrect, solution: result.solution, annulled: result.annulled } : null;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/questoes" className="text-sm text-muted">← Banco de questões</Link>
      <Card className="p-5">
        <QuestionView q={q} selected={st.selected} eliminated={st.eliminated} onSelect={st.setSelected} onToggleEliminate={st.toggleEliminate} correction={correction} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <FeedbackButton entityType="question" entityId={q.id} label="Reportar erro na questão" defaultKind="question_error" />
          {!result ? (
            <Button loading={busy} disabled={!st.selected} onClick={async () => {
              setBusy(true);
              try { setResult(await api<AnswerResult>(`/api/questions/${id}/answer`, { body: { selected: st.selected, idempotencyKey: key, eliminated: st.eliminated, timeSpentMs: Date.now() - started } })); }
              catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
            }}>Confirmar resposta</Button>
          ) : <Button variant="secondary" onClick={() => { setResult(null); st.reset(); setKey(uuid()); setStarted(Date.now()); setClassified(null); }}>Responder novamente</Button>}
        </div>
      </Card>
      {result?.cpeEligible && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Que tal analisar este erro com o método <strong>CPE</strong> (Comando, Prova, Eliminação)? É opcional.</p>
          <Link href={`/questoes/cpe/${result.attemptId}`} className="text-sm font-medium text-primary">Iniciar CPE</Link>
        </Card>
      )}
      {result?.classificationOffered && (
        <Card>
          <p className="mb-2 text-sm">Opcional: o que mais contribuiu para o erro?</p>
          <div className="flex flex-wrap gap-2">
            {CAUSES.map(([k, v]) => (
              <Button key={k} size="sm" variant={classified === k ? 'primary' : 'secondary'} onClick={async () => {
                try { await api(`/api/attempts/${result.attemptId}/classification`, { body: { cause: k } }); setClassified(k); } catch (e) { toast('error', (e as Error).message); }
              }}>{v}</Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
