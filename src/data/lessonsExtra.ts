import type { Lesson } from './lessons';

// Aulas demonstrativas (conteúdo autoral, sem revisão pedagógica humana).
export const EXTRA_LESSONS: Lesson[] = [
  {
    id: 'l-magnetismo', title: 'Campo magnético, força magnética e indução', subject: 'Física', skillIds: ['fis-campo-magnetico', 'fis-forca-magnetica', 'fis-inducao'], level: 'Intermediário', minutes: 12, origin: 'ia_revisao',
    micro: 'Três perguntas resolvem quase tudo: **quem cria o campo?** (ímã ou corrente), **há carga em movimento no campo?** (força) e **o fluxo está variando?** (indução).',
    explanation: [
      'Campo magnético é uma propriedade do espaço criada por ímãs e por cargas em movimento. Em um fio reto longo, B é proporcional à corrente e inversamente proporcional à distância; no solenoide, depende da corrente e da densidade de espiras.',
      'Força magnética age sobre carga em movimento: F = q·v·B·senθ. Carga parada ou com velocidade paralela ao campo não sofre força.',
      'Como a força é perpendicular à velocidade, ela muda a direção sem realizar trabalho: em campo uniforme e v perpendicular a B, o movimento é circular, com R = mv/(qB).',
      'Indução: variação do fluxo magnético através de uma bobina cria fem. Fluxo constante não induz corrente, por mais intenso que seja o campo.',
    ],
    visual: [{ label: 'Campo', value: 'ímã ou corrente' }, { label: 'Força', value: 'F = qvB·senθ' }, { label: 'Indução', value: 'fluxo variando' }],
    concepts: ['Campo magnético', 'Força magnética', 'Fluxo e indução'],
    patterns: ['"bússola", "eletroímã" → campo', '"partícula lançada", "trajetória" → força', '"gerador", "carregador sem fio", "aproxima o ímã" → indução'],
    examples: ['Próton em repouso em campo uniforme: força nula.', 'Ímã parado na bobina: corrente nula.', 'Fio de 0,5 m com 4 A em 0,2 T, perpendicular: F = 0,4 N.'],
    formulas: [{ expr: 'F = q·v·B·senθ', vars: 'θ: ângulo entre v e B', when: 'Carga em movimento em um campo.' }, { expr: 'F = B·i·L', vars: 'fio perpendicular ao campo', when: 'Fio com corrente.' }, { expr: 'R = m·v/(q·B)', vars: 'v perpendicular a B', when: 'Trajetória circular.' }],
    mistakes: ['Achar que todo campo produz força sobre qualquer carga.', 'Dizer que a força magnética aumenta a rapidez.', 'Esquecer que a indução exige variação do fluxo.'],
    examUse: ['Motores, geradores, carregadores por indução, aceleradores e trens magnéticos.'],
    solved: { problem: 'Um elétron entra perpendicularmente em um campo uniforme. O que acontece com o raio se a velocidade dobra?', steps: ['A força magnética é a resultante centrípeta: qvB = mv²/R.', 'Isolando: R = mv/(qB).', 'Com m, q e B fixos, R é proporcional a v: o raio dobra.'] },
    checks: [{ after: 2, q: 'Uma carga parada em um campo magnético sofre força magnética?', options: ['Sim', 'Não'], answer: 1, feedback: 'Não: F = qvB·senθ e v = 0.' }, { after: 4, q: 'Um ímã parado dentro de uma bobina induz corrente?', options: ['Sim, se for potente', 'Não, o fluxo não varia'], answer: 1, feedback: 'É a variação do fluxo que induz a fem.' }],
    exerciseIds: ['v01', 'v06', 'v10'], transferId: 'v08',
  },
  {
    id: 'l-dinamica', title: 'Força resultante e força centrípeta', subject: 'Física', skillIds: ['fis-dinamica', 'fis-centripeta'], level: 'Intermediário', minutes: 10, origin: 'ia_revisao',
    micro: 'Antes de calcular, desenhe as forças. A **resultante** define a aceleração; em curvas, a componente dela voltada ao centro é chamada de **centrípeta**.',
    explanation: [
      'Primeira lei: resultante nula significa repouso ou velocidade constante. Segunda lei: a = F/m, na direção da resultante.',
      'Na curva, mesmo com rapidez constante, a direção da velocidade muda: existe aceleração para o centro, v²/R.',
      'Força centrípeta não é uma força a mais: é o nome da resultante voltada ao centro. Pode ser atrito (carro), tração (balanço), gravidade (satélite) ou força magnética (carga).',
    ],
    visual: [{ label: '2ª lei', value: 'F = m·a' }, { label: 'Centrípeta', value: 'm·v²/R' }, { label: 'Constante', value: 'v const. → F = 0' }],
    concepts: ['Resultante', 'Inércia', 'Aceleração centrípeta'], patterns: ['"velocidade constante" → resultante nula', '"curva", "looping", "satélite" → resultante centrípeta'],
    examples: ['Elevador subindo com velocidade constante: normal = peso.', 'Dobrar a velocidade na mesma curva exige força quatro vezes maior.'],
    formulas: [{ expr: 'F = m·a', vars: 'F: resultante', when: 'Sempre que há aceleração.' }, { expr: 'Fc = m·v²/R', vars: 'R: raio', when: 'Trajetória curva.' }],
    mistakes: ['Desenhar a centrípeta como força extra.', 'Confundir velocidade constante com ausência de forças.'],
    examUse: ['Trânsito, elevadores, brinquedos de parque, órbitas.'],
    solved: { problem: 'No ponto mais baixo de um balanço, a tração é maior ou menor que o peso?', steps: ['O centro está acima: a resultante aponta para cima.', 'T − P = mv²/R.', 'Logo, T = P + mv²/R > P.'] },
    checks: [{ after: 1, q: 'Um corpo com velocidade constante tem resultante', options: ['nula', 'na direção do movimento'], answer: 0, feedback: 'Sem aceleração, a resultante é nula.' }],
    exerciseIds: ['v16', 'v18'], transferId: 'v19',
  },
  {
    id: 'l-osmorregulacao', title: 'ADH e aldosterona: quem retém o quê', subject: 'Biologia', skillIds: ['bio-osmorregulacao'], level: 'Intermediário', minutes: 8, origin: 'ia_revisao',
    micro: 'O **ADH** responde à concentração do sangue e retém **água**. A **aldosterona** responde à queda de pressão e retém **sódio** — e a água vai junto.',
    explanation: ['Quando o plasma fica concentrado, o hipotálamo estimula a liberação de ADH pela neuro-hipófise. Os túbulos coletores reabsorvem mais água: urina escassa e concentrada.', 'Queda de pressão ou volume ativa renina → angiotensina → aldosterona (córtex da adrenal), que reabsorve sódio; a água acompanha por osmose.', 'Falta de ação do ADH (diabetes insípido) produz urina abundante e diluída, sem glicose.'],
    visual: [{ label: 'ADH', value: 'água' }, { label: 'Aldosterona', value: 'sódio (e água)' }, { label: 'Sem ADH', value: 'urina diluída' }],
    concepts: ['Osmolaridade', 'Renina-angiotensina', 'Reabsorção'], patterns: ['"suor", "sede", "urina concentrada" → ADH', '"hemorragia", "queda de pressão", "sódio" → aldosterona'], examples: ['Corrida no calor sem hidratação: mais ADH.', 'Hemorragia: ativação da aldosterona.'],
    formulas: [], mistakes: ['Dizer que o ADH aumenta a urina.', 'Atribuir ao ADH a retenção direta de sódio.'], examUse: ['Situações de desidratação, álcool (inibe ADH), hipertensão e hemorragia.'],
    solved: { problem: 'Por que o álcool aumenta o volume de urina?', steps: ['O álcool inibe a liberação de ADH.', 'Menos ADH → menos água reabsorvida.', 'Urina mais abundante e diluída.'] },
    checks: [{ after: 2, q: 'Qual hormônio retém sódio?', options: ['ADH', 'Aldosterona'], answer: 1, feedback: 'A aldosterona retém sódio e a água acompanha.' }],
    exerciseIds: ['v26', 'v58'], transferId: 'v27',
  },
];
