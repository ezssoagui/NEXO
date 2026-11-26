# Manual pedagógico
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

## Ciclo de evidências (2.9, 2.14, 8.1)
Cada atividade gera um evento original (`learning_events`) e evidências por habilidade/dimensão (`skill_evidence`). Dimensões: Resolução (R), Compreensão (C), Transferência (T), Retenção (M). D = 0,50R + 0,25C + 0,15T + 0,10M; R pondera fácil/média/difícil em 50/35/15. Ausência não vale zero (ADR-007).

## Estados (8.6)
Não avaliado → Em aprendizagem → Provisório (mínimos de evidência e D ≥ 70) → Consolidado (D ≥ 85 + retenção + compreensão/transferência). Estados podem regredir com novas evidências; nunca por inatividade.

## Correção por modalidade (2.4)
Questão avulsa: após confirmar. Lista: ao final. Simulado/diagnóstico: após encerrar. Nenhuma pista ou IA durante a resolução (7.7).

## CPE (2.6) e classificação de erros (2.7)
CPE só em erro de questão média/difícil de Linguagens/Humanas: Comando, Prova, Eliminação, com referência exibida apenas após cada etapa; gera compreensão *assistida*. Em Matemática/Natureza, classificação opcional (lacuna, conceitual, interpretação, aplicação, procedimento, atenção, não sei).

## Caderno de erros (5.7)
Automático; superação exige ≥ 2 acertos inéditos na mesma habilidade após o erro; acertar a mesma questão só leva a "em recuperação".

## Revisões (2.10, 5.10)
FSRS para cartões (Errei/Difícil/Bom/Fácil). Agenda curricular independente por habilidade (escada 1-3-7-14-30-60-120 dias ajustada por relevância e proximidade da prova); qualquer evidência válida após o vencimento satisfaz a revisão.

## Equivalentes e gêmeas (2.12, 5.5)
Oficial inédita equivalente → gêmea aprovada → solicitação de geração com validação independente. Gêmeas nunca entram no banco oficial e são identificadas como autorais.

## Casos de teste pedagógicos (15.12)
Implementados em `tests/unit/adaptive-engine.test.ts`: nunca estudado → exploração; erro em fácil → fundamentos; acerto com explicação incorreta → compreensão; teoria sem aplicação → transferência; perda de retenção → revisão; domínio alto → manutenção; ausência → retomada normal; padrão 5/10 erros → recuperação.
