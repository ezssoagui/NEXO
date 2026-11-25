import type { Alternative, Difficulty, ErrorType, GeneratedQuestion, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { skillById } from '../data/skills';

/**
 * Gerador PARAMÉTRICO de questões gêmeas (não é IA): modelos com números variáveis + validação automática que recalcula o gabarito.
 * O que sai daqui nunca é apresentado como revisado por pessoas.
 */
const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];
let seq = 1;

function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

interface Draft { context: string; statement: string; correct: { v: number; text: string }; distractors: { v: number; text: string; errorType: ErrorType; analysis: string; tutorPrompt: string }[]; unit: string; recompute: () => number; hints: [string, string, string]; explanation: string; fastMethod: string; flashcard: { front: string; back: string }; topic: string; subject: Question['subject']; area: Question['area']; lessonId?: string }

const GENERATORS: Record<string, { label: string; keywords: string[]; make: (r: () => number) => Draft }> = {
  'fis-potencia': {
    label: 'Potência elétrica (resistência constante)', keywords: ['potência', 'potencia', 'elétric', 'eletric', 'resistência', 'chuveiro', 'tensão'],
    make: (r) => {
      const ap = pick([['aquecedor de ambiente', [1000, 1500, 2000]], ['ferro de passar', [800, 1200]], ['chuveiro elétrico', [4400, 5400, 6600]], ['forno elétrico', [1600, 2400]]] as [string, number[]][], r);
      const up = r() < 0.5; const U1 = up ? 110 : 220; const U2 = up ? 220 : 110; const P1 = pick(ap[1], r);
      const k = U2 / U1; const ans = P1 * k * k;
      const recompute = () => { const R = (U1 * U1) / P1; return (U2 * U2) / R; };
      return {
        topic: 'Eletrodinâmica', subject: 'Física', area: 'Ciências da Natureza', lessonId: 'l-potencia', unit: 'W',
        context: `Um ${ap[0]} com especificação "${U1} V – ${fmt(P1)} W" foi levado para uma residência cuja rede elétrica fornece ${U2} V e ligado sem adaptações. Admita que sua resistência elétrica permaneça constante.`,
        statement: `A potência dissipada pelo ${ap[0]} nessa residência é de`,
        correct: { v: ans, text: `${fmt(ans)} W.` },
        distractors: [
          { v: P1, text: `${fmt(P1)} W.`, errorType: 'desatencao', analysis: 'Mantém a potência nominal, válida só na tensão nominal.', tutorPrompt: `A potência de ${fmt(P1)} W vale para ${U1} V. A tensão mudou; a potência pode continuar igual?` },
          { v: P1 * k, text: `${fmt(P1 * k)} W.`, errorType: 'grandeza_constante', analysis: 'Trata a potência como proporcional à tensão (corrente constante).', tutorPrompt: 'Você variou a potência na mesma proporção da tensão, como se a corrente fosse constante. Mas o que é constante é a resistência. Qual fórmula usar?' },
          { v: P1 / (k * k), text: `${fmt(P1 / (k * k))} W.`, errorType: 'formula_incorreta', analysis: 'Inverte o sentido da variação.', tutorPrompt: 'Com R fixa, se a tensão aumenta, a potência aumenta ou diminui?' },
          { v: P1 * k * k * k, text: `${fmt(P1 * k * k * k)} W.`, errorType: 'calculo', analysis: 'Usa fator ao cubo; o correto é ao quadrado.', tutorPrompt: 'P ∝ U². Qual é o fator quando U é multiplicada por ' + fmt(k) + '?' },
        ],
        recompute,
        hints: ['O que permanece constante quando o aparelho muda de rede?', 'Use P = U²/R com R constante.', `Fator (${U2}/${U1})² = ${fmt(k * k)} → ${fmt(ans)} W.`],
        explanation: `Com R constante, P = U²/R ⇒ P ∝ U². A tensão foi multiplicada por ${fmt(k)}, logo a potência é multiplicada por ${fmt(k * k)}: ${fmt(P1)} × ${fmt(k * k)} = ${fmt(ans)} W.`,
        fastMethod: 'Razão das tensões ao quadrado.',
        flashcard: { front: 'R constante e tensão multiplicada por k: o que ocorre com P?', back: 'P é multiplicada por k².' },
      };
    },
  },
  'fis-cinematica': {
    label: 'Velocidade média com conversão', keywords: ['velocidade', 'cinemática', 'cinematica', 'm/s', 'km/h', 'movimento'],
    make: (r) => {
      const v = pick([10, 15, 20, 25, 30], r); const t = pick([[1, 30], [2, 30], [0, 45], [1, 15], [2, 0]] as [number, number][], r);
      const th = t[0] + t[1] / 60; const d = +(v * 3.6 * th).toFixed(1);
      const kmh = v * 3.6; const wrongT = t[0] + t[1] / 100;
      const tStr = t[1] ? `${t[0] ? t[0] + ' h ' : ''}${t[1]} min` : `${t[0]} h`;
      const veh = pick(['Um ônibus escolar', 'Uma ciclista', 'Um trem regional', 'Um motorista de aplicativo'], r);
      const ds: Draft['distractors'] = [
        { v: kmh, text: `${fmt(kmh)}.`, errorType: 'unidades', analysis: 'Valor em km/h, sem converter para m/s.', tutorPrompt: 'Seu valor está em km/h ou m/s?' },
        { v: kmh * 3.6, text: `${fmt(kmh * 3.6)}.`, errorType: 'unidades', analysis: 'Multiplicou por 3,6 em vez de dividir.', tutorPrompt: 'De km/h para m/s, multiplica ou divide por 3,6?' },
      ];
      if (t[1]) ds.push({ v: d / wrongT / 3.6, text: `${fmt(d / wrongT / 3.6, 1)}.`, errorType: 'unidades', analysis: `Escreveu ${tStr} como ${fmt(wrongT)} h.`, tutorPrompt: `Como se escreve ${t[1]} min em horas decimais?` });
      if (t[0] && t[1]) ds.push({ v: d / t[0] / 3.6, text: `${fmt(d / t[0] / 3.6, 1)}.`, errorType: 'desatencao', analysis: 'Ignorou os minutos.', tutorPrompt: 'Os minutos entraram no tempo total?' });
      while (ds.length < 4) ds.push({ v: v * 2, text: `${fmt(v * 2)}.`, errorType: 'calculo', analysis: 'Erro de cálculo na divisão.', tutorPrompt: 'Refaça a divisão da distância pelo tempo.' });
      return {
        topic: 'Cinemática', subject: 'Física', area: 'Ciências da Natureza', lessonId: 'l-cinematica', unit: 'm/s',
        context: `${veh} percorreu ${fmt(d, 1)} km em ${tStr}, de acordo com o registro de um aplicativo de navegação.`,
        statement: 'A velocidade média nesse trajeto, em metro por segundo, foi de',
        correct: { v, text: `${fmt(v)}.` }, distractors: ds.slice(0, 4), recompute: () => d / th / 3.6,
        hints: ['vm = distância total / tempo total.', 'Converta o tempo para horas decimais e depois divida por 3,6.', `${fmt(d, 1)} / ${fmt(th)} = ${fmt(kmh)} km/h = ${fmt(v)} m/s.`],
        explanation: `${tStr} = ${fmt(th)} h. vm = ${fmt(d, 1)}/${fmt(th)} = ${fmt(kmh)} km/h ÷ 3,6 = ${fmt(v)} m/s.`,
        fastMethod: 'Converta tudo para metros e segundos antes de dividir.', flashcard: { front: 'km/h → m/s?', back: 'Dividir por 3,6.' },
      };
    },
  },
  'mat-porcentagem': {
    label: 'Porcentagens sucessivas', keywords: ['porcent', '%', 'desconto', 'aumento', 'juros', 'reajuste'],
    make: (r) => {
      const P = pick([80, 120, 150, 200, 250, 400], r); const a = pick([10, 20, 25, 30], r) / 100; const b = pick([10, 20, 25, 40], r) / 100;
      const ans = P * (1 + a) * (1 - b); const item = pick(['uma mochila', 'um par de tênis', 'uma calculadora científica', 'um fone de ouvido'], r);
      return {
        topic: 'Porcentagem', subject: 'Matemática', area: 'Matemática', lessonId: 'l-porcentagem', unit: 'R$',
        context: `O preço de ${item}, inicialmente R$ ${fmt(P)},00, foi reajustado em ${a * 100}%. Algum tempo depois, a loja ofereceu ${b * 100}% de desconto sobre o preço reajustado.`,
        statement: 'O preço final, com desconto, é de',
        correct: { v: ans, text: `R$ ${fmt(ans)}.` },
        distractors: [
          { v: P * (1 + a - b), text: `R$ ${fmt(P * (1 + a - b))}.`, errorType: 'lacuna_conceitual', analysis: 'Somou as porcentagens, ignorando a mudança de base.', tutorPrompt: 'O desconto incide sobre o preço inicial ou sobre o reajustado?' },
          { v: P * (1 - b), text: `R$ ${fmt(P * (1 - b))}.`, errorType: 'desatencao', analysis: 'Ignorou o reajuste.', tutorPrompt: 'Onde entrou o reajuste?' },
          { v: P * (1 + a), text: `R$ ${fmt(P * (1 + a))}.`, errorType: 'desatencao', analysis: 'Ignorou o desconto.', tutorPrompt: 'E o desconto?' },
          { v: P * (1 - a) * (1 + b), text: `R$ ${fmt(P * (1 - a) * (1 + b))}.`, errorType: 'formula_incorreta', analysis: 'Inverteu os sinais das variações.', tutorPrompt: 'Qual fator representa um aumento e qual representa um desconto?' },
        ],
        recompute: () => P * (1 + a) * (1 - b),
        hints: ['Use fatores multiplicativos.', `×${fmt(1 + a)} e depois ×${fmt(1 - b)}.`, `${fmt(P)} × ${fmt(1 + a)} × ${fmt(1 - b)} = ${fmt(ans)}.`],
        explanation: `Reajuste: ${fmt(P)} × ${fmt(1 + a)} = ${fmt(P * (1 + a))}. Desconto sobre o novo preço: × ${fmt(1 - b)} = R$ ${fmt(ans)}.`,
        fastMethod: 'Multiplique os fatores antes: um único fator.', flashcard: { front: 'Variações percentuais sucessivas se somam?', back: 'Não; multiplicam-se os fatores.' },
      };
    },
  },
  'qui-concentracao': {
    label: 'Concentração % m/V', keywords: ['concentra', 'solução', 'soluç', 'soro', 'm/v', 'soluto'],
    make: (r) => {
      const p = pick([0.9, 2, 5, 10], r); const V = pick([200, 250, 500, 1000], r); const ans = (p * V) / 100;
      const sol = pick(['uma solução de glicose', 'um soro', 'uma solução de bicarbonato de sódio'], r);
      return {
        topic: 'Soluções', subject: 'Química', area: 'Ciências da Natureza', lessonId: 'l-solucoes', unit: 'g',
        context: `Um laboratório escolar preparou ${V} mL de ${sol} com concentração de ${fmt(p)}% (m/V).`,
        statement: 'A massa de soluto utilizada no preparo foi de',
        correct: { v: ans, text: `${fmt(ans)} g.` },
        distractors: [
          { v: ans * 10, text: `${fmt(ans * 10)} g.`, errorType: 'calculo', analysis: 'Erro de vírgula (×10).', tutorPrompt: 'Confira a ordem de grandeza.' },
          { v: ans / 10, text: `${fmt(ans / 10)} g.`, errorType: 'calculo', analysis: 'Erro de vírgula (÷10).', tutorPrompt: 'Quantos "100 mL" cabem no volume preparado?' },
          { v: p, text: `${fmt(p)} g.`, errorType: 'interpretacao', analysis: 'Massa correspondente a apenas 100 mL.', tutorPrompt: `${fmt(p)} g correspondem a que volume?` },
          { v: p * V, text: `${fmt(p * V)} g.`, errorType: 'formula_incorreta', analysis: 'Multiplicou porcentagem por volume sem dividir por 100.', tutorPrompt: 'O que significa "% m/V" em gramas por mL?' },
        ],
        recompute: () => (p / 100) * V,
        hints: ['% m/V = gramas em 100 mL.', `Quantas vezes ${V} mL contém 100 mL?`, `${fmt(p)} × ${V / 100} = ${fmt(ans)} g.`],
        explanation: `${fmt(p)}% m/V = ${fmt(p)} g por 100 mL. Em ${V} mL: ${fmt(p)} × ${fmt(V / 100)} = ${fmt(ans)} g.`,
        fastMethod: 'massa = (%/100) × volume (mL).', flashcard: { front: '% m/V em gramas?', back: 'gramas de soluto a cada 100 mL de solução.' },
      };
    },
  },
  'mat-funcoes': {
    label: 'Função afim em tarifas', keywords: ['função', 'funcao', 'afim', 'tarifa', 'táxi', 'linear'],
    make: (r) => {
      const b = pick([4, 5, 6, 8], r); const a = pick([1.5, 2, 2.5, 3], r); const x = pick([6, 8, 10, 12, 14], r); const C = b + a * x;
      return {
        topic: 'Funções', subject: 'Matemática', area: 'Matemática', unit: 'km',
        context: `Um aplicativo de transporte cobra uma tarifa fixa de R$ ${fmt(b)},00 mais R$ ${fmt(a)} por quilômetro rodado.`,
        statement: `Se uma corrida custou R$ ${fmt(C)}, a distância percorrida foi de`,
        correct: { v: x, text: `${fmt(x)} km.` },
        distractors: [
          { v: C / a, text: `${fmt(C / a, 1)} km.`, errorType: 'interpretacao', analysis: 'Ignorou a tarifa fixa.', tutorPrompt: 'Todo o valor corresponde aos quilômetros?' },
          { v: (C + b) / a, text: `${fmt((C + b) / a, 1)} km.`, errorType: 'calculo', analysis: 'Somou a tarifa fixa.', tutorPrompt: 'A tarifa fixa é somada ou subtraída?' },
          { v: x - 2, text: `${fmt(x - 2)} km.`, errorType: 'calculo', analysis: 'Erro na divisão.', tutorPrompt: 'Confira substituindo na função.' },
          { v: x + 3, text: `${fmt(x + 3)} km.`, errorType: 'calculo', analysis: 'Erro na divisão.', tutorPrompt: 'Confira substituindo na função.' },
        ],
        recompute: () => (C - b) / a,
        hints: [`C(x) = ${fmt(b)} + ${fmt(a)}x.`, 'Iguale ao valor pago e isole x.', `(${fmt(C)} − ${fmt(b)})/${fmt(a)} = ${fmt(x)}.`],
        explanation: `${fmt(b)} + ${fmt(a)}x = ${fmt(C)} → x = ${fmt(x)} km.`, fastMethod: 'Retire a parte fixa e divida pela taxa.',
        flashcard: { front: 'Coeficiente angular numa tarifa?', back: 'O valor por unidade (ex.: por km).' },
      };
    },
  },
  'fis-forca-magnetica': { label: 'Força magnética em fio', keywords: [], make: (r) => {
    const B = pick([0.1, 0.2, 0.3, 0.5], r), i = pick([2, 4, 5, 6], r), L = pick([0.4, 0.5, 0.8, 1.5], r); const ans = B * i * L;
    return simple({ skillId: 'fis-forca-magnetica', topic: 'Magnetismo', unit: 'N', ans, context: `Em um alto-falante didático, um trecho de fio de ${fmt(L)} m conduz corrente de ${fmt(i)} A, perpendicular a um campo magnético uniforme de ${fmt(B)} T.`, statement: 'A intensidade da força magnética sobre esse trecho, em newton, é', wrong: [[B * i, 'desatencao', 'Esqueceu o comprimento do fio.'], [B * L, 'desatencao', 'Esqueceu a corrente.'], [(B * i) / L, 'formula_incorreta', 'Dividiu pelo comprimento em vez de multiplicar.'], [i * L, 'desatencao', 'Esqueceu o campo.']], recompute: () => L * (i * B), explanation: `F = B·i·L = ${fmt(B)}·${fmt(i)}·${fmt(L)} = ${fmt(ans, 3)} N.`, fast: 'Multiplique B, i e L.', card: ['Força sobre fio perpendicular ao campo?', 'F = B·i·L'] });
  } },
  'fis-energia-eletrica': { label: 'Consumo de energia', keywords: [], make: (r) => {
    const P = pick([150, 200, 500, 1200], r), h = pick([2, 3, 4, 6], r); const ans = (P / 1000) * h * 30; const ap = pick(['ventilador', 'computador', 'refrigerador de bancada', 'ar-condicionado portátil'], r);
    return simple({ skillId: 'fis-energia-eletrica', topic: 'Eletrodinâmica', unit: 'kWh', ans, context: `Um ${ap} de ${fmt(P)} W permanece ligado ${h} horas por dia em um escritório.`, statement: 'A energia consumida em 30 dias, em kWh, é', wrong: [[P * h * 30, 'unidades', 'Não converteu watt para quilowatt.'], [(P / 1000) * h, 'desatencao', 'É o consumo de um único dia.'], [(P / 1000) * 30, 'desatencao', 'Considerou uma hora por dia.'], [(P / 1000) * h * 365, 'interpretacao', 'Considerou um ano inteiro.']], recompute: () => (P * h * 30) / 1000, explanation: `E = ${fmt(P / 1000)} kW × ${h * 30} h = ${fmt(ans)} kWh.`, fast: 'kW × horas no mês.', card: ['Energia em kWh?', 'P(kW) × t(h)'] });
  } },
  'fis-dinamica': { label: 'Segunda lei de Newton', keywords: [], make: (r) => {
    const m = pick([4, 5, 8, 20], r), a = pick([2, 3, 5], r), at = pick([8, 10, 12], r); const F = m * a + at;
    return simple({ skillId: 'fis-dinamica', topic: 'Dinâmica', unit: 'm/s²', ans: a, context: `Um carrinho de ${m} kg é empurrado por uma força horizontal de ${F} N em um corredor cujo piso exerce atrito de ${at} N.`, statement: 'A aceleração do carrinho, em m/s², é', wrong: [[F / m, 'desatencao', 'Ignorou o atrito.'], [(F + at) / m, 'formula_incorreta', 'Somou o atrito.'], [F - at, 'interpretacao', 'É a força resultante, não a aceleração.'], [at / m, 'interpretacao', 'Usou só o atrito.']], recompute: () => (F - at) / m, explanation: `a = (${F} − ${at})/${m} = ${fmt(a)} m/s².`, fast: 'Resultante ÷ massa.', card: ['2ª lei de Newton?', 'F resultante = m·a'] });
  } },
  'mat-estatistica': { label: 'Média ponderada', keywords: [], make: (r) => {
    const p1 = pick([1, 2], r), p2 = pick([3, 4], r), n1 = pick([4, 5, 6], r), n2 = pick([7, 8, 9], r); const ans = (p1 * n1 + p2 * n2) / (p1 + p2);
    return simple({ skillId: 'mat-estatistica', topic: 'Estatística', unit: 'pontos', ans, context: `Em um processo seletivo, a entrevista tem peso ${p1} e a prova escrita tem peso ${p2}. Um candidato obteve ${n1} na entrevista e ${n2} na prova escrita.`, statement: 'A média ponderada do candidato é', wrong: [[(n1 + n2) / 2, 'lacuna_conceitual', 'Média simples, sem pesos.'], [(p2 * n1 + p1 * n2) / (p1 + p2), 'desatencao', 'Trocou os pesos.'], [p1 * n1 + p2 * n2, 'desatencao', 'Não dividiu pela soma dos pesos.'], [(p1 * n1 + p2 * n2) / 2, 'formula_incorreta', 'Dividiu por 2.']], recompute: () => (n2 * p2 + n1 * p1) / (p2 + p1), explanation: `(${p1}·${n1} + ${p2}·${n2})/(${p1} + ${p2}) = ${fmt(ans)}.`, fast: 'Some valor × peso e divida pela soma dos pesos.', card: ['Média ponderada?', 'Σ(valor × peso)/Σ pesos'] });
  } },
  'mat-proporcao': { label: 'Proporção inversa', keywords: [], make: (r) => {
    const a = pick([4, 6, 8], r), t = pick([6, 9, 12], r), k = pick([2, 3], r); const ans = t / k;
    return simple({ skillId: 'mat-proporcao', topic: 'Proporção', unit: 'h', ans, context: `${a} impressoras idênticas, no mesmo ritmo, concluem um pedido em ${t} horas. A gráfica usará ${a * k} impressoras iguais no próximo pedido, de mesmo tamanho.`, statement: 'O tempo necessário, em horas, será de', wrong: [[t * k, 'formula_incorreta', 'Tratou como proporção direta.'], [t, 'desatencao', 'Manteve o tempo.'], [Math.max(0.5, t - k), 'formula_incorreta', 'Subtraiu em vez de dividir.'], [t / (k * k), 'calculo', 'Dividiu duas vezes.']], recompute: () => (a * t) / (a * k), explanation: `Inversa: ${a}·${t} = ${a * k}·x → x = ${fmt(ans)} h.`, fast: 'Mais máquinas, menos tempo: divida.', card: ['Grandezas inversas: o que é constante?', 'O produto.'] });
  } },
};

