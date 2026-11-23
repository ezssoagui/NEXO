import type { EssayEval } from '../types';
import type { EssayTheme } from '../data/essays';

/**
 * Avaliador HEURÍSTICO demonstrativo (regras + padrões textuais). NÃO é um modelo de IA nem substitui correção humana.
 * Estrutura inspirada nas cinco competências da matriz de redação do ENEM. Estimativas formativas, não nota oficial.
 */
export const ESSAY_ENGINE = 'Motor heurístico NEXO v0.3 (demonstração — regras locais, sem IA real)';

const CONNECTIVES = ['além disso', 'ademais', 'outrossim', 'em primeiro lugar', 'em segundo lugar', 'primeiramente', 'nesse sentido', 'nesse contexto', 'nesse cenário', 'dessa forma', 'desse modo', 'dessa maneira', 'assim', 'portanto', 'logo', 'por conseguinte', 'consequentemente', 'como consequência', 'por isso', 'contudo', 'entretanto', 'no entanto', 'todavia', 'porém', 'embora', 'visto que', 'uma vez que', 'já que', 'porque', 'pois', 'devido', 'em razão de', 'por fim', 'sob essa ótica', 'paralelamente', 'em suma', 'diante disso', 'à vista disso', 'isto é', 'ou seja', 'haja vista', 'de fato', 'sobretudo'];
const CAUSAL = ['porque', 'visto que', 'uma vez que', 'já que', 'devido', 'em razão de', 'consequentemente', 'como consequência', 'por isso', 'dessa forma', 'desse modo', 'logo', 'o que', 'gera', 'provoca', 'resulta', 'compromete', 'acarreta'];
const AGENTS = ['ministério', 'governo federal', 'poder legislativo', 'poder executivo', 'poder público', 'congresso', 'secretaria', 'escolas', 'escola', 'mídia', 'ongs', 'sociedade civil', 'família', 'famílias', 'estado', 'prefeituras', 'municípios', 'empresas', 'plataformas', 'universidades', 'governo'];
const MEANS = ['por meio de', 'mediante', 'através de', 'por intermédio de', 'com o auxílio de', 'com o apoio de', 'a partir de'];
const FINALITY = ['a fim de', 'para que', 'com o objetivo de', 'com a finalidade de', 'visando', 'com o intuito de', 'de modo a'];
const DETAIL = ['ou seja', 'isto é', 'por exemplo', 'tais como', 'como oficinas', 'a exemplo de', 'com destaque para', 'paralelamente', 'de modo que', 'as quais', 'os quais', 'que contemplem'];
const ACTION = /\b(deve|devem|deverá|deverão|cabe a|cabe ao|cabe às|cabe aos|precisa|precisam|é necessário que|é fundamental que)\b/i;
const SAFE_REPERTOIRE = ['bauman', 'constituição federal de 1988', 'constituição de 1988', 'estatuto da criança e do adolescente', 'declaração universal dos direitos humanos', 'paulo freire', 'durkheim', 'kant', 'aristóteles', 'hannah arendt', 'simone de beauvoir', 'milton santos', 'sérgio buarque', 'foucault', 'habermas', 'byung-chul han', 'emenda constitucional', 'artigo 6º', 'sus', 'raps', 'lei de diretrizes e bases'];
const REPERTOIRE_MARK = /\b(segundo|de acordo com|conforme|consoante|para o filósofo|para a filósofa|o sociólogo|a socióloga|o filósofo|a filósofa|constituição|declaração universal|estatuto|lei n|historiador|pensador|como disse|obra|o livro|o filme|a série)\b/i;

