/** COMPARAÇÃO ENTRE CONCEITOS: reconhecimento e diferenciação. Cada item é classificado pelo estudante (A, B ou ambos). */
export interface Comparison { id: string; a: string; b: string; skillIds: string[]; intro: string; rows: { label: string; a: string; b: string }[]; items: { text: string; answer: 'a' | 'b' | 'ambos'; why: string }[] }

export const COMPARISONS: Comparison[] = [
  { id: 'c-pot-ener', a: 'Potência', b: 'Energia', skillIds: ['fis-energia-eletrica', 'fis-potencia'], intro: 'Grandezas ligadas pelo tempo, mas diferentes.',
    rows: [{ label: 'O que mede', a: 'rapidez da transformação', b: 'total transformado' }, { label: 'Unidade usual', a: 'watt (W)', b: 'kWh ou joule' }, { label: 'Relação', a: 'P = E/Δt', b: 'E = P·Δt' }],
    items: [{ text: 'Vem escrita na etiqueta do chuveiro como 5 500 W.', answer: 'a', why: 'Watt mede potência.' }, { text: 'É cobrada na conta de luz em kWh.', answer: 'b', why: 'kWh mede energia.' }, { text: 'Aumenta se o aparelho ficar mais tempo ligado.', answer: 'b', why: 'O tempo altera a energia total; a potência não.' }] },
  { id: 'c-campo-forca', a: 'Campo magnético', b: 'Força magnética', skillIds: ['fis-campo-magnetico', 'fis-forca-magnetica'], intro: 'O campo pode existir sem que haja força sobre uma carga.',
    rows: [{ label: 'Natureza', a: 'propriedade do espaço', b: 'interação com carga em movimento' }, { label: 'Origem', a: 'ímãs e correntes', b: 'campo agindo sobre carga com velocidade' }, { label: 'Direção', a: 'tangente às linhas de campo', b: 'perpendicular a v e a B' }],
    items: [{ text: 'Existe ao redor de um fio com corrente, mesmo sem outra carga por perto.', answer: 'a', why: 'A corrente cria o campo.' }, { text: 'É nula para uma carga em repouso.', answer: 'b', why: 'F = qvB·senθ com v = 0.' }, { text: 'Mede-se em tesla.', answer: 'a', why: 'Tesla é unidade de campo; força é em newton.' }] },
  { id: 'c-centr-cin', a: 'Força centrípeta', b: 'Energia cinética', skillIds: ['fis-centripeta', 'fis-energia'], intro: 'As fórmulas se parecem (mv²), as grandezas não.',
    rows: [{ label: 'Natureza', a: 'vetorial (N)', b: 'escalar (J)' }, { label: 'Expressão', a: 'mv²/R', b: 'mv²/2' }, { label: 'Papel', a: 'muda a direção da velocidade', b: 'mede o movimento' }],
    items: [{ text: 'Depende do raio da curva.', answer: 'a', why: 'R aparece só em mv²/R.' }, { text: 'Quadruplica se a velocidade dobra (demais grandezas fixas).', answer: 'ambos', why: 'As duas são proporcionais a v².' }, { text: 'Existe em movimento retilíneo uniforme.', answer: 'b', why: 'Há movimento, mas não há resultante centrípeta.' }] },
  { id: 'c-adh-aldo', a: 'ADH', b: 'Aldosterona', skillIds: ['bio-osmorregulacao'], intro: 'Ambos conservam água, por caminhos diferentes.',
    rows: [{ label: 'Estímulo principal', a: 'osmolaridade alta', b: 'pressão/volume baixos' }, { label: 'Ação direta', a: 'reabsorver água', b: 'reabsorver sódio' }, { label: 'Origem', a: 'hipotálamo/neuro-hipófise', b: 'córtex da adrenal' }],
    items: [{ text: 'Age sobretudo na reabsorção de sódio.', answer: 'b', why: 'A água acompanha o sódio.' }, { text: 'Sua falta causa urina abundante e diluída.', answer: 'a', why: 'Diabetes insípido.' }, { text: 'Contribui para reter água no organismo.', answer: 'ambos', why: 'ADH diretamente; aldosterona por meio do sódio.' }] },
  { id: 'c-ins-gluc', a: 'Insulina', b: 'Glucagon', skillIds: ['bio-hormonios'], intro: 'Par antagônico do pâncreas.',
    rows: [{ label: 'Efeito', a: 'reduz a glicemia', b: 'eleva a glicemia' }, { label: 'Quando predomina', a: 'após refeição', b: 'em jejum' }, { label: 'Fígado', a: 'forma glicogênio', b: 'quebra glicogênio' }],
    items: [{ text: 'Predomina após uma refeição.', answer: 'a', why: 'A glicemia está alta.' }, { text: 'É produzido no pâncreas.', answer: 'ambos', why: 'Células beta e alfa.' }, { text: 'Estimula a quebra de glicogênio.', answer: 'b', why: 'Libera glicose no sangue.' }] },
  { id: 'c-dir-inv', a: 'Proporção direta', b: 'Proporção inversa', skillIds: ['mat-proporcao'], intro: 'Decidir o tipo vem antes da conta.',
    rows: [{ label: 'Comportamento', a: 'crescem juntas', b: 'uma cresce, a outra diminui' }, { label: 'Constante', a: 'razão a/b', b: 'produto a·b' }],
    items: [{ text: 'Número de operários e tempo para terminar a obra.', answer: 'b', why: 'Mais operários, menos tempo.' }, { text: 'Litros de combustível e valor pago.', answer: 'a', why: 'Mais litros, maior valor.' }, { text: 'Velocidade e tempo em um mesmo percurso.', answer: 'b', why: 'Mais rápido, menos tempo.' }] },
  { id: 'c-osm-ativo', a: 'Osmose', b: 'Transporte ativo', skillIds: ['bio-citologia'], intro: 'Gradiente e gasto de energia distinguem os dois.',
    rows: [{ label: 'Energia', a: 'não gasta ATP', b: 'gasta ATP' }, { label: 'Gradiente', a: 'a favor', b: 'contra' }],
    items: [{ text: 'Cessa se faltar ATP.', answer: 'b', why: 'Depende de energia.' }, { text: 'Faz a hemácia inchar em água destilada.', answer: 'a', why: 'A água entra por osmose.' }] },
  { id: 'c-hob-loc', a: 'Hobbes', b: 'Locke', skillIds: ['hum-filosofia'], intro: 'Dois contratualistas, dois limites para o poder.',
    rows: [{ label: 'Estado de natureza', a: 'guerra de todos contra todos', b: 'direitos naturais sem juiz comum' }, { label: 'Poder', a: 'soberano forte', b: 'limitado' }],
    items: [{ text: 'Admite resistência se o governo violar direitos.', answer: 'b', why: 'O contrato se rompe.' }, { text: 'Parte da ideia de contrato social.', answer: 'ambos', why: 'Os dois são contratualistas.' }, { text: 'Justifica o poder pelo medo da morte violenta.', answer: 'a', why: 'Tese de Hobbes.' }] },
  { id: 'c-ironia', a: 'Ironia', b: 'Maiêutica', skillIds: ['fil-antiga'], intro: 'Dois momentos do diálogo socrático.',
    rows: [{ label: 'Objetivo', a: 'desfazer a falsa certeza', b: 'ajudar a construir a ideia' }, { label: 'Momento', a: 'primeiro', b: 'segundo' }],
    items: [{ text: 'O interlocutor percebe que não sabia.', answer: 'a', why: 'A certeza é desfeita.' }, { text: 'O interlocutor formula a própria definição.', answer: 'b', why: 'É o "parto" de ideias.' }] },
];
export const comparisonsForSkill = (id: string) => COMPARISONS.filter((c) => c.skillIds.includes(id));
export const comparisonById = (id: string) => COMPARISONS.find((c) => c.id === id);
