import { LESSONS } from '../data/lessons';
import type { Question } from '../types';

/**
 * Base de conceitos por habilidade, usada pelo tutor socrático adaptativo e pela leitura de justificativas.
 * Cada checkpoint é uma etapa do raciocínio: uma pergunta orientadora, padrões de resposta correta,
 * concepções equivocadas conhecidas (com a contrapergunta adequada) e uma explicação curta.
 * Conteúdo curado manualmente — o motor não inventa fórmulas nem explicações fora desta base.
 */
export interface Misconception { re: RegExp; reply: string }
export interface Checkpoint {
  id: string;
  question: string;
  correct: RegExp[];
  misconceptions: Misconception[];
  explain: string;          // explicação curta quando o aluno não chega sozinho
  simpler?: string;         // pergunta mais simples (rebaixa o nível)
  ack: string;              // reconhecimento quando acerta
}
export interface ConceptMap { skillId: string; checkpoints: Checkpoint[]; summary: { basico: string; intermediario: string; avancado: string }; curated: boolean }

const any = (...xs: RegExp[]) => xs;

export const CONCEPTS: Record<string, ConceptMap> = {
  'fis-potencia': {
    skillId: 'fis-potencia', curated: true,
    checkpoints: [
      { id: 'r_const', question: 'Quando o mesmo aparelho é ligado em outra tensão, qual grandeza dele permanece constante?', ack: 'Isso: a resistência é característica do aparelho.',
        correct: any(/resist[eê]ncia/i, /^\s*r\s*$/i),
        misconceptions: [{ re: /^\s*(a\s+)?corrente\s*\.?$|corrente\s+(n[aã]o muda|[eé] constante|continua|permanece|fica)/i, reply: 'A corrente depende da tensão aplicada — ela muda quando a tomada muda. O que é característica fixa do próprio aparelho?' }, { re: /^\s*(a\s+)?pot[eê]ncia\s*\.?$|pot[eê]ncia\s+(n[aã]o muda|[eé] constante|continua|permanece)/i, reply: 'A potência indicada vale só na tensão nominal. Pense no que está "dentro" do aparelho e não muda: o fio aquecedor tem uma…?' }, { re: /^\s*(a\s+)?(tens[aã]o|voltagem)\s*\.?$|tens[aã]o\s+(n[aã]o muda|[eé] constante|continua|permanece)/i, reply: 'A tensão é justamente o que mudou (outra tomada). O que NÃO muda?' }],
        explain: 'A resistência é uma propriedade do aparelho (do fio aquecedor ou filamento). Ao trocar de tomada, mudam tensão, corrente e potência — a resistência, aproximadamente, não.', simpler: 'Pense no fio dentro do chuveiro: ele muda ao trocar de tomada?' },
      { id: 'ohm', question: 'Se a resistência permanece constante e a tensão dobra, o que acontece com a corrente segundo a Lei de Ohm (U = R·I)?', ack: 'Exato: com R fixa, a corrente varia na mesma proporção da tensão.',
        correct: any(/dobra|duplica|duas vezes|2\s*x|x\s*2|o dobro|proporcional|mesma propor/i),
        misconceptions: [{ re: /(continua|permanece|fica)\s+(a\s+)?(mesma|igual|constante)|corrente\s+n[aã]o\s+(muda|altera|varia)|corrente\s+[eé]\s+constante/i, reply: 'Veja U = R·I. Se U dobra e R não muda, I pode continuar igual? O que precisaria acontecer com I para a igualdade continuar valendo?' }, { re: /cai|diminui|metade/i, reply: 'Se U aumenta e R é a mesma, I = U/R aumenta ou diminui?' }],
        explain: 'Pela Lei de Ohm, I = U/R. Com R constante, se U dobra, I também dobra; se U cai pela metade, I também cai pela metade.', simpler: 'Em I = U/R, se o numerador dobra e o denominador fica igual, o resultado…?' },
      { id: 'quadratico', question: 'Então, em P = U·I, se a tensão dobra e a corrente também dobra, o que acontece com a potência?', ack: 'Perfeito: 2 × 2 = 4. É por isso que, com R constante, P = U²/R.',
        correct: any(/quadruplica|4\s*(x|vezes)|quatro vezes|x\s*4|×\s*4|qu[aá]druplo|u²|u\^2|ao quadrado/i),
        misconceptions: [{ re: /dobra|duas vezes|2\s*x|o dobro|duplica/i, reply: 'Cuidado: U dobra E I também dobra. Em P = U·I, quanto é 2 × 2?' }, { re: /pot[eê]ncia\s+(continua|fica|permanece)\s+(a\s+)?(mesma|igual)|^\s*(a\s+)?mesma\s*\.?$/i, reply: 'Se os dois fatores de P = U·I aumentam, o produto pode ficar igual?' }],
        explain: 'P = U·I com U e I multiplicados por 2 dá P multiplicada por 4. Substituindo I = U/R: P = U²/R — a potência varia com o quadrado da tensão.', simpler: 'Quanto é 2 × 2?' },
    ],
    summary: {
      basico: 'Pense no fio do chuveiro como um cano de largura fixa: com metade da "pressão" (tensão), passa metade da água (corrente) e com menos força — o efeito total cai para 1/4.',
      intermediario: 'R constante → I ∝ U → P = U·I ∝ U². Tensão ×k ⇒ potência ×k².',
      avancado: 'Para um resistor ôhmico, P = U²/R = RI². A forma útil depende do vínculo: R fixa (troca de tomada) ou fonte de corrente (série). Em filamentos, R varia com a temperatura e a aproximação se degrada.',
    },
  },
  'qui-equilibrio': {
    skillId: 'qui-equilibrio', curated: true,
    checkpoints: [
      { id: 'perturbacao', question: 'Que tipo de perturbação está sendo aplicada ao sistema: concentração, pressão, temperatura ou catalisador?', ack: 'Certo, identificar a perturbação é o primeiro passo.',
        correct: any(/press|temperat|calor|concentra|retir|adicion|catalis/i), misconceptions: [],
        explain: 'Antes de aplicar Le Chatelier, nomeie a perturbação: mudança de concentração, de pressão, de temperatura — ou adição de catalisador (que não desloca).' },
      { id: 'mols', question: 'Se a perturbação envolve pressão: compare a quantidade de mols de gás em cada lado da equação. Qual lado tem menos?', ack: 'Isso: a contagem de mols gasosos decide o efeito da pressão.',
        correct: any(/produto|direita|nh3|nh₃|menos.*produto|2\s*(mol)?.*(produto|direita)|4.*2|quatro.*dois/i),
        misconceptions: [{ re: /iguais|mesma quantidade/i, reply: 'Conte de novo: N₂ + 3 H₂ são quantos mols? E 2 NH₃?' }, { re: /reagente|esquerda/i, reply: 'Os reagentes somam 1 + 3. Os produtos, 2. Qual é menor?' }],
        explain: 'Na síntese da amônia, reagentes: 1 + 3 = 4 mol de gás; produtos: 2 mol. O lado dos produtos tem menos mols gasosos.' },
      { id: 'catalisador', question: 'E o catalisador: ele desloca o equilíbrio ou só altera a velocidade com que se chega a ele?', ack: 'Exato: o catalisador acelera as duas reações igualmente.',
        correct: any(/velocidade|acelera|r[aá]pido|n[aã]o desloca|s[oó] acelera|apenas/i),
        misconceptions: [{ re: /desloca|aumenta o rendimento|mais produto/i, reply: 'O catalisador reduz a energia de ativação da reação direta E da inversa. Se as duas aceleram igualmente, a posição final muda?' }],
        explain: 'O catalisador diminui a energia de ativação das reações direta e inversa na mesma medida: o equilíbrio é atingido mais rápido, mas na mesma posição.' },
    ],
    summary: { basico: 'Como um ônibus lotado: com mais pressão, o sistema "se aperta" para o lado com menos moléculas de gás.', intermediario: 'Pressão ↑ → lado com menos mols gasosos; T ↑ → sentido endotérmico; catalisador não desloca.', avancado: 'Pressão e concentração alteram Q (não K); o sistema evolui até Q = K. Só a temperatura muda K (van \'t Hoff).' },
  },
  'bio-hormonios': {
    skillId: 'bio-hormonios', curated: true,
    checkpoints: [
      { id: 'efeito', question: 'O efeito descrito na questão faz a glicose no sangue subir ou descer?', ack: 'Certo — começar pelo efeito fisiológico evita confundir os hormônios.',
        correct: any(/sobe|aumenta|eleva|desce|cai|diminui|reduz|baixa/i), misconceptions: [],
        explain: 'Leia o efeito: "captação de glicose e armazenamento" reduz a glicemia; "quebra de glicogênio" eleva a glicemia.' },
      { id: 'insulina', question: 'Qual hormônio pancreático reduz a glicemia, guardando glicose?', ack: 'Isso: insulina, das células beta.',
        correct: any(/insulina/i), misconceptions: [{ re: /glucagon/i, reply: 'O glucagon também é pancreático, mas ele libera ou guarda glicose?' }, { re: /adrenalina/i, reply: 'A adrenalina vem das adrenais e eleva a glicemia. Qual hormônio do pâncreas faz o contrário?' }],
        explain: 'A insulina (células beta) aumenta a captação de glicose e a síntese de glicogênio: a glicemia cai.' },
      { id: 'glucagon', question: 'E qual eleva a glicemia em jejum, quebrando o glicogênio do fígado?', ack: 'Exato: glucagon, das células alfa. Os dois formam um par antagônico.',
        correct: any(/glucagon/i), misconceptions: [{ re: /insulina/i, reply: 'A insulina guarda glicose. Em jejum o corpo precisa liberar. Qual é o outro hormônio pancreático?' }],
        explain: 'O glucagon (células alfa) estimula a glicogenólise hepática, liberando glicose no sangue.' },
    ],
    summary: { basico: 'Insulina é a "chave" que guarda glicose; glucagon é o "saque" do estoque.', intermediario: 'Glicemia ↑ → insulina (guarda); glicemia ↓ → glucagon (libera). Retroalimentação negativa.', avancado: 'Insulina age via receptor tirosina-quinase (translocação de GLUT4); glucagon via AMPc/PKA nos hepatócitos (glicogenólise e gliconeogênese).' },
  },
  'mat-porcentagem': {
    skillId: 'mat-porcentagem', curated: true,
    checkpoints: [
      { id: 'fator_aumento', question: 'Como escrever um aumento de 10% como uma multiplicação?', ack: 'Isso: ×1,10.', correct: any(/1[,.]1\b|1[,.]10|110\s*%/i),
        misconceptions: [{ re: /0[,.]1\b|\+\s*10|somar|soma/i, reply: 'Somar 10 só funciona se a base for 100. Que número, multiplicado pelo valor, já inclui o valor original mais 10%?' }],
        explain: 'Aumento de p% = multiplicar por (1 + p/100). Para 10%: ×1,10.' },
      { id: 'base', question: 'Os dois percentuais (aumento e desconto) incidem sobre a mesma base?', ack: 'Exato: o desconto incide sobre o valor já aumentado.',
        correct: any(/n[aã]o|diferente|novo (pre[cç]o|valor)|valor aumentado|reajustado/i),
        misconceptions: [{ re: /\bsim\b|mesma base|mesmo valor/i, reply: 'O desconto é calculado sobre o preço original ou sobre o preço depois do aumento?' }],
        explain: 'Em variações sucessivas, cada porcentagem incide sobre o valor anterior — as bases são diferentes, por isso não se somam.' },
      { id: 'produto', question: 'Então: 1,1 × 0,9 é maior, menor ou igual a 1?', ack: 'Perfeito: 0,99 — o valor final fica 1% menor.',
        correct: any(/menor|0[,.]99/i), misconceptions: [{ re: /igual|\b1\b|maior/i, reply: 'Faça a conta: 1,1 × 0,9 = ?' }],
        explain: '1,1 × 0,9 = 0,99 < 1: aumento e desconto do mesmo percentual não se anulam.' },
    ],
    summary: { basico: 'Subir 10% e depois descer 10% do valor maior faz você descer mais do que subiu.', intermediario: '(1 + p)(1 − p) = 1 − p² < 1.', avancado: 'Taxas sucessivas compõem multiplicativamente: taxa equivalente = ∏(1 + pᵢ) − 1.' },
  },
  'fis-cinematica': {
    skillId: 'fis-cinematica', curated: true,
    checkpoints: [
      { id: 'tempo', question: 'Quanto valem 30 minutos em horas decimais?', ack: 'Certo: 0,5 h.', correct: any(/0[,.]5|meia/i), misconceptions: [{ re: /0[,.]3/i, reply: 'Uma hora tem 60 minutos, não 100. 30 é que fração de 60?' }], explain: 'Minutos ÷ 60: 30 min = 0,5 h; 15 min = 0,25 h.' },
      { id: 'conversao', question: 'Para converter km/h em m/s, você multiplica ou divide por 3,6?', ack: 'Isso: divide.', correct: any(/divid/i), misconceptions: [{ re: /multiplic/i, reply: '1 m/s equivale a 3,6 km/h. Então o número em m/s é maior ou menor que em km/h?' }], explain: '1 km/h = 1000 m / 3600 s = 1/3,6 m/s: divide-se por 3,6.' },
    ],
    summary: { basico: 'Converter unidades é como trocar moedas: o valor real é o mesmo, só o número muda.', intermediario: 'vm = Δs/Δt (tempo total); km/h ÷ 3,6 = m/s.', avancado: 'Velocidade média é razão de totais, não média aritmética das velocidades.' },
  },
  'fis-energia': {
    skillId: 'fis-energia', curated: true,
    checkpoints: [
      { id: 'conserva', question: 'Sem atrito, a energia mecânica se conserva ou se perde?', ack: 'Certo: se conserva.', correct: any(/conserva|mant[eé]m|constante|n[aã]o se perde/i), misconceptions: [{ re: /perde|diminui/i, reply: 'Sem atrito nem resistência do ar, existe alguma força dissipando energia?' }], explain: 'Sem forças dissipativas, Ep + Ec é constante.' },
      { id: 'formas', question: 'Partindo do repouso no alto, que forma de energia o corpo tem no início e em que ela se transforma?', ack: 'Isso: potencial vira cinética.', correct: any(/potencial.*cin[eé]tica|cin[eé]tica.*potencial|potencial/i), misconceptions: [{ re: /^\s*cin[eé]tica\s*$/i, reply: 'Se está em repouso, a velocidade é zero. A energia cinética inicial é…?' }], explain: 'No alto e em repouso: só energia potencial (mgh). Ao cair, ela se transforma em cinética (mv²/2).' },
      { id: 'massa', question: 'Ao igualar m·g·h = m·v²/2, a massa influencia a velocidade final?', ack: 'Exato: a massa se cancela.', correct: any(/n[aã]o|cancela|corta|simplifica/i), misconceptions: [{ re: /\bsim\b|influencia|importa/i, reply: 'A massa aparece dos dois lados da igualdade. O que acontece com ela?' }], explain: 'm aparece nos dois lados e se cancela: v = √(2gh).' },
    ],
    summary: { basico: 'Energia é como dinheiro numa conta sem taxas: muda de aplicação, mas o total é o mesmo.', intermediario: 'mgh = mv²/2 → v = √(2gh).', avancado: 'Para forças conservativas, W = −ΔU; com dissipação, ΔEmec = W_nc.' },
  },
  'lin-interpretacao': {
    skillId: 'lin-interpretacao', curated: true,
    checkpoints: [
      { id: 'comando', question: 'Em suas palavras: o comando pede a opinião do autor, o tema do texto ou a estratégia usada?', ack: 'Certo — identificar o comando evita responder outra pergunta.', correct: any(/autor|opini|tese|defend|estrat|tema|afirma/i), misconceptions: [], explain: 'O comando define o alvo: "o autor defende" pede a tese; "estratégia" pede como o texto argumenta; "de acordo com o texto" pede o que está escrito.' },
      { id: 'prova', question: 'Qual trecho do texto sustenta a alternativa correta? Tente copiar a frase.', ack: 'Isso: com a prova em mãos, fica fácil eliminar as outras.', correct: any(/".+"|portanto|assim|no entanto|trecho|frase/i), misconceptions: [], explain: 'Procure conectores como "portanto", "assim", "no entanto": eles costumam introduzir a tese.' },
      { id: 'excesso', question: 'Na alternativa que você escolheu, alguma palavra vai além do que o texto diz (exagera, generaliza ou inverte)?', ack: 'Exato: nomear o erro da alternativa é o que impede repeti-lo.', correct: any(/extrapol|generaliz|invert|contradi|exager|vai al[eé]m|n[aã]o (diz|fala|menciona)|todos|sempre|superior/i), misconceptions: [], explain: 'Alternativas erradas costumam extrapolar (afirmam além do texto), generalizar (todos, sempre), inverter (trocam causa e efeito) ou contradizer.' },
    ],
    summary: { basico: 'Pense como um juiz: a alternativa certa precisa de prova no texto.', intermediario: 'C (comando) → P (prova textual) → E (eliminação pelos erros das demais).', avancado: 'Distinga inferência autorizada de pressuposição do leitor; conectores sinalizam a hierarquia argumentativa.' },
  },
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Para habilidades sem mapa curado: gera checkpoints a partir das perguntas rápidas da aula (curadas) ou das dicas da questão. */
export function conceptsFor(skillId: string, q?: Question): ConceptMap {
  if (CONCEPTS[skillId]) return CONCEPTS[skillId];
  const l = LESSONS.find((x) => x.skillIds.includes(skillId));
  const cps: Checkpoint[] = [];
  l?.checks.forEach((c, i) => cps.push({
    id: `aula-${i}`, question: `${c.q} (${c.options.join(' / ')})`, ack: c.feedback,
    correct: [new RegExp(escapeRe(c.options[c.answer].split(' ').slice(0, 2).join(' ')), 'i')],
    misconceptions: c.options.filter((_, k) => k !== c.answer).map((o) => ({ re: new RegExp(escapeRe(o.split(' ').slice(0, 2).join(' ')), 'i'), reply: `Não exatamente. ${c.feedback.split('.')[0]}. Pense de novo: ${c.q}` })),
    explain: c.feedback,
  }));
  if (q) q.hints.slice(0, 2).forEach((h, i) => cps.push({ id: `dica-${i}`, question: `${h} Com essa pista, como você continuaria?`, ack: 'Boa, você está no caminho.', correct: [/./], misconceptions: [], explain: q.hints[i + 1] ?? q.explanation }));
  return { skillId, checkpoints: cps, curated: false, summary: { basico: l?.micro ?? q?.explanation ?? '', intermediario: l?.visual.map((v) => `${v.label}: ${v.value}`).join('; ') ?? q?.fastMethod ?? '', avancado: l?.explanation.join(' ') ?? q?.explanation ?? '' } };
}

/** Raciocínios explicitamente incorretos (para detectar "acerto com raciocínio incorreto"). Padrões conservadores. */
export const WRONG_REASONING: Record<string, RegExp[]> = {
  'fis-potencia': [/corrente\s+(continua|permanece|fica|[eé])\s+(a\s+)?(mesma|igual|constante)/i, /pot[eê]ncia\s+(cai|reduz|diminui)\s+(pela\s+)?metade/i, /pot[eê]ncia\s+[eé]\s+proporcional\s+[àa]\s+tens[aã]o/i],
  'qui-equilibrio': [/catalisador\s+(desloca|aumenta\s+o\s+rendimento|favorece)/i],
  'bio-hormonios': [/glucagon\s+(reduz|diminui|guarda|armazena)/i, /insulina\s+(eleva|aumenta a glicemia|libera glicose|quebra)/i],
  'mat-porcentagem': [/se\s+anula|volta\s+ao\s+(pre[cç]o|valor)\s+original|somar?\s+as\s+porcentagens/i],
  'fis-cinematica': [/multiplic\w*\s+por\s+3[,.]6/i],
  'fis-energia': [/massa\s+(influencia|importa|aumenta)/i],
};

/** Quais checkpoints uma justificativa livre já demonstra e se ela revela raciocínio incorreto. */
export function readJustification(skillId: string, text: string) {
  const map = CONCEPTS[skillId];
  if (!text || text.trim().length < 8) return { shown: [] as string[], wrong: false };
  const wrong = (WRONG_REASONING[skillId] ?? []).some((r) => r.test(text));
  const shown = map ? map.checkpoints.filter((c) => c.correct.some((r) => r.test(text))).map((c) => c.id) : [];
  return { shown: wrong ? [] : shown, wrong };
}