interface Rule { re: RegExp; comp: string; severity: 'erro' | 'atencao'; message: string }
const RULES: Rule[] = [
  { re: /\b(eles|elas|todos|todas|pessoas|jovens|alunos|estudantes|cidadãos)\s+tem\b/gi, comp: 'C1', severity: 'erro', message: 'Concordância: no plural, use "têm" (com acento circunflexo).' },
  { re: /\bhouveram\b/gi, comp: 'C1', severity: 'erro', message: '"Haver" no sentido de existir é impessoal: use "houve".' },
  { re: /\bfazem\s+\d+\s+anos\b/gi, comp: 'C1', severity: 'erro', message: '"Fazer" indicando tempo é impessoal: "faz X anos".' },
  { re: /\bmenas\b/gi, comp: 'C1', severity: 'erro', message: '"Menas" não existe na norma-padrão: use "menos".' },
  { re: /\bconcerteza\b/gi, comp: 'C1', severity: 'erro', message: 'Grafia: "com certeza" (separado).' },
  { re: /\bderrepente\b/gi, comp: 'C1', severity: 'erro', message: 'Grafia: "de repente".' },
  { re: /\bà\s+(partir|ser|o|um|ele|todos|pé)\b/gi, comp: 'C1', severity: 'erro', message: 'Crase indevida antes de verbo, palavra masculina ou pronome.' },
  { re: /\ba nível de\b/gi, comp: 'C1', severity: 'atencao', message: 'Evite "a nível de"; prefira "em relação a" ou "no âmbito de".' },
  { re: /(^|[.!?]\s+)Mas,\s/g, comp: 'C1', severity: 'atencao', message: 'Não se usa vírgula logo após "Mas" iniciando oração.' },
  { re: /(^|\n)\s*(Portanto|Logo|Assim)\s(?!,)/g, comp: 'C1', severity: 'atencao', message: 'Conector conclusivo no início do parágrafo: recomenda-se vírgula depois dele.' },
  { re: /\b(você|vocês|a gente)\b/gi, comp: 'C1', severity: 'atencao', message: 'Evite marcas de interlocução/informalidade no texto dissertativo-argumentativo.' },
  { re: /\b(tipo assim|né|aí então)\b/gi, comp: 'C1', severity: 'erro', message: 'Marca de oralidade inadequada ao registro formal.' },
  { re: /[.!?]\s+[a-zà-ú]/g, comp: 'C1', severity: 'erro', message: 'Início de frase com letra minúscula.' },
  { re: /\b(coisa|coisas|alguma coisa)\b/gi, comp: 'C3', severity: 'atencao', message: 'Vocabulário vago: especifique a que se refere.' },
];
const FACT_CHECKS: Rule[] = [
  { re: /Constituição( Federal)? de (?!1988)\d{4}/g, comp: 'C2', severity: 'erro', message: 'Repertório possivelmente incorreto: a Constituição Federal vigente é de 1988.' },
  { re: /Declaração Universal dos Direitos Humanos,? de (?!1948)\d{4}/g, comp: 'C2', severity: 'erro', message: 'Repertório possivelmente incorreto: a DUDH é de 1948.' },
  { re: /(como disse|segundo|conforme)\s+Einstein[^.]*/gi, comp: 'C2', severity: 'atencao', message: 'Citação atribuída a Einstein não verificável: frases apócrifas são comuns. Use repertório que você consegue confirmar.' },
  { re: /como (disse|afirmou|dizia)\s+[A-Z][a-zà-ú]+[^.]*"[^"]+"/g, comp: 'C2', severity: 'atencao', message: 'Citação direta: a demonstração não verifica autoria. Confirme a fonte antes de usar.' },
];

const norm = (s: string) => s.toLowerCase();
const level = (x: number) => Math.max(0, Math.min(200, Math.round(x / 40) * 40));

