import type { Attempt, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { LESSONS } from '../data/lessons';
import { ERROR_LABELS, SKILLS, skillById } from '../data/skills';
import { startSocratic, answerSocratic, type SocraticState } from './socratic';
import { readJustification } from './concepts';

/**
 * Nexo Tutor — MOTOR DEMONSTRATIVO baseado em regras e em uma base de conhecimento curada.
 * Não é um modelo de linguagem. Em produção, a mesma interface (TutorService) chamaria um LLM no servidor,
 * com o comportamento pedagógico definido aqui como "política" do tutor.
 */
export type TutorMode = 'aprender' | 'socratico' | 'corrigir' | 'desafio' | 'revisao' | 'olimpiada';
export const MODES: { id: TutorMode; label: string; desc: string }[] = [
  { id: 'aprender', label: 'Aprender', desc: 'Explica o assunto desde os fundamentos.' },
  { id: 'socratico', label: 'Socrático', desc: 'Perguntas orientadoras em vez da resposta pronta.' },
  { id: 'corrigir', label: 'Corrigir meus erros', desc: 'Analisa sua tentativa e localiza a falha.' },
  { id: 'desafio', label: 'Desafio', desc: 'Questões progressivamente mais difíceis.' },
  { id: 'revisao', label: 'Revisão final', desc: 'Foco nos conteúdos prioritários.' },
  { id: 'olimpiada', label: 'Olimpíada', desc: 'Problemas abertos com mais profundidade.' },
];

interface KB { keywords: string[]; socratic: string[]; styles: { analogia: string; matematica: string; cotidiano: string; avancada: string }; keyConcepts: { term: RegExp; label: string }[] }
export const KNOWLEDGE: Record<string, KB> = {
  'fis-potencia': {
    keywords: ['potência', 'potencia', 'chuveiro', 'resistência', 'resistencia', 'watts', 'tensão', 'tensao', 'voltagem', 'eletric'],
    socratic: ['Quando um mesmo aparelho é ligado em outra tomada, o que dele permanece igual: a tensão, a corrente, a potência ou a resistência?', 'Ótimo. Das fórmulas P = U·I, P = R·I² e P = U²/R, qual relaciona potência e tensão mantendo R fixa?', 'Então, se a tensão for dividida por 2, o que acontece com U²? E com a potência?'],
    styles: {
      analogia: 'Pense na resistência como o "diâmetro" de um cano que não muda. Se você reduz a pressão da água pela metade (tensão), passa menos água (corrente) E com menos força — o efeito total cai bem mais que pela metade: cai para 1/4.',
      matematica: 'De P = U·I e U = R·I, temos I = U/R. Substituindo: P = U·(U/R) = U²/R. Com R constante, P ∝ U². Se U → U/2, então P → (U/2)²/R = P/4.',
      cotidiano: 'É por isso que um chuveiro de 220 V ligado em 110 V esquenta muito pouco: ele passa a dissipar só um quarto da potência.',
      avancada: 'A potência dissipada num resistor ôhmico é P = U²/R = RI². A escolha da forma depende do vínculo do problema: fonte de tensão ideal (U fixo, paralelo) ou de corrente (I fixo, série). Para resistores não ôhmicos (filamentos), R varia com a temperatura, e a aproximação deixa de valer.',
    },
    keyConcepts: [{ term: /resist[eê]ncia.{0,20}(constante|fixa|n[aã]o muda)|R constante/i, label: 'reconhecer a resistência constante' }, { term: /U²|U\^2|quadrado/i, label: 'usar P = U²/R (dependência quadrática)' }, { term: /1\/4|um quarto|quatro vezes|÷ ?4|dividid[ao] por 4/i, label: 'concluir o fator 4' }],
  },
  'qui-equilibrio': {
    keywords: ['equilíbrio', 'equilibrio', 'le chatelier', 'deslocamento', 'amônia', 'amonia', 'catalisador'],
    socratic: ['Qual é a "perturbação" aplicada ao sistema: concentração, pressão ou temperatura?', 'Se for pressão: quantos mols de gás há em cada lado da equação?', 'O sistema reage contra a perturbação. Para "aliviar" um aumento de pressão, ele favorece o lado com mais ou com menos mols gasosos?'],
    styles: {
      analogia: 'Imagine um ônibus lotado (alta pressão): as pessoas se reorganizam para ocupar menos espaço. O equilíbrio faz o mesmo: favorece o lado com menos moléculas de gás.',
      matematica: 'Para N₂ + 3H₂ ⇌ 2NH₃, Δn(gás) = 2 − 4 = −2. Aumentar P desloca no sentido de Δn < 0. Já a temperatura altera K: para ΔH < 0, K diminui com o aumento de T.',
      cotidiano: 'Ao abrir um refrigerante, a pressão cai e o CO₂ sai da solução — o equilíbrio CO₂(dissolvido) ⇌ CO₂(gás) se desloca.',
      avancada: 'Pela equação de van \'t Hoff, d(lnK)/dT = ΔH°/RT². Pressão e concentração alteram Q, não K; o sistema evolui até Q = K. Catalisadores reduzem Ea de ambos os sentidos, sem alterar K.',
    },
    keyConcepts: [{ term: /mols?.{0,15}g[aá]s|mols gasosos|4.{0,5}2/i, label: 'contar os mols gasosos' }, { term: /catalisador.{0,30}(n[aã]o desloca|velocidade|acelera)/i, label: 'saber que catalisador não desloca' }, { term: /exot[eé]rmic|endot[eé]rmic|ΔH/i, label: 'relacionar temperatura ao ΔH' }],
  },
  'bio-hormonios': {
    keywords: ['hormônio', 'hormonio', 'insulina', 'glucagon', 'glicemia', 'pâncreas', 'pancreas', 'diabetes'],
    socratic: ['A situação descrita eleva ou reduz a glicose no sangue?', 'O corpo precisa, então, guardar ou liberar glicose?', 'Qual hormônio pancreático "guarda" glicose e qual "libera"?'],
    styles: {
      analogia: 'Insulina é a "chave" que abre a porta das células para a glicose entrar e manda o fígado guardar o excesso. Glucagon é o "pedido de saque" do estoque de glicogênio.',
      matematica: 'Retroalimentação negativa: se G > G_ref → insulina ↑ → G ↓; se G < G_ref → glucagon ↑ → G ↑. O sistema oscila em torno do valor de referência.',
      cotidiano: 'Depois do almoço, a insulina sobe. Durante uma corrida longa sem comer, o glucagon mantém sua glicemia.',
      avancada: 'A insulina age via receptor tirosina-quinase, promovendo translocação de GLUT4 em músculo e tecido adiposo; o glucagon ativa a via AMPc/PKA nos hepatócitos, estimulando glicogenólise e gliconeogênese.',
    },
    keyConcepts: [{ term: /insulina.{0,40}(reduz|diminui|baixa|guarda|armazena)/i, label: 'função da insulina' }, { term: /glucagon.{0,40}(eleva|aumenta|libera|quebra)/i, label: 'função do glucagon' }],
  },
  'mat-porcentagem': {
    keywords: ['porcentagem', 'porcento', '%', 'desconto', 'aumento', 'reajuste'],
    socratic: ['Os dois percentuais são calculados sobre a mesma base?', 'Como representar um aumento de 10% como multiplicação?', 'E se você multiplicar os dois fatores, o resultado é maior ou menor que 1?'],
    styles: {
      analogia: 'É como subir 10 degraus de uma escada rolante que aumentou de tamanho e depois descer 10% da escada nova: você não volta exatamente ao mesmo ponto.',
      matematica: '(1 + p)(1 − p) = 1 − p². Para p = 0,1: 0,99. O valor final é 1% menor.',
      cotidiano: 'Lojas que aumentam o preço e depois anunciam "desconto do mesmo percentual" não devolvem o preço original.',
      avancada: 'Variações sucessivas formam um produto de fatores; a taxa equivalente é ∏(1 + pᵢ) − 1. Em taxas contínuas, isso vira soma de logaritmos.',
    },
    keyConcepts: [{ term: /fator|1,1|0,9|multiplic/i, label: 'usar fatores multiplicativos' }, { term: /base|sobre o novo/i, label: 'perceber a mudança de base' }],
  },
  'lin-interpretacao': {
    keywords: ['interpretação', 'interpretacao', 'texto', 'c-p-e', 'cpe', 'alternativa', 'autor', 'tese'],
    socratic: ['C — o que exatamente o comando pede? A opinião do autor, o tema ou a estratégia?', 'P — qual trecho do texto comprova sua escolha? Copie-o.', 'E — nas duas alternativas que sobraram, há alguma palavra que vai além do texto (extrapolação) ou generaliza?'],
    styles: {
      analogia: 'Pense como um juiz: a alternativa correta precisa de uma prova no texto. "Parece verdade" não basta; o que vale é o que está nos autos.',
      matematica: 'Como num conjunto: a alternativa correta deve estar contida no que o texto afirma. Extrapolação é sair do conjunto; generalização é ampliá-lo indevidamente.',
      cotidiano: 'Quando alguém conta "o que fulano disse", é comum exagerar. Nas alternativas erradas, o exagero aparece em palavras como "sempre", "superior", "incapazes".',
      avancada: 'Distinga inferência autorizada (decorre necessariamente do texto) de pressuposição do leitor. Conectores conclusivos e adversativos sinalizam a hierarquia argumentativa e, portanto, a tese.',
    },
    keyConcepts: [{ term: /comando|pede/i, label: 'identificar o comando' }, { term: /trecho|prova|"|portanto|no entanto/i, label: 'citar a prova textual' }, { term: /extrapol|generaliz|invers|contradi/i, label: 'nomear o erro das outras' }],
  },
  'fis-cinematica': {
    keywords: ['velocidade', 'km/h', 'm/s', 'cinemática', 'cinematica', 'movimento'],
    socratic: ['Qual é o tempo total, incluindo paradas?', 'Como escrever os minutos em fração de hora?', 'Para converter km/h em m/s, você multiplica ou divide por 3,6?'],
    styles: { analogia: 'Converter unidades é como trocar moedas: o valor real é o mesmo, só o número muda.', matematica: '1 km/h = 1000 m/3600 s = 1/3,6 m/s.', cotidiano: 'Placas de 108 km/h equivalem a 30 m/s: 30 metros a cada segundo.', avancada: 'Velocidade média é Δs/Δt; difere da média aritmética das velocidades quando os intervalos de tempo são diferentes.' },
    keyConcepts: [{ term: /3,6/i, label: 'fator 3,6' }, { term: /0,5|tempo total/i, label: 'tempo total em horas' }],
  },
  'fis-energia': {
    keywords: ['energia', 'cinética', 'cinetica', 'potencial', 'queda', 'rampa', 'atrito'],
    socratic: ['Há atrito ou resistência do ar?', 'Que formas de energia existem no início e no fim?', 'Igualando-as, a massa aparece em ambos os lados?'],
    styles: { analogia: 'Energia é como dinheiro numa conta sem taxas: muda de "aplicação" (potencial → cinética), mas o total é o mesmo.', matematica: 'mgh = mv²/2 → v = √(2gh).', cotidiano: 'Numa montanha-russa, a descida converte altura em velocidade.', avancada: 'Para forças conservativas, W = −ΔU; com dissipação, ΔEmec = W_nc.' },
    keyConcepts: [{ term: /conserva/i, label: 'conservação da energia' }, { term: /massa.{0,20}(cancela|corta|n[aã]o importa)/i, label: 'cancelamento da massa' }],
  },
};

export function detectSkill(text: string): string | undefined {
  const t = text.toLowerCase();
  return Object.entries(KNOWLEDGE).find(([, kb]) => kb.keywords.some((k) => t.includes(k)))?.[0]
    ?? SKILLS.find((s) => t.includes(s.name.toLowerCase().split(' ')[0]))?.id;
}

export interface TutorState { mode: TutorMode; skill?: string; step: number; directRequests: number; challenge?: { qid: string; level: number }; context?: { q: Question; attempt?: Attempt }; soc?: SocraticState }
export interface TutorReply { text: string; actions?: { label: string; send?: string; to?: string }[]; diagnosis?: string; uncertain?: boolean }

const DIRECT = /(explica|explique|me (d[aá]|diga) a resposta|direto|desisto|n[aã]o sei|resposta)/i;
const STYLE: [RegExp, keyof KB['styles'], string][] = [[/analogia/i, 'analogia', 'Por analogia'], [/demonstra|matem[aá]tic|f[oó]rmula|dedu/i, 'matematica', 'Demonstração'], [/cotidian|dia a dia|exemplo/i, 'cotidiano', 'Exemplo do cotidiano'], [/avan[cç]ad|aprofund|mais dif[ií]cil/i, 'avancada', 'Linguagem avançada']];

export function greet(mode: TutorMode, ctx?: TutorState['context']): TutorReply {
  if (ctx?.attempt && !ctx.attempt.correct) {
    const alt = ctx.q.alternatives?.find((a) => a.letter === ctx.attempt!.chosen);
    return { text: `Vamos olhar juntos para a questão **${ctx.q.id}** (${ctx.q.topic}). ${alt?.tutorPrompt ?? 'Me conte como você pensou.'}`, diagnosis: ctx.attempt.errorType ? ERROR_LABELS[ctx.attempt.errorType].label : undefined, actions: [{ label: 'Dica conceitual', send: 'dica 1' }, { label: 'Indique o caminho', send: 'dica 2' }, { label: 'Quero a resolução', send: 'explique direto' }] };
  }
  const g: Record<TutorMode, string> = {
    aprender: 'Sobre qual assunto você quer aprender? Ex.: "potência elétrica", "equilíbrio químico", "insulina", "porcentagem", "interpretação de texto".',
    socratico: 'Vou te guiar com perguntas, sem entregar a resposta de cara. Se quiser a explicação direta a qualquer momento, é só pedir. Qual assunto?',
    corrigir: 'Cole aqui sua resolução (ou explique como pensou) e diga o assunto. Vou procurar a etapa em que o raciocínio desviou.',
    desafio: 'Modo desafio: vou propor questões que ficam mais difíceis conforme você acerta. Responda com a letra. Digite "começar".',
    revisao: 'Modo revisão final: vou listar seus conteúdos prioritários com um resumo de cada. Digite "revisar".',
    olimpiada: 'Modo olimpíada: problemas abertos, com justificativa. Digite "problema" para receber o primeiro.',
  };
  return { text: g[mode], actions: mode === 'desafio' ? [{ label: 'Começar', send: 'começar' }] : mode === 'revisao' ? [{ label: 'Revisar', send: 'revisar' }] : mode === 'olimpiada' ? [{ label: 'Problema', send: 'problema' }] : [{ label: 'Potência elétrica', send: 'potência elétrica' }, { label: 'Equilíbrio químico', send: 'equilíbrio químico' }, { label: 'Interpretação (C-P-E)', send: 'interpretação de texto' }] };
}

function explainSkill(skill: string): string {
  const l = LESSONS.find((x) => x.skillIds.includes(skill));
  const kb = KNOWLEDGE[skill];
  if (!l) return kb ? kb.styles.matematica : '';
  return `**${l.title}**\n\n${l.micro}\n\n${l.explanation.slice(0, 2).join('\n\n')}${l.formulas.length ? `\n\nFórmulas: ${l.formulas.map((f) => f.expr).join(' · ')}` : ''}\n\n**Erro frequente:** ${l.mistakes[0]}`;
}

export function respond(state: TutorState, msg: string, ctx: { attempts: Attempt[]; weakSkills: string[] }): { reply: TutorReply; state: TutorState } {
  const s = { ...state };
  const m = msg.trim();
  const detected = detectSkill(m);
  if (detected && detected !== s.skill) { s.skill = detected; s.step = 0; }
  const q = s.context?.q;

  // Pedido de estilo alternativo de explicação
  for (const [re, key, label] of STYLE) if (re.test(m) && m.split(/\s+/).length <= 5 && (s.skill || q)) {
    const kb = KNOWLEDGE[s.skill ?? q!.skillId];
    if (kb) return { reply: { text: `**${label}:** ${kb.styles[key]}`, actions: [{ label: 'Outra forma', send: key === 'analogia' ? 'demonstração matemática' : 'analogia' }, { label: 'Exemplo do cotidiano', send: 'exemplo do cotidiano' }] }, state: s };
  }

  // Dicas em 3 níveis sobre a questão em contexto
  const hint = m.match(/dica\s*(\d)/i);
  if (hint && q) { const n = Math.min(3, Math.max(1, +hint[1])); return { reply: { text: `**${['Dica conceitual', 'Indicação do caminho', 'Resolução detalhada'][n - 1]}:** ${q.hints[n - 1]}${n === 3 ? `\n\n${q.explanation}` : '\n\nTente de novo e me diga sua nova resposta.'}`, actions: n < 3 ? [{ label: `Dica ${n + 1}`, send: `dica ${n + 1}` }] : [{ label: 'Questão semelhante', to: `/questoes/${q.id}?gemea=1` }] }, state: s }; }

  // Resposta a uma questão em contexto (letra)
  const letter = m.match(/^\s*(?:letra\s*)?([A-Ea-e])\s*[).]?\s*$/);
  if (letter && q?.alternatives && s.mode !== 'desafio') {
    const alt = q.alternatives.find((a) => a.letter === letter[1].toUpperCase())!;
    if (alt.correct) return { reply: { text: `Isso! **${alt.letter}** está correta. ${alt.analysis}\n\nPara confirmar que você aprendeu (e não apenas lembrou), resolva uma questão gêmea.`, actions: [{ label: 'Fazer questão gêmea', to: `/questoes/${q.id}?gemea=1` }] }, state: s };
    return { reply: { text: alt.tutorPrompt ?? alt.analysis, diagnosis: alt.errorType ? ERROR_LABELS[alt.errorType].label : undefined, actions: [{ label: 'Dica', send: 'dica 1' }, { label: 'Explique direto', send: 'explique direto' }] }, state: s };
  }

  // Pedido de explicação direta (evita socrático infinito)
  if (DIRECT.test(m) && (s.skill || q) && !(s.mode === 'socratico' && s.soc && !s.soc.done)) {
    s.directRequests++;
    if (q) return { reply: { text: `Claro, vamos direto.\n\n**Resolução:** ${q.explanation}\n\n**Método rápido:** ${q.fastMethod}`, actions: [{ label: 'Por analogia', send: 'analogia' }, { label: 'Questão semelhante', to: `/questoes/${q.id}?gemea=1` }] }, state: s };
    return { reply: { text: explainSkill(s.skill!), actions: [{ label: 'Por analogia', send: 'analogia' }, { label: 'Demonstração', send: 'demonstração matemática' }] }, state: s };
  }

  switch (s.mode) {
    case 'aprender': {
      if (!s.skill) break;
      const l = LESSONS.find((x) => x.skillIds.includes(s.skill!));
      return { reply: { text: explainSkill(s.skill) + (l?.checks[0] ? `\n\n**Pergunta rápida:** ${l.checks[0].q} (${l.checks[0].options.join(' / ')})` : ''), actions: [{ label: 'Por analogia', send: 'analogia' }, { label: 'Exemplo do cotidiano', send: 'exemplo do cotidiano' }, ...(l ? [{ label: 'Abrir microaula', to: `/aulas/${l.id}` }] : [])] }, state: s };
    }
    case 'socratico': {
      if (!s.skill) break;
      // Tutor socrático ADAPTATIVO: interpreta a resposta aberta, não repete etapas já demonstradas, detecta contradições.
      const qctx = s.context?.q && s.context.q.skillId === s.skill ? s.context.q : undefined;
      if (!s.soc || s.soc.skillId !== s.skill || s.soc.done) {
        const t = startSocratic(s.skill, qctx, readJustification(s.skill, s.context?.attempt?.justification ?? '').shown);
        s.soc = t.state;
        return { reply: { text: t.text, actions: [{ label: 'Explique direto', send: 'explique direto' }] }, state: s };
      }
      const t = answerSocratic(s.soc, m, qctx);
      s.soc = t.state;
      return { reply: { text: t.text, diagnosis: t.contradiction ? 'Contradição no raciocínio' : undefined, actions: t.done ? (qctx ? [{ label: 'Questão inédita (comprovação)', to: `/questoes/${qctx.id}?gemea=1` }] : [{ label: 'Praticar no banco', to: `/questoes?skill=${s.skill}` }]) : [{ label: 'Explique direto', send: 'explique direto' }] }, state: s };
    }
    case 'corrigir': {
      const sk = s.skill ?? q?.skillId;
      if (!sk || !KNOWLEDGE[sk]) break;
      const kb = KNOWLEDGE[sk];
      const found = kb.keyConcepts.filter((c) => c.term.test(m));
      const missing = kb.keyConcepts.filter((c) => !c.term.test(m));
      if (m.split(/\s+/).length < 6) return { reply: { text: 'Descreva um pouco mais sua resolução: quais dados você usou, que fórmula escolheu e por quê?' }, state: s };
      const jr = readJustification(sk, m);
      if (jr.wrong) {
        // Raciocínio explicitamente incorreto: investigar com o tutor socrático a partir do que já está certo.
        s.mode = 'socratico'; const t = startSocratic(sk, q, jr.shown); s.soc = t.state;
        return { reply: { text: `Encontrei um passo que não se sustenta na sua resolução. Em vez de só apontar, vamos investigar juntos.\n\n${t.text}`, diagnosis: 'Raciocínio incorreto identificado', actions: [{ label: 'Explique direto', send: 'explique direto' }] }, state: s };
      }
      const text = `**Análise da sua resolução (${skillById(sk)?.name}):**\n\n${found.length ? `✓ Você demonstrou: ${found.map((f) => f.label).join('; ')}.` : 'Não identifiquei as etapas-chave do raciocínio.'}\n\n${missing.length ? `→ Etapa provavelmente ausente ou equivocada: **${missing[0].label}**. ${kb.socratic[Math.min(kb.socratic.length - 1, kb.keyConcepts.indexOf(missing[0]))]}` : 'Seu raciocínio cobre as etapas principais. Confira apenas os cálculos.'}`;
      return { reply: { text, diagnosis: missing.length ? 'Etapa de raciocínio ausente' : undefined, actions: [{ label: 'Explique direto', send: 'explique direto' }] }, state: s };
    }
    case 'desafio': {
      const pool = QUESTIONS.filter((x) => x.type === 'objetiva').sort((a, b) => ['Fácil', 'Média', 'Difícil'].indexOf(a.difficulty) - ['Fácil', 'Média', 'Difícil'].indexOf(b.difficulty));
      const byLevel = (lv: number) => pool.filter((x) => x.difficulty === ['Fácil', 'Média', 'Difícil'][Math.min(2, lv)]);
      const ask = (lv: number) => { const opts = byLevel(lv).filter((x) => !ctx.attempts.some((a) => a.qid === x.id && a.correct)); const nq = (opts.length ? opts : byLevel(lv))[Math.floor(Math.random() * Math.max(1, (opts.length ? opts : byLevel(lv)).length))]; s.challenge = { qid: nq.id, level: lv }; return `**Nível ${['Fácil', 'Médio', 'Difícil'][Math.min(2, lv)]}** — ${nq.subject}\n\n${nq.context ? nq.context + '\n\n' : ''}${nq.statement}\n\n${nq.alternatives!.map((a) => `${a.letter}) ${a.text}`).join('\n')}`; };
      if (letter && s.challenge) {
        const cq = QUESTIONS.find((x) => x.id === s.challenge!.qid)!; const alt = cq.alternatives!.find((a) => a.letter === letter[1].toUpperCase())!;
        if (alt.correct) { const lv = s.challenge.level + 1; return { reply: { text: `Correto! ${alt.analysis}\n\nSubindo de nível…\n\n${ask(lv)}` }, state: s }; }
        const lv = Math.max(0, s.challenge.level - 1);
        return { reply: { text: `Ainda não. ${alt.tutorPrompt ?? alt.analysis}\n\nResposta: **${cq.alternatives!.find((a) => a.correct)!.letter}**. ${cq.fastMethod}\n\nPróxima, um nível abaixo para consolidar:\n\n${ask(lv)}`, diagnosis: alt.errorType ? ERROR_LABELS[alt.errorType].label : undefined }, state: s };
      }
      return { reply: { text: ask(s.challenge?.level ?? 0) }, state: s };
    }
    case 'revisao': {
      const list = ctx.weakSkills.slice(0, 4);
      if (!list.length) return { reply: { text: 'Não encontrei conteúdos em risco no seu histórico. Sugiro um simulado rápido para gerar novos dados.', actions: [{ label: 'Ir para simulados', to: '/simulados' }] }, state: s };
      return { reply: { text: `**Seus conteúdos prioritários:**\n\n${list.map((id, i) => { const l = LESSONS.find((x) => x.skillIds.includes(id)); return `${i + 1}. **${skillById(id)?.name}** — ${l ? l.visual.map((v) => `${v.label}: ${v.value}`).join('; ') : 'revise a explicação e refaça uma questão.'}`; }).join('\n')}\n\nPriorizados por: domínio em desenvolvimento, erros recentes e flashcards pendentes.`, actions: [{ label: 'Revisar flashcards', to: '/flashcards' }] }, state: s };
    }
    case 'olimpiada': {
      const probs = QUESTIONS.filter((x) => x.exam === 'Olimpíada');
      if (/problema|pr[oó]ximo|come[cç]ar/i.test(m)) { const p = probs[(s.step++) % probs.length]; s.context = { q: p }; return { reply: { text: `**Problema (${p.subject})** — ${p.statement}\n\nPense em uma estratégia antes de calcular. Quando quiser, peça "dica 1".`, actions: [{ label: 'Dica 1', send: 'dica 1' }, { label: 'Resolver no banco', to: `/questoes/${p.id}` }] }, state: s }; }
      const num = m.match(/-?\d+([.,]\d+)?/);
      if (num && s.context?.q.openAnswer) { const v = +num[0].replace(',', '.'); const oa = s.context.q.openAnswer; if (Math.abs(v - oa.value) <= (oa.tolerance ?? 1e-6)) return { reply: { text: `Valor correto! Agora, o que importa em olimpíada: sua justificativa cobre todas as etapas? Compare: ${s.context.q.explanation}`, actions: [{ label: 'Próximo problema', send: 'próximo problema' }] }, state: s }; const w = oa.wrongMap?.find((x) => Math.abs(x.value - v) < 1e-6); return { reply: { text: w ? w.tutorPrompt : 'Esse valor não confere. Revise a estratégia — quer uma dica?', actions: [{ label: 'Dica 1', send: 'dica 1' }] }, state: s }; }
      break;
    }
  }
  if (q) return { reply: { text: 'Me diga sua resposta (letra) ou como pensou. Também posso dar uma dica.', actions: [{ label: 'Dica 1', send: 'dica 1' }] }, state: s };
  return { reply: { uncertain: true, text: 'Não tenho segurança para responder sobre isso com a base demonstrativa atual — e prefiro não inventar. Em produção, a pergunta seria encaminhada a um modelo de linguagem com verificação. Posso ajudar com: potência elétrica, velocidade média, energia, equilíbrio químico, hormônios, porcentagem e interpretação de texto (C-P-E).', actions: [{ label: 'Potência elétrica', send: 'potência elétrica' }, { label: 'Interpretação', send: 'interpretação de texto' }] }, state: s };
}

/** Aprender Ensinando: verifica conceitos fundamentais na explicação do estudante. */
export const TEACH_TOPICS = [
  { skill: 'fis-potencia', prompt: 'Explique por que um chuveiro de 220 V dissipa 1/4 da potência quando ligado em 110 V.' },
  { skill: 'qui-equilibrio', prompt: 'Explique por que aumentar a pressão favorece a formação de amônia na síntese N₂ + 3H₂ ⇌ 2NH₃, e por que o catalisador não muda isso.' },
  { skill: 'bio-hormonios', prompt: 'Explique como insulina e glucagon mantêm a glicemia estável.' },
  { skill: 'mat-porcentagem', prompt: 'Explique por que um aumento de 10% seguido de desconto de 10% não devolve o preço original.' },
  { skill: 'lin-interpretacao', prompt: 'Explique como usar o método C-P-E para escolher entre duas alternativas parecidas.' },
];
export function evaluateTeaching(skill: string, text: string) {
  const kb = KNOWLEDGE[skill];
  const found = kb.keyConcepts.filter((c) => c.term.test(text));
  const missing = kb.keyConcepts.filter((c) => !c.term.test(text));
  const words = text.split(/\s+/).filter(Boolean).length;
  const questions = missing.map((mm) => kb.socratic[Math.min(kb.socratic.length - 1, kb.keyConcepts.indexOf(mm))]);
  if (missing.length === 0) questions.push('E se o enunciado mudasse a condição (por exemplo, outra grandeza constante)? Sua explicação ainda valeria?');
  return { found: found.map((f) => f.label), missing: missing.map((f) => f.label), coverage: found.length / kb.keyConcepts.length, words, questions };
}
