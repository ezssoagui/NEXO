'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input, Select } from '@/components/ui';

function age(birth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const b = new Date(`${birth}T12:00:00`);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

/** Cadastro inicial (4.1/13.1/13.2): sem nível autodeclarado, horas, renda ou cronograma. */
export function OnboardingForm({ documents }: { documents: { id: string; kind: string; title: string }[] }) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const [f, setF] = useState({ displayName: '', enemTargetYear: String(year + (new Date().getMonth() >= 10 ? 1 : 0)), birthDate: '', foreignLanguage: '', courseGoal: '', universityGoal: '', currentInstitution: '', guardianEmail: '' });
  const [accepted, setAccepted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = useMemo(() => age(f.birthDate), [f.birthDate]);
  const minor = a !== null && a < 18;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card className="p-6">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        try {
          await api('/api/onboarding', { body: {
            displayName: f.displayName, enemTargetYear: Number(f.enemTargetYear), birthDate: f.birthDate, foreignLanguage: f.foreignLanguage || null,
            courseGoal: f.courseGoal || undefined, universityGoal: f.universityGoal || undefined, currentInstitution: f.currentInstitution || undefined,
            acceptedDocumentIds: accepted, guardianEmail: minor ? f.guardianEmail : undefined,
          } });
          router.push('/inicio');
          router.refresh();
        } catch (err) { setError(err instanceof ApiError ? err.message : 'Falha ao salvar.'); } finally { setBusy(false); }
      }}>
        <Input label="Como quer ser chamado(a)?" name="displayName" required maxLength={80} value={f.displayName} onChange={set('displayName')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Ano do ENEM" name="enemTargetYear" value={f.enemTargetYear} onChange={set('enemTargetYear')}>
            {[year, year + 1, year + 2, year + 3].map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Input label="Data de nascimento" name="birthDate" type="date" required value={f.birthDate} onChange={set('birthDate')} hint="Usada para proteção de menores." />
        </div>
        <Select label="Língua estrangeira (para simulados completos)" name="foreignLanguage" value={f.foreignLanguage} onChange={set('foreignLanguage')}>
          <option value="">Decidir depois</option><option value="en">Inglês</option><option value="es">Espanhol</option>
        </Select>
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Informações opcionais</summary>
          <div className="mt-3 space-y-3">
            <Input label="Curso pretendido" name="courseGoal" maxLength={120} value={f.courseGoal} onChange={set('courseGoal')} />
            <Input label="Universidade pretendida" name="universityGoal" maxLength={120} value={f.universityGoal} onChange={set('universityGoal')} />
            <Input label="Instituição atual" name="currentInstitution" maxLength={120} value={f.currentInstitution} onChange={set('currentInstitution')} />
          </div>
        </details>
        {minor && (
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="mb-2 text-sm">Como você tem menos de 18 anos, precisamos do e-mail de um(a) responsável para solicitar autorização.</p>
            <Input label="E-mail do responsável" name="guardianEmail" type="email" required value={f.guardianEmail} onChange={set('guardianEmail')} />
          </div>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Documentos</legend>
          {documents.length === 0 && <p className="text-sm text-muted">Nenhum documento publicado exige aceite neste ambiente.</p>}
          {documents.map((d) => (
            <label key={d.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={accepted.includes(d.id)} onChange={(e) => setAccepted(e.target.checked ? [...accepted, d.id] : accepted.filter((x) => x !== d.id))} />
              <span>Li e aceito: <a href={`/legal/${d.kind}`} target="_blank" className="text-primary">{d.title}</a></span>
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={busy} disabled={accepted.length < documents.length} className="w-full">Começar a estudar</Button>
      </form>
    </Card>
  );
}