export function evaluateEssay(text: string, theme: EssayTheme): EssayEval {
  const clean = text.replace(/\r/g, '');
  const paragraphs = clean.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const words = (clean.match(/[A-Za-zÀ-ú0-9]+/g) ?? []).length;
  const sentences = clean.split(/[.!?]+\s/).filter((s) => s.trim().length > 3);
  const lower = norm(clean);
  const highlights: EssayEval['highlights'] = [];
  const addMatches = (rules: Rule[]) => rules.forEach((r) => { for (const m of clean.matchAll(r.re)) { const off = m[1] && /^[.!?\s\n]/.test(m[1]) ? m[1].length : 0; highlights.push({ start: m.index! + off, end: m.index! + m[0].length, comp: r.comp, severity: r.severity, message: r.message }); } });
  addMatches(RULES); addMatches(FACT_CHECKS);
  sentences.forEach((s) => { const w = s.split(/\s+/).length; if (w > 55) { const i = clean.indexOf(s.trim().slice(0, 30)); if (i >= 0) highlights.push({ start: i, end: i + Math.min(s.trim().length, 120), comp: 'C1', severity: 'atencao', message: `Período muito longo (${w} palavras): considere dividi-lo.` }); } });

  if (words < 60) {
    const z = (id: any, name: string) => ({ id, name, score: 0, summary: 'Texto insuficiente para avaliação (menos de 60 palavras).', points: [] as string[] });
    return { competencies: [z('C1', 'Modalidade escrita formal'), z('C2', 'Tema e repertório'), z('C3', 'Argumentação'), z('C4', 'Coesão'), z('C5', 'Proposta de intervenção')], total: 0, highlights, aspects: [], intervention: { agente: false, acao: false, meio: false, finalidade: false, detalhamento: false }, stats: { words, paragraphs: paragraphs.length, sentences: sentences.length, avgSentence: 0, connectives: [] }, engine: ESSAY_ENGINE };
  }

  // C1
  const gErr = highlights.filter((h) => h.comp === 'C1' && h.severity === 'erro').length;
  const gAt = highlights.filter((h) => h.comp === 'C1' && h.severity === 'atencao').length;
  const eff = gErr + gAt * 0.5;
  let c1 = eff <= 1 ? 200 : eff <= 3 ? 160 : eff <= 5 ? 120 : eff <= 8 ? 80 : 40;
  if (words < 150) c1 = Math.min(c1, 120);
  const c1p = [`${gErr} desvio(s) e ${gAt} ponto(s) de atenção identificados por regras.`, words < 150 ? 'Texto curto: amostra insuficiente para demonstrar domínio pleno.' : 'Extensão adequada.'];

  // C2
  const kw = theme.keywords.filter((k) => lower.includes(norm(k)));
  const repMatches = paragraphs.map((p, i) => ({ i, has: REPERTOIRE_MARK.test(p) || SAFE_REPERTOIRE.some((s) => norm(p).includes(s)) }));
  const repParas = repMatches.filter((r) => r.has).map((r) => r.i);
  const safeRep = SAFE_REPERTOIRE.filter((s) => lower.includes(s));
  const wrongFacts = highlights.filter((h) => h.comp === 'C2' && h.severity === 'erro').length;
  const doubtful = highlights.filter((h) => h.comp === 'C2' && h.severity === 'atencao').length;
  const productive = repParas.some((i) => i > 0 && i < paragraphs.length - 1 && (paragraphs[i].split(/[.!?]+\s/).length >= 3) && CAUSAL.some((c) => norm(paragraphs[i]).includes(c)));
  let c2 = kw.length === 0 ? 40 : 80;
  if (kw.length >= 3) c2 += 40; if (repParas.length) c2 += 40; if (productive && wrongFacts === 0) c2 += 40; if (paragraphs.length < 4) c2 -= 40; if (wrongFacts) c2 -= 40;
  c2 = level(c2);
  const c2p = [`Palavras-chave do tema presentes: ${kw.length ? kw.slice(0, 5).join(', ') : 'nenhuma (risco de tangenciamento)'}.`,
    repParas.length ? `Repertório identificado em ${repParas.length} parágrafo(s)${safeRep.length ? ` (${safeRep.join(', ')})` : ''}.` : 'Nenhum repertório sociocultural identificado.',
    productive ? 'Repertório articulado ao argumento (há relação causal no mesmo parágrafo).' : 'Repertório pouco articulado ou ausente: explique como ele sustenta sua tese.',
    ...(wrongFacts ? ['Há repertório possivelmente incorreto (ver destaques).'] : []), ...(doubtful ? ['Há citação de autoria não verificável (ver destaques).'] : [])];

  // C3
  const intro = paragraphs[0] ?? ''; const devs = paragraphs.slice(1, -1); const concl = paragraphs[paragraphs.length - 1] ?? '';
  const thesis = /(devido|em razão|por causa|sobretudo|decorre|motivad|fatores|seja pel|tanto .* quanto)/i.test(intro) && intro.split(/[.!?]+\s/).length >= 2;
  const topicSent = devs.filter((d) => /^(em primeiro lugar|primeiramente|além disso|ademais|outrossim|em segundo lugar|sob essa ótica|nesse sentido|de início|por outro lado|um dos|outro)/i.test(d)).length;
  const devDepth = devs.filter((d) => d.split(/\s+/).length >= 55 && CAUSAL.some((c) => norm(d).includes(c))).length;
  let c3 = 40; if (paragraphs.length >= 4) c3 += 40; if (thesis) c3 += 40; if (devs.length && topicSent >= Math.min(2, devs.length)) c3 += 40; if (devs.length && devDepth >= Math.min(2, devs.length)) c3 += 40;
  if (/alguma coisa|coisas/i.test(clean)) c3 -= 40;
  c3 = level(c3);
  const c3p = [thesis ? 'Tese identificável na introdução, com eixos de discussão.' : 'Tese pouco clara: anuncie na introdução os eixos que serão desenvolvidos.',
    `${topicSent} de ${devs.length} desenvolvimento(s) com tópico frasal marcado.`,
    `${devDepth} de ${devs.length} desenvolvimento(s) com aprofundamento (extensão + relação de causa/consequência).`];

  // C4
  const used = CONNECTIVES.filter((c) => new RegExp(`(^|[^a-zà-ú])${c}([^a-zà-ú]|$)`, 'i').test(clean));
  const interPara = paragraphs.slice(1).filter((p) => CONNECTIVES.some((c) => norm(p).startsWith(c))).length;
  const repeated = CONNECTIVES.filter((c) => (lower.match(new RegExp(`(^|[^a-zà-ú])${c}([^a-zà-ú]|$)`, 'g')) ?? []).length > 3);
  let c4 = used.length >= 8 ? 200 : used.length >= 6 ? 160 : used.length >= 4 ? 120 : used.length >= 2 ? 80 : 40;
  if (interPara < Math.min(2, paragraphs.length - 1)) c4 -= 40; if (repeated.length) c4 -= 40; c4 = level(c4);
  const c4p = [`${used.length} conectivo(s) diferentes: ${used.slice(0, 8).join(', ') || '—'}.`, `${interPara} parágrafo(s) iniciados por articulador.`, ...(repeated.length ? [`Repetição excessiva: ${repeated.join(', ')}.`] : [])];

  // C5
  const cl = norm(concl);
  const iv = { agente: AGENTS.some((a) => cl.includes(a)), acao: ACTION.test(concl), meio: MEANS.some((m) => cl.includes(m)), finalidade: FINALITY.some((f) => cl.includes(f)), detalhamento: DETAIL.some((d) => cl.includes(d)) };
  const genericAgent = iv.agente && !AGENTS.slice(0, -1).some((a) => cl.includes(a));
  const vague = /alguma coisa|algo para|resolver esse problema/i.test(concl);
  let c5 = Object.values(iv).filter(Boolean).length * 40; if (vague) c5 = Math.max(0, c5 - 40);
  c5 = level(c5);
  const c5p = [`Elementos encontrados: ${Object.entries(iv).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nenhum'}.`, ...(genericAgent ? ['Agente genérico ("governo"): especifique o órgão responsável.'] : []), ...(vague ? ['Ação vaga: diga concretamente o que será feito.'] : []), 'Pertinência e articulação com a discussão exigem leitura humana.'];

  // ---- Feedback formativo por competência: justificativa, trechos do PRÓPRIO texto, problemas, sugestões e exercício ----
  const sentencesOf = (t: string) => t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const allSent = sentencesOf(clean);
  const quote = (t: string) => `“${t.length > 160 ? t.slice(0, 157) + '…' : t}”`;
  const c1Errors = highlights.filter((h) => h.comp === 'C1');
  const repSent = allSent.filter((x) => REPERTOIRE_MARK.test(x) || SAFE_REPERTOIRE.some((r) => norm(x).includes(r)));
  const connSent = allSent.filter((x) => CONNECTIVES.some((c) => norm(x).startsWith(c)));
  const topicSents = devs.map((d) => sentencesOf(d)[0]).filter(Boolean);
  const comp = (id: 'C1' | 'C2' | 'C3' | 'C4' | 'C5', name: string, score: number, summary: string, points: string[], justification: string, evidence: string[], problems: string[], suggestions: string[], exercise?: string) =>
    ({ id, name, score, summary, points, justification, evidence: evidence.slice(0, 3).map(quote), problems, suggestions, exercise });
  const competencies: EssayEval['competencies'] = [
    comp('C1', 'Domínio da modalidade escrita formal', c1, c1 >= 160 ? 'Poucos desvios detectados.' : 'Revise os desvios destacados no texto.', c1p,
      `${gErr} desvio(s) e ${gAt} ponto(s) de atenção encontrados por regras verificáveis${words < 150 ? '; o texto curto limita a demonstração de domínio' : ''}. Nenhum desconto é aplicado sem um trecho identificado.`,
      c1Errors.map((h) => clean.slice(h.start, h.end)), c1Errors.slice(0, 4).map((h) => h.message),
      c1 >= 160 ? ['Mantenha a revisão final focada em concordância e pontuação.'] : ['Corrija os trechos destacados e releia em voz alta para notar períodos longos.'],
      c1Errors.length ? `Reescreva o período ${quote(allSent.find((x) => c1Errors.some((h) => x.includes(clean.slice(h.start, h.end)))) ?? '')} corrigindo o desvio, sem mudar a ideia.` : undefined),
    comp('C2', 'Compreensão do tema e repertório', c2, c2 >= 160 ? 'Tema bem abordado, com repertório.' : 'Amplie o repertório e articule-o ao tema.', c2p,
      `${kw.length} palavra(s)-chave do tema presentes; repertório ${repParas.length ? (productive ? 'identificado e articulado ao argumento' : 'identificado, mas pouco articulado') : 'não identificado'}${wrongFacts ? '; há informação possivelmente incorreta' : ''}.`,
      repSent.length ? repSent : allSent.filter((x) => theme.keywords.some((k) => norm(x).includes(norm(k)))),
      [...(kw.length < 3 ? ['Pouca relação explícita com as palavras-chave do tema (risco de tangenciamento).'] : []), ...(repParas.length ? [] : ['Ausência de repertório sociocultural.']), ...(repParas.length && !productive ? ['O repertório aparece, mas não é explicado nem ligado ao argumento.'] : []), ...highlights.filter((h) => h.comp === 'C2').map((h) => h.message)],
      ['Depois de citar um repertório, explique em uma frase como ele comprova sua tese ("Isso evidencia que...").', ...(wrongFacts || doubtful ? ['Use apenas repertórios que você consegue confirmar.'] : [])],
      repParas.length ? 'Reescreva o parágrafo com repertório acrescentando uma frase de articulação: repertório → por que ele sustenta o argumento.' : 'Escolha um repertório que você domina (lei, dado verificado, obra, fato histórico) e insira-o em um desenvolvimento.'),
    comp('C3', 'Seleção e organização dos argumentos', c3, c3 >= 160 ? 'Argumentação organizada e desenvolvida.' : 'Desenvolva causas e consequências em cada argumento.', c3p,
      `${thesis ? 'Tese identificável' : 'Tese pouco clara'}; ${topicSent}/${devs.length} desenvolvimento(s) com tópico frasal e ${devDepth}/${devs.length} com aprofundamento causal.`,
      [...(thesis ? [sentencesOf(intro).slice(-1)[0] ?? ''] : []), ...topicSents].filter(Boolean),
      [...(thesis ? [] : ['A introdução não anuncia claramente os eixos da argumentação.']), ...(devs.length && devDepth < devs.length ? ['Há desenvolvimento com afirmações sem causa ou consequência explicadas.'] : []), ...(/alguma coisa|coisas/i.test(clean) ? ['Vocabulário vago enfraquece o argumento.'] : [])],
      ['Use a sequência tópico frasal → repertório → articulação → consequência.', 'Para cada afirmação, pergunte "por quê?" e "o que isso provoca?".'],
      'Laboratório C3: reescreva um desenvolvimento seguindo a estrutura em quatro partes.'),
    comp('C4', 'Mecanismos de coesão', c4, c4 >= 160 ? 'Boa variedade de articuladores.' : 'Varie os conectivos entre e dentro dos parágrafos.', c4p,
      `${used.length} conectivo(s) diferentes; ${interPara} parágrafo(s) iniciados por articulador${repeated.length ? `; repetição de ${repeated.join(', ')}` : ''}.`,
      connSent, [...(interPara < Math.min(2, paragraphs.length - 1) ? ['Parágrafos começam sem articulador que os ligue ao anterior.'] : []), ...(repeated.length ? [`Repetição excessiva de: ${repeated.join(', ')}.`] : []), ...(used.length < 4 ? ['Pouca variedade de conectivos.'] : [])],
      ['Inicie cada desenvolvimento com um articulador (Em primeiro lugar, Além disso, Sob essa ótica).', 'Use conectivos de causa e consequência dentro dos parágrafos (visto que, dessa forma, por conseguinte).'],
      used.length < 6 ? 'Reescreva o início de cada parágrafo de desenvolvimento com um articulador diferente.' : undefined),
    comp('C5', 'Proposta de intervenção', c5, c5 >= 160 ? 'Proposta completa.' : 'Inclua agente, ação, meio, finalidade e detalhamento.', c5p,
      `Elementos identificados na conclusão: ${Object.entries(iv).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nenhum'}. A pertinência ao problema discutido exige leitura humana.`,
      sentencesOf(concl).filter((x) => ACTION.test(x) || MEANS.some((m) => norm(x).includes(m))),
      [...Object.entries(iv).filter(([, v]) => !v).map(([k]) => `Elemento ausente: ${k}.`), ...(genericAgent ? ['Agente genérico ("governo").'] : []), ...(vague ? ['Ação vaga.'] : [])],
      ['Monte a proposta: agente específico + ação concreta + "por meio de" + "a fim de" + detalhamento ("ou seja...").'],
      Object.values(iv).some((v) => !v) ? 'Laboratório C5: reescreva a conclusão incluindo os elementos ausentes.' : undefined),
  ];
  const aspects: EssayEval['aspects'] = [
    { label: 'Tese', status: thesis ? 'ok' : 'parcial', note: c3p[0] },
    { label: 'Tópicos frasais', status: topicSent >= Math.min(2, devs.length) ? 'ok' : topicSent ? 'parcial' : 'ausente', note: c3p[1] },
    { label: 'Repertório sociocultural', status: repParas.length ? (wrongFacts ? 'parcial' : 'ok') : 'ausente', note: c2p[1] },
    { label: 'Relação repertório–argumento', status: productive ? 'ok' : repParas.length ? 'parcial' : 'ausente', note: c2p[2] },
    { label: 'Causas e consequências', status: devDepth >= Math.min(2, devs.length) ? 'ok' : devDepth ? 'parcial' : 'ausente', note: c3p[2] },
    { label: 'Progressão argumentativa', status: paragraphs.length >= 4 && interPara >= 2 ? 'ok' : 'parcial', note: `${paragraphs.length} parágrafos.` },
    { label: 'Coesão', status: c4 >= 160 ? 'ok' : c4 >= 80 ? 'parcial' : 'ausente', note: c4p[0] },
    { label: 'Gramática', status: c1 >= 160 ? 'ok' : c1 >= 80 ? 'parcial' : 'ausente', note: c1p[0] },
    { label: 'Adequação ao tema', status: kw.length >= 3 ? 'ok' : kw.length ? 'parcial' : 'ausente', note: c2p[0] },
    { label: 'Proposta de intervenção', status: c5 >= 160 ? 'ok' : c5 ? 'parcial' : 'ausente', note: c5p[0] },
  ];
  highlights.sort((a, b) => a.start - b.start);
  return { competencies, total: c1 + c2 + c3 + c4 + c5, highlights, aspects, intervention: iv, stats: { words, paragraphs: paragraphs.length, sentences: sentences.length, avgSentence: Math.round(words / Math.max(1, sentences.length)), connectives: used }, engine: ESSAY_ENGINE };
}

