import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getQuestion, useStore } from '../store/useStore';
import { QUESTIONS } from '../data/questions';
import { nextUnseen } from '../engine/strategy';
import QuestionPlayer from '../components/QuestionPlayer';
import { Empty } from '../components/ui';

/** Estudo adaptativo: uma questão por vez, correção logo após a resposta. */
export default function Resolver() {
  const { id = '' } = useParams(); const nav = useNavigate(); const q = getQuestion(id);
  if (!q) return <Empty title="Questão não encontrada" action={<Link className="btn-primary" to="/questoes">Ver questões</Link>} />;
  const next = () => { const at = useStore.getState().attempts; const seen = new Set(at.map((a) => a.qid)); const n = nextUnseen(q.skillId, at) ?? QUESTIONS.find((x) => x.area === q.area && !seen.has(x.id)) ?? QUESTIONS.find((x) => !seen.has(x.id)); nav(n ? `/questoes/${n.id}` : '/questoes'); };
  return <div className="mx-auto max-w-2xl"><Link to="/questoes" className="muted mb-5 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft size={14} /> Questões</Link><QuestionPlayer key={q.id} q={q} onDone={next} doneLabel="Próxima questão" /></div>;
}
