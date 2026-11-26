# Motor adaptativo
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

## Fluxo (15.5)
evento válido → evidências → recálculo do domínio da habilidade (`recomputeSkill`) → agenda de revisão → (sob demanda) fila de recomendações → composição de sessão antes do início.

## Prioridade
`P = w·[dificuldade, relevância, revisão, cobertura, conexões]` com pesos 0,30/0,25/0,20/0,15/0,10, normalizados; proximidade da prova aumenta o peso de revisão e renormaliza; ajuste de reta final por área (ADR-012). Ausência → prior 0,5 (não zero).

## Categoria e foco
`learn/exploration`, `improve/{recovery,fundamentals,comprehension,practice}`, `deepen/{transfer,maintenance}`, `review/retention` — árvore de decisão em `priority.ts`.

## Composição (4.5)
Quantidade = matriz experimental (dificuldade individual × relevância), máx. 15; comprehension ≤ 3. Teoria omitida quando C ≥ 70. Revisão: recuperação ativa antes de teoria. Transferência: somente itens inéditos; falta → gêmeas aprovadas → solicitação à fila (sem geração indiscriminada).

## Auditoria (8.10)
Fatores, pesos, nível e `rule_version` gravados em cada recomendação; parâmetros versionados em `engine_parameter_sets`; reprocessável a partir de `learning_events`/`skill_evidence`.