/** Avaliação de um parágrafo do laboratório C3: tópico frasal → repertório → articulação → consequência. */
export function evaluateParagraph(parts: { topico: string; repertorio: string; articulacao: string; consequencia: string }) {
  const fb: { part: string; ok: boolean; msg: string }[] = [];
  fb.push({ part: 'Tópico frasal', ok: parts.topico.split(/\s+/).length >= 8, msg: parts.topico.split(/\s+/).length >= 8 ? 'Apresenta a ideia central do parágrafo.' : 'Muito curto: o tópico frasal deve anunciar claramente o argumento.' });
  const rep = REPERTOIRE_MARK.test(parts.repertorio) || SAFE_REPERTOIRE.some((s) => norm(parts.repertorio).includes(s));
  fb.push({ part: 'Repertório', ok: rep, msg: rep ? 'Há referência identificável. Confirme que a informação é verdadeira.' : 'Não identifiquei referência (autor, lei, dado, obra, fato histórico).' });
  const art = /(isso|esse|essa|tal|dessa forma|nesse sentido|assim|o que|evidencia|demonstra|revela|mostra)/i.test(parts.articulacao) && parts.articulacao.split(/\s+/).length >= 12;
  fb.push({ part: 'Articulação argumentativa', ok: art, msg: art ? 'Retoma o repertório e o conecta ao argumento.' : 'Explique COMO o repertório comprova sua ideia, retomando-o ("Isso evidencia que...").' });
  const cons = /(consequ|resulta|acarreta|compromete|gera|provoca|logo|portanto|por conseguinte|assim)/i.test(parts.consequencia);
  fb.push({ part: 'Consequência', ok: cons, msg: cons ? 'Fecha o parágrafo com efeito do problema.' : 'Termine apontando uma consequência concreta do problema.' });
  return fb;
}

