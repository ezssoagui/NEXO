/**
 * Incidência dos assuntos no ENEM: participação (%) do assunto DENTRO da disciplina, aplicações regulares de 2016 a 2025.
 * Fonte: análise de provas "Dossiê ENEM 2025" (Aprova Total). Várias habilidades do NEXO são recortes menores que o assunto
 * medido, portanto o número é uma aproximação do peso do assunto, não da habilidade isolada.
 */
export type Tier = 'alta' | 'media' | 'baixa';
export interface Incidence { topic: string; share: number; top: number } // top = maior participação da disciplina
const I = (topic: string, share: number, top: number): Incidence => ({ topic, share, top });
export const INCIDENCE: Record<string, Incidence> = {
  'mat-proporcao': I('Matemática básica', 37.3, 37.3), 'mat-porcentagem': I('Matemática básica', 37.3, 37.3),
  'mat-estatistica': I('Estatística', 11.2, 37.3), 'mat-geometria': I('Geometria espacial', 11.2, 37.3),
  'mat-funcoes': I('Funções', 10.2, 37.3), 'mat-probabilidade': I('Probabilidade', 5.2, 37.3),
  'fis-potencia': I('Eletrodinâmica', 21.1, 21.1), 'fis-ondas': I('Ondulatória', 13.7, 21.1),
  'fis-cinematica': I('Cinemática', 11.4, 21.1), 'fis-energia': I('Trabalho e energia', 4.6, 21.1),
  'qui-estequiometria': I('Estequiometria', 7.9, 8.6), 'qui-concentracao': I('Soluções', 5.3, 8.6),
  'qui-ph': I('Funções inorgânicas', 6.6, 8.6), 'qui-equilibrio': I('Equilíbrio químico', 4.6, 8.6),
  'bio-ecologia': I('Ecologia', 26, 26), 'bio-hormonios': I('Fisiologia humana', 7.7, 26), 'bio-genetica': I('Genética', 3.6, 26),
  'lin-interpretacao': I('Introdução à língua portuguesa (interpretação)', 22.1, 44.1), 'lin-funcoes': I('Funções da linguagem', 5.9, 44.1),
  'hum-historia': I('Estado Novo e populismo', 10.3, 11.8), 'hum-geografia': I('Espaço urbano', 11.8, 12.4), 'hum-filosofia': I('Filosofia política', 6.3, 28.1),
};

/** Alta: ≥ 10% da disciplina ou próximo do assunto líder (disciplinas pulverizadas, como Química). Sem dado: baixa. */
export function tierOf(skillId: string): Tier {
  const x = INCIDENCE[skillId]; if (!x) return 'baixa';
  const ratio = x.share / x.top;
  return x.share >= 10 || ratio >= 0.75 ? 'alta' : x.share < 5 && ratio < 0.35 ? 'baixa' : 'media';
}
