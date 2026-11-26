import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, Brain, Map, PenLine } from 'lucide-react';
import { currentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  if (await currentUser()) redirect('/inicio');
  const items = [
    { icon: Brain, title: 'Rota adaptativa individual', text: 'O mesmo currículo para todos; ordem, intensidade e atividades conforme as suas evidências de aprendizagem.' },
    { icon: BookOpen, title: 'Questões oficiais do ENEM', text: 'Prática com itens oficiais, correção comentada, caderno de erros e revisões espaçadas.' },
    { icon: PenLine, title: 'Redação por competências', text: 'Correção estimada nas cinco competências, com trechos do seu texto e recomendações de reescrita.' },
    { icon: Map, title: 'Mapa de domínio', text: 'Acertos, cobertura e domínio separados: você vê o que consolidou, não só o que estudou.' },
  ];
  return (
    <div className="space-y-12 py-6">
      <section className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Preparação adaptativa para o ENEM</h1>
        <p className="text-lg text-muted">
          O NEXO identifica o que você precisa aprender, melhorar, aprofundar ou revisar — e recomenda a próxima atividade. Você mantém a autonomia: sem cronograma obrigatório nem bloqueios.
        </p>
        <div className="flex gap-3">
          <Link href="/cadastro" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-medium text-on-primary hover:bg-primary-strong">Criar conta gratuita</Link>
          <Link href="/entrar" className="inline-flex h-11 items-center rounded-lg border border-border px-5 font-medium hover:bg-surface-2">Entrar</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-surface p-5">
            <Icon className="mb-2 size-6 text-primary" aria-hidden />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>
      <p className="text-sm text-muted">Plataforma em fase de validação. Os resultados dependem do seu estudo; não há garantia de nota ou aprovação.</p>
    </div>
  );
}