export function compareVersions(a: EssayEval, b: EssayEval) {
  return a.competencies.map((c, i) => ({ id: c.id, before: c.score, after: b.competencies[i].score, delta: b.competencies[i].score - c.score }));
}

/** Reescrita de parágrafo: avalia antes e depois e explica o que melhorou e o que ainda falta. Não reescreve pelo aluno. */
export type ParagraphRole = 'introducao' | 'desenvolvimento' | 'conclusao';
function paraFeatures(t: string, role: ParagraphRole) {
  const l = norm(t);
  const errors: string[] = [];
  RULES.forEach((r) => { for (const m of t.matchAll(r.re)) errors.push(`${m[0].trim()} — ${r.message}`); });
  const sentences = t.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 3);
  return {
    words: (t.match(/[A-Za-zÀ-ú0-9]+/g) ?? []).length,
    errors,
    connectives: CONNECTIVES.filter((c) => new RegExp(`(^|[^a-zà-ú])${c}([^a-zà-ú]|$)`, 'i').test(t)),
    causal: CAUSAL.filter((c) => l.includes(c)).length,
    repertoire: REPERTOIRE_MARK.test(t) || SAFE_REPERTOIRE.some((r) => l.includes(r)),
    topic: /^(em primeiro lugar|primeiramente|além disso|ademais|outrossim|em segundo lugar|sob essa ótica|nesse sentido|de início|por outro lado|um dos|outro)/i.test(t.trim()),
    longSentences: sentences.filter((x) => x.split(/\s+/).length > 55).length,
    iv: role === 'conclusao' ? { agente: AGENTS.some((a) => l.includes(a)), acao: ACTION.test(t), meio: MEANS.some((m) => l.includes(m)), finalidade: FINALITY.some((f) => l.includes(f)), detalhamento: DETAIL.some((d) => l.includes(d)) } : undefined,
  };
}
export function compareParagraph(before: string, after: string, role: ParagraphRole) {
  const a = paraFeatures(before, role), b = paraFeatures(after, role);
  const improved: string[] = []; const remaining: string[] = []; const regressed: string[] = [];
  const fixed = a.errors.filter((e) => !b.errors.includes(e)); const newErr = b.errors.filter((e) => !a.errors.includes(e));
  if (fixed.length) improved.push(`Desvios corrigidos: ${fixed.map((e) => e.split(' — ')[0]).join(', ')} (C1).`);
  if (newErr.length) regressed.push(`Novos desvios: ${newErr.join('; ')}.`);
  if (b.errors.length) remaining.push(`Ainda há ${b.errors.length} desvio(s): ${b.errors.slice(0, 2).join('; ')}.`);
  if (b.connectives.length > a.connectives.length) improved.push(`Mais articuladores (${a.connectives.length} → ${b.connectives.length}) (C4).`);
  if (b.causal > a.causal) improved.push('Mais relações de causa e consequência (C3).');
  if (role === 'desenvolvimento') {
    if (!a.topic && b.topic) improved.push('Agora há tópico frasal marcado (C3).'); else if (!b.topic) remaining.push('Falta um tópico frasal que anuncie o argumento (C3).');
    if (!a.repertoire && b.repertoire) improved.push('Repertório incluído (C2).'); else if (!b.repertoire) remaining.push('Ainda sem repertório sociocultural (C2).');
    if (b.causal < 2) remaining.push('Aprofunde: explique a causa e a consequência do problema (C3).');
  }
  if (role === 'conclusao' && a.iv && b.iv) {
    (Object.keys(b.iv) as (keyof typeof b.iv)[]).forEach((k) => { if (!a.iv![k] && b.iv![k]) improved.push(`Proposta: agora há ${k} (C5).`); if (!b.iv![k]) remaining.push(`Proposta: ainda falta ${k} (C5).`); });
  }
  if (b.longSentences > a.longSentences) regressed.push('Período longo demais surgiu na nova versão (C1).');
  if (b.words < a.words * 0.6) remaining.push('A nova versão ficou bem mais curta: confira se o argumento não perdeu desenvolvimento.');
  return { improved, remaining, regressed, before: a, after: b, note: 'Comparação por regras verificáveis; a autoria e o estilo são seus — a NEXO não reescreve o texto por você.' };
}
