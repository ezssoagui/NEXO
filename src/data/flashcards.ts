import type { Flashcard, Subject } from '../types';

const raw: [Subject, string, string, string, string][] = [
  ['Física', 'Eletrodinâmica', 'fis-potencia', 'Três fórmulas de potência elétrica?', 'P = U·I; P = R·I²; P = U²/R'],
  ['Física', 'Eletrodinâmica', 'fis-potencia', 'Em série, qual grandeza é igual em todos os resistores?', 'A corrente elétrica.'],
  ['Física', 'Eletrodinâmica', 'fis-potencia', 'Em paralelo, qual grandeza é igual em todos os ramos?', 'A tensão elétrica.'],
  ['Física', 'Eletrodinâmica', 'fis-potencia', 'Lâmpadas em paralelo: qual brilha mais?', 'A de menor resistência (P = U²/R).'],
  ['Física', 'Eletrodinâmica', 'fis-potencia', 'Lei de Ohm?', 'U = R · I'],
  ['Física', 'Eletrodinâmica', 'fis-potencia', 'Energia consumida por um aparelho?', 'E = P · Δt (kWh se P em kW e Δt em h).'],
  ['Física', 'Cinemática', 'fis-cinematica', 'Velocidade média?', 'vm = Δs / Δt (tempo total, inclusive paradas).'],
  ['Física', 'Cinemática', 'fis-cinematica', '72 km/h em m/s?', '20 m/s.'],
  ['Física', 'Cinemática', 'fis-cinematica', '45 min em horas?', '0,75 h.'],
  ['Física', 'Energia', 'fis-energia', 'Energia cinética?', 'Ec = m·v²/2'],
  ['Física', 'Energia', 'fis-energia', 'Energia potencial gravitacional?', 'Ep = m·g·h'],
  ['Física', 'Energia', 'fis-energia', 'Trabalho do atrito em piso horizontal?', 'τ = μ·m·g·d (dissipa energia).'],
  ['Física', 'Ondulatória', 'fis-ondas', 'Prefixo mega (M)?', '10⁶'],
  ['Química', 'Equilíbrio', 'qui-equilibrio', 'Princípio de Le Chatelier?', 'Sistema em equilíbrio perturbado desloca-se para atenuar a perturbação.'],
  ['Química', 'Equilíbrio', 'qui-equilibrio', 'Aumento de temperatura favorece qual sentido?', 'O endotérmico.'],
  ['Química', 'Equilíbrio', 'qui-equilibrio', 'Aumento de pressão favorece qual lado?', 'O lado com menos mols gasosos.'],
  ['Química', 'Equilíbrio', 'qui-equilibrio', 'Qual perturbação altera o valor de K?', 'Somente a temperatura.'],
  ['Química', 'Estequiometria', 'qui-estequiometria', 'Relação entre massa, mol e massa molar?', 'n = m / M'],
  ['Química', 'Estequiometria', 'qui-estequiometria', 'Massa molar do CO₂?', '44 g/mol (12 + 2·16).'],
  ['Química', 'Soluções', 'qui-concentracao', 'Concentração comum?', 'C = m/V (g/L).'],
  ['Química', 'pH', 'qui-ph', 'pH a 25 °C: ácido, neutro, básico?', '< 7 ácido; = 7 neutro; > 7 básico.'],
  ['Química', 'pH', 'qui-ph', 'Diferença de 1 unidade de pH equivale a?', 'Fator 10 em [H⁺].'],
  ['Biologia', 'Endocrinologia', 'bio-hormonios', 'Células que produzem insulina?', 'Células beta das ilhotas pancreáticas.'],
  ['Biologia', 'Endocrinologia', 'bio-hormonios', 'Função do ADH?', 'Aumentar a reabsorção de água nos rins.'],
  ['Biologia', 'Endocrinologia', 'bio-hormonios', 'Glândula que produz adrenalina?', 'Medula das glândulas adrenais (suprarrenais).'],
  ['Biologia', 'Ecologia', 'bio-ecologia', 'Produtores em uma cadeia alimentar?', 'Organismos autótrofos (ex.: plantas, algas).'],
  ['Biologia', 'Ecologia', 'bio-ecologia', 'Por que a energia diminui ao longo da cadeia?', 'Parte é perdida como calor e em atividades metabólicas em cada nível.'],
  ['Biologia', 'Genética', 'bio-genetica', 'Genótipo × fenótipo?', 'Genótipo: constituição genética. Fenótipo: característica observável.'],
  ['Biologia', 'Genética', 'bio-genetica', 'Aa × aa: proporção?', '1/2 Aa : 1/2 aa.'],
  ['Matemática', 'Porcentagem', 'mat-porcentagem', 'Desconto de 25% equivale a multiplicar por?', '0,75'],
  ['Matemática', 'Porcentagem', 'mat-porcentagem', 'Dois descontos de 20%: desconto total?', '36% (0,8 × 0,8 = 0,64).'],
  ['Matemática', 'Probabilidade', 'mat-probabilidade', 'Probabilidade clássica?', 'P = casos favoráveis / casos possíveis (equiprováveis).'],
  ['Matemática', 'Probabilidade', 'mat-probabilidade', 'P(A e B) independentes?', 'P(A) · P(B)'],
  ['Matemática', 'Estatística', 'mat-estatistica', 'O que é moda?', 'O valor mais frequente.'],
  ['Matemática', 'Geometria', 'mat-geometria', 'Volume do cilindro?', 'V = π·r²·h'],
  ['Linguagens', 'Interpretação', 'lin-interpretacao', 'O que é extrapolação em uma alternativa?', 'Afirmar algo que vai além do que o texto sustenta.'],
  ['Linguagens', 'Interpretação', 'lin-interpretacao', 'Palavras absolutas (sempre, nunca, qualquer) sinalizam?', 'Possível generalização indevida.'],
  ['Linguagens', 'Funções da linguagem', 'lin-funcoes', 'Função centrada na mensagem e na forma?', 'Função poética.'],
  ['Humanas', 'História', 'hum-historia', 'Estado Novo: período?', '1937–1945.'],
  ['Humanas', 'Filosofia', 'hum-filosofia', 'Locke: direitos naturais?', 'Vida, liberdade e propriedade.'],
];

