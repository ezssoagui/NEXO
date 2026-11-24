/**
 * Incidência dos assuntos no ENEM: participação (%) do assunto DENTRO da disciplina, aplicações regulares de 2016 a 2025.
 * Fonte: análise de provas "Dossiê ENEM 2025" (Aprova Total) — levantamento de terceiros, NÃO é dado oficial do Inep.
 * Várias habilidades do NEXO são recortes menores que o assunto medido: o número aproxima o peso do assunto, não da habilidade.
 * Habilidades ausentes daqui não têm incidência informada (a interface diz isso; nada é estimado).
 */
export type Tier = 'alta' | 'media' | 'baixa';
export interface Incidence { topic: string; share: number; top: number } // top = maior participação da disciplina
export const INCIDENCE_SOURCE = 'Dossiê ENEM 2025 (Aprova Total), 2016–2025. Não é dado oficial do Inep.';
const I = (topic: string, share: number, top: number): Incidence => ({ topic, share, top });
export const INCIDENCE: Record<string, Incidence> = {
  'mat-proporcao': I('Matemática básica', 37.3, 37.3), 'mat-porcentagem': I('Matemática básica', 37.3, 37.3),
  'mat-estatistica': I('Estatística', 11.2, 37.3), 'mat-geometria': I('Geometria espacial', 11.2, 37.3), 'mat-areas': I('Geometria plana', 7.7, 37.3),
  'mat-funcoes': I('Funções', 10.2, 37.3), 'mat-quadratica': I('Funções', 10.2, 37.3), 'mat-probabilidade': I('Probabilidade', 5.2, 37.3),
  'fis-potencia': I('Eletrodinâmica', 21.1, 21.1), 'fis-energia-eletrica': I('Eletrodinâmica', 21.1, 21.1), 'fis-ondas': I('Ondulatória', 13.7, 21.1),
  'fis-cinematica': I('Cinemática', 11.4, 21.1), 'fis-dinamica': I('Dinâmica', 6.3, 21.1), 'fis-centripeta': I('Dinâmica', 6.3, 21.1), 'fis-energia': I('Trabalho e energia', 4.6, 21.1),
  'fis-campo-magnetico': I('Magnetismo', 5.1, 21.1), 'fis-forca-magnetica': I('Magnetismo', 5.1, 21.1), 'fis-inducao': I('Magnetismo', 5.1, 21.1),
  'qui-estequiometria': I('Estequiometria', 7.9, 8.6), 'qui-separacao': I('Separação de mistura', 6.6, 8.6), 'qui-eletroquimica': I('Eletroquímica', 6.6, 8.6), 'qui-concentracao': I('Soluções', 5.3, 8.6),
  'qui-ph': I('Equilíbrio químico', 4.6, 8.6), 'qui-equilibrio': I('Equilíbrio químico', 4.6, 8.6),
  'bio-ecologia': I('Ecologia', 26, 26), 'bio-hormonios': I('Fisiologia humana', 7.7, 26), 'bio-osmorregulacao': I('Fisiologia humana', 7.7, 26), 'bio-citologia': I('Citologia', 5.3, 26), 'bio-genetica': I('Genética', 3.6, 26),
  'lin-interpretacao': I('Introdução à língua portuguesa (interpretação)', 22.1, 44.1), 'lin-generos': I('Gêneros textuais', 44.1, 44.1), 'lin-variacao': I('Linguagem culta × coloquial', 10.7, 44.1), 'lin-funcoes': I('Funções da linguagem', 5.9, 44.1),
  'lit-leitura': I('Literatura contemporânea', 30.8, 30.8),
  'hum-historia': I('Estado Novo e populismo', 10.3, 11.8), 'his-colonia': I('Brasil: Colônia', 11.8, 11.8), 'hum-geografia': I('Espaço urbano', 11.8, 12.4), 'geo-agrario': I('Espaço agrário', 12.4, 12.4),
  'hum-filosofia': I('Filosofia política', 6.3, 28.1), 'fil-antiga': I('Filosofia antiga', 28.1, 28.1), 'soc-cultura': I('Cultura e sociedade', 19, 19), 'soc-movimentos': I('Movimentos sociais', 18.1, 19),
};

/** Faixas EXPERIMENTAIS. Alta: ≥ 10% da disciplina ou próximo do assunto líder (disciplinas pulverizadas). Sem dado: média. */
export function tierOf(skillId: string): Tier {
  const x = INCIDENCE[skillId]; if (!x) return 'media';
  const ratio = x.share / x.top;
  return x.share >= 10 || ratio >= 0.75 ? 'alta' : x.share < 5 && ratio < 0.35 ? 'baixa' : 'media';
}
