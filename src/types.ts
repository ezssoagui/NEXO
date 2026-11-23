export type Subject = 'Matemática' | 'Física' | 'Química' | 'Biologia' | 'Linguagens' | 'Humanas';
export type Area = 'Matemática' | 'Ciências da Natureza' | 'Linguagens' | 'Ciências Humanas';
export type Exam = 'ENEM' | 'Vestibular' | 'Olimpíada';
export type Difficulty = 'Fácil' | 'Média' | 'Difícil';
export type Confidence = 'certeza' | 'duvida' | 'chute' | 'nao_consegui' | 'nao_informada';

export type ErrorType =
  | 'lacuna_conceitual'
  | 'interpretacao'
  | 'formula_incorreta'
  | 'grandeza_constante'
  | 'calculo'
  | 'unidades'
  | 'desatencao'
  | 'alternativas_plausiveis'
  | 'chute'
  | 'memorizacao';

export interface Alternative {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  correct?: boolean;
  analysis: string;          // por que está certa/errada
  errorType?: ErrorType;     // erro típico de quem marca esta alternativa
  tutorPrompt?: string;      // feedback socrático específico
  prerequisite?: string;     // erro típico ligado a um pré-requisito (skillId)
}

export interface CPE { comando: string; prova: string; excesso: { letter: string; tipo: string; motivo: string }[] }

export interface Question {
  id: string;
  exam: Exam;
  style: string;               // ex.: "Estilo ENEM", "Estilo vestibular tradicional", "Estilo olimpíada"
  subject: Subject;
  area: Area;
  topic: string;
  skillId: string;
  year: number;                // ano de elaboração
  difficulty: Difficulty;
  type: 'objetiva' | 'aberta';
  source: 'original_nexo' | 'gerada_ia_demo';
  context?: string;            // texto-base
  statement: string;
  alternatives?: Alternative[];
  openAnswer?: { value: number; tolerance?: number; unit?: string; wrongMap?: { value: number; errorType: ErrorType; tutorPrompt: string }[] };
  hints: [string, string, string];
  explanation: string;
  fastMethod: string;
  cpe?: CPE;
  flashcard: { front: string; back: string };
  twinId?: string;
  lessonId?: string;
  /** Nível da questão quando usada como gêmea: 1 aplicação direta, 2 transferência contextual, 3 integração. */
  twinLevel?: 1 | 2 | 3;
  /** Outras habilidades combinadas (questões de integração). */
  integrates?: string[];
}

export interface Skill { id: string; name: string; subject: Subject; area: Area; lessonId?: string; subtopic?: string; competency?: string; prerequisites?: string[]; examWeight?: 'alta' | 'media' | 'baixa' }

/** Taxonomia de causas de erro da Metodologia NEXO (hipóteses revisáveis). */
export type ErrorCause = 'conceitual' | 'interpretacao' | 'calculo' | 'formula' | 'unidade' | 'atencao' | 'esquecimento' | 'confusao_alternativas' | 'lacuna_prerequisito' | 'indeterminada';
/** Intervenções A–G da Metodologia NEXO. */
export type InterventionCode = 'nenhuma' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface Attempt {
  id: string;
  qid: string;
  skillId: string;
  subject: Subject;
  chosen: string;            // letra ou valor
  correct: boolean;
  confidence: Confidence;
  errorType?: ErrorType;
  justification?: string;
  hintsUsed: number;
  ts: number;
  mode: 'tutoria' | 'pratica' | 'simulado' | 'diagnostico' | 'sessao' | 'gemea';
  isTwin?: boolean;
  isNovel?: boolean;          // questão inédita para o aluno (gêmea/gerada)
  timeSec?: number;
  /** Evidência pedagógica inferida da resposta (hipótese revisável). */
  evidence?: Evidence;
  /** Situação A–F atribuída pelo motor de intervenção (pode ser corrigida pelo aluno). */
  situation?: Situation;
  /** O aluno corrigiu a classificação sugerida. */
  reclassified?: boolean;
  /** Revisão livre: não altera a programação adaptativa. */
  free?: boolean;
  /** Ciclo de domínio a que a tentativa pertence. */
  cycleId?: string;
  /** Causa diagnosticada (hipótese) e intervenção aplicada. */
  cause?: ErrorCause;
  intervention?: InterventionCode;
  /** Respostas dadas depois da primeira (durante a correção). */
  retries?: { chosen: string; correct: boolean; ts: number }[];
}

