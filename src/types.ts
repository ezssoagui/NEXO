export type Subject = 'Matemática' | 'Física' | 'Química' | 'Biologia' | 'Linguagens' | 'Humanas';
export type Area = 'Matemática' | 'Ciências da Natureza' | 'Linguagens' | 'Ciências Humanas';
export type Exam = 'ENEM' | 'Vestibular';
export type Difficulty = 'Fácil' | 'Média' | 'Difícil';
export type Confidence = 'certeza' | 'duvida' | 'chute' | 'nao_consegui' | 'nao_informada';

/** Erro típico associado a uma alternativa (evidência fraca). */
export type ErrorType = 'lacuna_conceitual' | 'interpretacao' | 'formula_incorreta' | 'grandeza_constante' | 'calculo' | 'unidades' | 'desatencao' | 'alternativas_plausiveis' | 'memorizacao';
/** Autoclassificação opcional do estudante (Matemática e Ciências da Natureza). */
export type ErrorCategory = 'lacuna' | 'conceitual' | 'interpretativa' | 'aplicacao' | 'procedimental' | 'atencao' | 'nao_sei';
export type CpeStepId = 'comando' | 'prova' | 'eliminacao';

export interface Alternative { letter: 'A' | 'B' | 'C' | 'D' | 'E'; text: string; correct?: boolean; analysis: string; errorType?: ErrorType; tutorPrompt?: string; prerequisite?: string }
export interface CPE { comando: string; prova: string; excesso: { letter: string; tipo: string; motivo: string }[] }

export interface Question {
  id: string; exam: Exam; style: string; subject: Subject; area: Area; topic: string; skillId: string; year: number; difficulty: Difficulty;
  type: 'objetiva' | 'aberta';
  source: 'original_nexo' | 'gerada_ia_demo';
  context?: string; statement: string; alternatives?: Alternative[];
  openAnswer?: { value: number; tolerance?: number; unit?: string; wrongMap?: { value: number; errorType: ErrorType; tutorPrompt: string }[] };
  hints: string[]; explanation: string; fastMethod: string; cpe?: CPE;
  flashcard: { front: string; back: string };
  twinId?: string; lessonId?: string;
  /** Nível como questão gêmea: 1 aplicação direta, 2 transferência contextual, 3 integração. */
  twinLevel?: 1 | 2 | 3;
  integrates?: string[];
}

export interface Skill { id: string; name: string; subject: Subject; area: Area; lessonId?: string; prerequisites: string[]; /** Códigos da matriz oficial, ex.: "CN-H21". */ matrix: string[] }

/** Contexto em que a questão foi respondida. Todos são resolução independente (sem IA). */
export type AttemptMode = 'adaptativo' | 'bateria' | 'simulado' | 'diagnostico' | 'sessao' | 'revisao';
export interface Attempt {
  id: string; qid: string; skillId: string; subject: Subject; chosen: string; correct: boolean; confidence: Confidence; ts: number; mode: AttemptMode;
  /** Questão gêmea / inédita usada para comprovar. */
  isTwin?: boolean; twinLevel?: 1 | 2 | 3;
  timeSec?: number; justification?: string;
  /** Houve ajuda antes da resposta: não conta como comprovação autônoma. */
  assisted?: boolean;
  errorType?: ErrorType;
  /** Autoclassificação do estudante; ausente = pulou o formulário. */
  selfCategory?: ErrorCategory;
  /** Resultado de cada etapa do CPE nesta correção. */
  cpe?: Partial<Record<CpeStepId, 'demonstrada' | 'dificuldade' | 'pulada'>>;
  corrected?: boolean;
}

export type Dimension = 'resolucao' | 'compreensao' | 'transferencia' | 'retencao';
export type DimStatus = 'sem_evidencia' | 'parcial' | 'demonstrada' | 'negativa';
export type DomainState = 'nao_avaliado' | 'em_aprendizagem' | 'provisorio' | 'consolidado';

