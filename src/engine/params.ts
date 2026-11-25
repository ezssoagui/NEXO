/**
 * PARÂMETROS EXPERIMENTAIS E CONFIGURÁVEIS do motor pedagógico (Configurações → Parâmetros).
 * São pontos de partida do protótipo; NÃO são valores cientificamente validados.
 */
export interface Params {
  janelaResolucao: number; resolucaoMin: number; resolucaoTaxa: number;
  transferenciaMin: number; compreensaoMin: number; retencaoDias: number;
  dificuldadeMinErros: number; dificuldadeTaxa: number; janelaDificuldade: number;
  padraoMinErros: number; padraoProporcao: number;
  aproveitamentoJanela: number; revisaoInicialDias: number; retencaoAlvoFsrs: number; diagnosticoAlvo: number;
}
export const DEFAULT_PARAMS: Params = {
  janelaResolucao: 5, resolucaoMin: 2, resolucaoTaxa: 0.6,
  transferenciaMin: 1, compreensaoMin: 1, retencaoDias: 7,
  dificuldadeMinErros: 3, dificuldadeTaxa: 0.4, janelaDificuldade: 10,
  padraoMinErros: 3, padraoProporcao: 0.5,
  aproveitamentoJanela: 30, revisaoInicialDias: 3, retencaoAlvoFsrs: 0.9, diagnosticoAlvo: 180,
};
export const PARAM_INFO: Record<keyof Params, { label: string; hint: string; min: number; max: number; step: number }> = {
  janelaResolucao: { label: 'Janela de resolução', hint: 'Respostas mais recentes consideradas por habilidade.', min: 3, max: 10, step: 1 },
  resolucaoMin: { label: 'Acertos sólidos mínimos', hint: 'Para demonstrar resolução.', min: 1, max: 6, step: 1 },
  resolucaoTaxa: { label: 'Proporção mínima na janela', hint: 'Entre 0 e 1.', min: 0.4, max: 1, step: 0.05 },
  transferenciaMin: { label: 'Transferências mínimas', hint: 'Acertos em contexto novo ou integração.', min: 1, max: 4, step: 1 },
  compreensaoMin: { label: 'Explicações mínimas', hint: 'Explicações ativas demonstradas.', min: 1, max: 4, step: 1 },
  retencaoDias: { label: 'Dias para retenção', hint: 'Intervalo mínimo após a primeira demonstração.', min: 1, max: 60, step: 1 },
  dificuldadeMinErros: { label: 'Erros para indicar dificuldade', hint: 'Dentro de um bloco curricular.', min: 2, max: 10, step: 1 },
  dificuldadeTaxa: { label: 'Taxa de erro para dificuldade', hint: 'Entre 0 e 1.', min: 0.2, max: 0.9, step: 0.05 },
  janelaDificuldade: { label: 'Janela de dificuldade', hint: 'Questões recentes por bloco.', min: 5, max: 30, step: 1 },
  padraoMinErros: { label: 'Erros para indicar padrão', hint: 'Nunca com uma única questão.', min: 2, max: 10, step: 1 },
  padraoProporcao: { label: 'Proporção do padrão', hint: 'Parte dos erros classificados.', min: 0.3, max: 1, step: 0.05 },
  aproveitamentoJanela: { label: 'Janela do aproveitamento', hint: 'Respostas recentes do indicador.', min: 10, max: 100, step: 5 },
  revisaoInicialDias: { label: 'Primeira revisão (dias)', hint: 'Habilidade recém-demonstrada.', min: 1, max: 14, step: 1 },
  retencaoAlvoFsrs: { label: 'Retenção-alvo (FSRS)', hint: 'Entre 0,70 e 0,97.', min: 0.7, max: 0.97, step: 0.01 },
  diagnosticoAlvo: { label: 'Questões do diagnóstico', hint: 'Alvo da avaliação complementar.', min: 40, max: 180, step: 20 },
};