export const FLASHCARDS: Flashcard[] = raw.map(([subject, topic, skillId, front, back], i) => ({
  id: `f${String(i + 1).padStart(2, '0')}`, subject, topic, skillId, front, back, kind: 'curricular',
}));

/** Cartões conceituais: pedem relação ou distinção, não só memória. */
const conceptual: [Subject, string, string, string, string][] = [
  ['Física', 'Magnetismo', 'fis-forca-magnetica', 'Quando existe campo magnético sem força sobre uma carga?', 'Carga em repouso ou com velocidade paralela ao campo.'],
  ['Física', 'Indução', 'fis-inducao', 'Por que um ímã parado na bobina não gera corrente?', 'O fluxo não varia: sem variação, não há fem induzida.'],
  ['Física', 'Dinâmica', 'fis-centripeta', 'A força centrípeta é uma força a mais? Explique.', 'Não: é a resultante das forças na direção do centro.'],
  ['Física', 'Eletrodinâmica', 'fis-energia-eletrica', 'Potência × energia elétrica: o que liga as duas?', 'O tempo: E = P·Δt.'],
  ['Biologia', 'Sistema excretor', 'bio-osmorregulacao', 'ADH × aldosterona: o que cada um retém?', 'ADH: água. Aldosterona: sódio (e a água acompanha).'],
  ['Biologia', 'Membrana', 'bio-citologia', 'Osmose × transporte ativo: dois critérios de diferença?', 'Gasto de ATP e sentido em relação ao gradiente.'],
  ['Química', 'Eletroquímica', 'qui-eletroquimica', 'Por que o metal de sacrifício protege o ferro?', 'Tem menor potencial de redução e oxida primeiro.'],
  ['Humanas', 'Filosofia antiga', 'fil-antiga', 'Ironia × maiêutica?', 'Desfazer a falsa certeza × ajudar a construir a ideia.'],
];
FLASHCARDS.push(...conceptual.map(([subject, topic, skillId, front, back], i) => ({ id: `k${String(i + 1).padStart(2, '0')}`, subject, topic, skillId, front, back, kind: 'conceitual' as const })));