// ---------- Explicação ativa ----------
export type ExplainLevel = 'iniciante' | 'intermediario' | 'avancado';
export type ExplainResult = 'demonstrada' | 'parcial' | 'nao_demonstrada' | 'inconclusiva';
export interface CriterionScore { id: 'correcao' | 'completude' | 'coerencia' | 'relacoes' | 'autonomia'; score: 0 | 1 | 2; note: string }
export interface Explanation {
  id: string; taskId: string; skillId: string; level: ExplainLevel; text: string; ts: number; result: ExplainResult; criteria: CriterionScore[];
  /** Feita após ver a referência ou com ajuda: não comprova. */
  assisted?: boolean; selfCheck?: 'completa' | 'parcial' | 'equivocada'; engine: string; demo: boolean; context?: 'livre' | 'sessao' | 'revisao';
}

// ---------- Sessões e pendências ----------
export type SessionType = 'recuperacao' | 'aprendizagem' | 'aprofundamento' | 'comprovacao' | 'revisao' | 'redacao';
export type StepKind = 'verificacao' | 'aula' | 'microaula' | 'conceito' | 'comparacao' | 'exemplo' | 'recordacao' | 'explicacao' | 'exercicio' | 'gemea' | 'inedita' | 'flashcards' | 'consolidacao' | 'red_aula' | 'red_analise' | 'red_explicacao' | 'red_paragrafo' | 'red_verificacao';
export interface SessionStep { kind: StepKind; title: string; minutes: number; skillId?: string; ref?: string; count?: number }
export interface SessionPlan { key: string; type: SessionType; title: string; question: string; reason: string; audit: string[]; skillIds: string[]; steps: SessionStep[]; minutes: number; priority: number }
export interface SessionRecord extends Omit<SessionPlan, 'priority'> { id: string; idx: number; status: 'andamento' | 'concluida' | 'abandonada'; startedAt: number; finishedAt?: number; log: { idx: number; ts: number; outcome: 'feita' | 'pulada' | 'acerto' | 'erro'; ref?: string }[] }
export interface Pending { key: string; type: SessionType; title: string; skillIds: string[]; status: 'adiada' | 'ignorada' | 'substituida'; createdAt: number; until: number; reason: string }

// ---------- Atividades de resolução (bateria, simulado, diagnóstico) ----------
export type ActivityKind = 'bateria' | 'simulado' | 'diagnostico';
export interface ActivityAnswer { chosen: string; confidence: Confidence; timeSec: number }
export interface Activity { id: string; kind: ActivityKind; title: string; qids: string[]; idx: number; answers: Record<string, ActivityAnswer>; status: 'andamento' | 'pausada' | 'concluida'; startedAt: number; finishedAt?: number; limitSec?: number; attemptIds?: string[] }

// ---------- Revisões ----------
export interface SkillReview { due: number; interval: number; ease: number; last?: number; lapses: number }
export interface Flashcard { id: string; subject: Subject; topic: string; skillId: string; front: string; back: string; kind: 'curricular' | 'personalizado' | 'conceitual' }
export type CardRating = 1 | 2 | 3 | 4; // 1 errei · 2 difícil · 3 bom · 4 fácil
export interface CardState { s: number; d: number; due: number; last: number; reps: number; lapses: number; reviews: { ts: number; rating: CardRating }[] }

export interface Profile { nickname: string; course: string; examYear: number; weeklyHours: number; goal: 'ENEM' }

// ---------- Redação ----------
export type CompId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export interface EssayEval {
  competencies: { id: CompId; name: string; score: number; summary: string; points: string[]; justification?: string; evidence?: string[]; problems?: string[]; suggestions?: string[]; exercise?: string }[];
  total: number;
  highlights: { start: number; end: number; comp: string; severity: 'erro' | 'atencao' | 'positivo'; message: string }[];
  aspects: { label: string; status: 'ok' | 'parcial' | 'ausente'; note: string }[];
  intervention: { agente: boolean; acao: boolean; meio: boolean; finalidade: boolean; detalhamento: boolean };
  stats: { words: number; paragraphs: number; sentences: number; avgSentence: number; connectives: string[] };
  engine: string;
}
export interface EssayVersion { text: string; title?: string; ts: number; eval?: EssayEval; diagnostic?: boolean }
export interface Essay { id: string; themeId: string; versions: EssayVersion[]; draft?: string }
export interface EssayPractice { id: string; skillId: string; ts: number; themeId?: string; ok: boolean; kind: 'analise' | 'explicacao' | 'paragrafo' | 'verificacao' }

export interface GeneratedQuestion { q: Question; validation: { check: string; ok: boolean; detail: string }[]; status: 'aprovada' | 'revisao' | 'rejeitada'; request: string; ts: number }
