import { createHash } from 'node:crypto';

/** LGPD: minimização de dados. Remove identificadores pessoais antes de enviar textos ao provedor ou gravar logs. */
const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail removido]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF removido]'],
  [/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[telefone removido]'],
  [/https?:\/\/\S+/g, '[link removido]'],
];
export function scrub(text: string): string { return PATTERNS.reduce((t, [re, rep]) => t.replace(re, rep), text ?? ''); }
/** Identificador pseudonimizado (hash com sal do servidor): os logs não guardam o id original. */
export function pseudonymize(id: string): string { return createHash('sha256').update((process.env.NEXO_LOG_SALT || 'nexo-dev-salt') + ':' + (id || 'anon')).digest('hex').slice(0, 16); }
