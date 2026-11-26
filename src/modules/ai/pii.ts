/**
 * Minimização de dados enviados à IA (7.3/13.4): remove e-mails, CPF, telefones, URLs
 * pessoais e o nome do estudante quando aparecem incidentalmente no texto.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g;
const CEP = /\b\d{5}-\d{3}\b/g;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scrubPII(text: string, opts: { names?: string[] } = {}): { text: string; redactions: number } {
  let n = 0;
  const rep = (label: string) => () => { n++; return `[${label}]`; };
  let out = text.replace(EMAIL, rep('EMAIL')).replace(CPF, rep('DOCUMENTO')).replace(CEP, rep('CEP')).replace(PHONE, rep('TELEFONE'));
  for (const name of opts.names ?? []) {
    // Nomes próprios: correspondência sensível a maiúsculas (evita apagar palavras comuns).
    for (const part of name.split(/\s+/).filter((p) => p.length >= 3)) {
      const proper = part.charAt(0).toUpperCase() + part.slice(1);
      out = out.replace(new RegExp(`(?<!\\p{L})${escapeRe(proper)}(?!\\p{L})`, 'gu'), rep('NOME'));
    }
  }
  return { text: out, redactions: n };
}