export type Evidence =
  | 'compreensao_demonstrada'
  | 'confianca_declarada'
  | 'acerto_duvida'
  | 'acerto_com_dicas'
  | 'acerto_eliminacao'
  | 'acerto_raciocinio_incorreto'
  | 'acerto_chute'
  | 'acerto_sem_confianca'
  | 'erro_conceitual'
  | 'erro_interpretativo'
  | 'erro_procedimental'
  | 'erro_desatencao'
  | 'nao_resolveu';

/** A: acerto confiante · B: acerto com dúvida · C: interpretação · D: conceitual · E: procedimental · F: desatenção · AMB: ambíguo (perguntar). */
export type Situation = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'AMB';

export type CycleStage = 'diagnostico' | 'investigacao' | 'ensino' | 'comprovacao' | 'consolidacao' | 'concluido';
export interface MasteryCycle {
  id: string; skillId: string; originQid: string; situation: Situation; stage: CycleStage;
  status: 'ativo' | 'adiado' | 'concluido' | 'interrompido';
  createdAt: number; updatedAt: number;
  twinLevel: 1 | 2 | 3; twinAttempts: { qid: string; correct: boolean; level: number; ts: number }[];
  history: { ts: number; stage: CycleStage; note: string }[];
}

export interface SkillReview { due: number; interval: number; ease: number; last?: number; lapses: number }

export interface InterventionLogEntry {
  ts: number; qid: string; skillId: string; situation: Situation; hypothesis: string; confidence: number;
  intervention: string; cause?: ErrorCause; code?: InterventionCode; outcome?: 'compreendeu' | 'interrompeu' | 'adiou' | 'revelou_resposta' | 'reclassificou' | 'gemea_acerto' | 'gemea_erro';
  engine: string;
}

export type MasteryState = 'nao_estudado' | 'desenvolvimento' | 'provisorio' | 'consistente';

export interface Flashcard { id: string; subject: Subject; topic: string; skillId: string; front: string; back: string; origin: 'curado' | 'questao' | 'ia_demo' }
export interface CardState { box: number; due: number; last?: number; reviews: { ts: number; rating: CardRating; free?: boolean }[]; ease?: number; interval?: number; lapses?: number }
export type CardRating = 'errei' | 'duvida' | 'seguro';

export interface Profile {
  nickname: string;
  grade: string;
  schoolType: 'federal' | 'publica' | 'particular' | 'outra';
  schoolId?: string;
  institution?: string;
  goal: 'ENEM' | 'Vestibular' | 'Olimpíadas' | 'Combinada';
  course: string;
  difficulties: Subject[];
  weeklyHours: number;
  examYear: number;
  personalGoal: string;
  persona?: 'iniciante' | 'avancado' | 'olimpico' | 'custom';
}

export interface EssayEval {
  competencies: { id: 'C1' | 'C2' | 'C3' | 'C4' | 'C5'; name: string; score: number; summary: string; points: string[]; justification?: string; evidence?: string[]; problems?: string[]; suggestions?: string[]; exercise?: string }[];
  total: number;
  highlights: { start: number; end: number; comp: string; severity: 'erro' | 'atencao' | 'positivo'; message: string }[];
  aspects: { label: string; status: 'ok' | 'parcial' | 'ausente'; note: string }[];
  intervention: { agente: boolean; acao: boolean; meio: boolean; finalidade: boolean; detalhamento: boolean };
  stats: { words: number; paragraphs: number; sentences: number; avgSentence: number; connectives: string[] };
  engine: string;
}
export interface EssayVersion { text: string; title?: string; ts: number; eval?: EssayEval }
export interface Essay { id: string; themeId: string; versions: EssayVersion[]; draft?: string }

export interface XPEvent { ts: number; amount: number; reason: string; key: string }

export interface GeneratedQuestion { q: Question; validation: { check: string; ok: boolean; detail: string }[]; status: 'aprovada' | 'revisao' | 'rejeitada'; request: string; ts: number }