/** Modelo compacto: gabarito e distratores numéricos ligados a erros típicos. */
interface Simple { skillId: string; topic: string; unit: string; ans: number; context: string; statement: string; wrong: [number, ErrorType, string][]; recompute: () => number; explanation: string; fast: string; card: [string, string] }
function simple(x: Simple): Draft {
  const sk = skillById(x.skillId)!;
  return { topic: x.topic, subject: sk.subject, area: sk.area, lessonId: sk.lessonId, unit: x.unit, context: x.context, statement: x.statement, correct: { v: x.ans, text: `${fmt(x.ans, 3)}.` }, distractors: x.wrong.map(([v, errorType, analysis]) => ({ v, text: `${fmt(v, 3)}.`, errorType, analysis, tutorPrompt: analysis })), recompute: x.recompute, hints: ['', '', ''], explanation: x.explanation, fastMethod: x.fast, flashcard: { front: x.card[0], back: x.card[1] } };
}

export const hasGenerator = (id: string) => !!GENERATORS[id];
export const GENERATOR_SKILLS = Object.entries(GENERATORS).map(([id, g]) => ({ id, label: g.label }));

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export function generate(skillId: string, opts: { difficulty?: Difficulty; seed?: number; injectFault?: boolean; request?: string } = {}): GeneratedQuestion | null {
  const g = GENERATORS[skillId]; if (!g) return null;
  const r = rng(opts.seed ?? Date.now() + seq * 7919);
  const d = g.make(r);
  const fault = opts.injectFault ? Math.floor(r() * 3) : -1;
  let correct = { ...d.correct };
  if (fault === 0) correct = { v: correct.v * 1.5, text: correct.text.replace(/[\d.,]+/, fmt(correct.v * 1.5)) }; // gabarito errado
  const alts = [{ ...correct, ok: true, errorType: undefined as ErrorType | undefined, analysis: 'Correta. ' + d.explanation, tutorPrompt: undefined as string | undefined }, ...d.distractors.map((x) => ({ ...x, ok: false }))];
  if (fault === 1) alts[2] = { ...alts[2], v: alts[0].v, text: alts[0].text }; // distrator duplicado
  // embaralha
  for (let i = alts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [alts[i], alts[j]] = [alts[j], alts[i]]; }
  const alternatives: Alternative[] = alts.map((a, i) => ({ letter: LETTERS[i], text: a.text, correct: a.ok || undefined, analysis: a.analysis, errorType: a.errorType, tutorPrompt: a.tutorPrompt }));
  const id = `G-${String(seq++).padStart(2, '0')}-${Math.floor(r() * 900 + 100)}`;
  const q: Question = {
    id, exam: 'ENEM', style: 'Estilo ENEM (modelo paramétrico)', subject: d.subject, area: d.area, topic: d.topic, skillId, year: new Date().getFullYear(), difficulty: opts.difficulty ?? 'Média',
    type: 'objetiva', source: 'gerada_ia_demo', context: fault === 2 ? d.context.replace(/ (W|km|mL|g)\b/, '') : d.context, statement: d.statement, alternatives, hints: d.hints, explanation: d.explanation,
    fastMethod: d.fastMethod, flashcard: d.flashcard, lessonId: d.lessonId,
  };
  // ---- Validação ----
  const values = alts.map((a) => +a.v.toFixed(4));
  const corrects = alternatives.filter((a) => a.correct);
  const recomputed = d.recompute();
  const correctAlt = alts.find((a) => a.ok)!;
  const validation = [
    { check: 'Coerência do enunciado', ok: q.context!.length > 60 && q.statement.length > 10, detail: 'Contexto e comando presentes e completos.' },
    { check: 'Unicidade da resposta', ok: corrects.length === 1 && new Set(values).size === values.length, detail: new Set(values).size === values.length ? 'Exatamente uma alternativa correta e valores distintos.' : 'Há alternativas com valores idênticos.' },
    { check: 'Verificação do cálculo', ok: Math.abs(recomputed - correctAlt.v) < 1e-6 * Math.max(1, Math.abs(recomputed)), detail: `Recalculado de forma independente: ${fmt(recomputed)} ${d.unit}.` },
    { check: 'Unidades', ok: fault !== 2, detail: fault === 2 ? 'Unidade ausente no enunciado.' : `Unidade consistente (${d.unit}).` },
    { check: 'Qualidade dos distratores', ok: alts.filter((a) => !a.ok).every((a) => a.v > 0 && a.analysis && a.errorType), detail: 'Cada distrator corresponde a um erro típico diagnosticável.' },
    { check: 'Correspondência ao exame', ok: !!q.context, detail: 'Questão contextualizada, 5 alternativas, estilo ENEM.' },
  ];
  const fails = validation.filter((v) => !v.ok).length;
  return { q, validation, status: fails === 0 ? 'aprovada' : fails === 1 ? 'revisao' : 'rejeitada', request: opts.request ?? g.label, ts: Date.now() };
}

export const generatorLabel = (id: string) => GENERATORS[id]?.label ?? skillById(id)?.name ?? id;
