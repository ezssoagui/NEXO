# Critérios de aceitação — checklist transversal

Checklist complementar ao Documento Mestre. Converter cada requisito das 15 etapas em testes e rastreabilidade; estes são casos críticos mínimos, não substituem a especificação integral.

## Fundação e segurança
- [ ] Setup reproduzível em máquina nova, README, lockfile, `.env.example` sem chaves; lint, typecheck, build e CI reais.
- [ ] Migrações repetíveis em DB local, seed exclusivamente de teste, constraints e RLS testados contra acesso de outro estudante, papel admin não concedido pelo cliente.
- [ ] Login, verificação, recuperação, Google quando configurado, MFA admin, rate limits, validação de payload, segredos no servidor, tratamento de erros sem PII.
- [ ] Exportação/correção/exclusão de dados; cancelamento não apaga histórico; backups criptografados independentes cada 3 dias/ret. 30 dias/restore mensal; procedimento de menores e conformidade validados antes de acesso real.

## Acervo e pedagogia
- [ ] Inventário oficial auditável, extração, imagens, gabarito, anulações, deduplicação, metadados e status autoral; nenhuma publicação sem validação; banco integral elegível no lançamento.
- [ ] Currículo comum completo, habilidades internas vs oficiais, incidência documentada, taxonomia versionada, sem inventar dados.
- [ ] Novo aluno sem histórico não tem domínio zero fictício; diagnóstico opcional; estudo livre produz evidência válida; duplicatas não inflam indicadores.
- [ ] D=50/25/15/10 e R=50/35/15; dados ausentes e mínimos documentados; estados testados; erro novo pode rebaixar, ausência isolada não; cobertura e acerto distintos; recipientes mostram consolidação curricular.
- [ ] Erro básico recomenda fundamentos; acerto com compreensão ruim recomenda explicação; teoria sem aplicação recomenda transferência; retenção comprometida recomenda revisão; aluno consolidado recebe manutenção/aprofundamento; ausência retoma normalmente.
- [ ] Sessão compõe quantidade conforme dificuldade/relevância, aceita atividade única, snapshot imutável após início, pausa/retomada, filtros e autonomia; IA não escolhe rota.
- [ ] Questão avulsa corrige após envio, bateria/prova ao final; sem pistas antes; CPE apenas condições aprovadas, M/N classificação opcional; caderno de erros recupera apenas com nova evidência válida.
- [ ] Gêmea: busca oficial → existente → geração → validação independente, recusa inválida, reutiliza; nunca entra no banco oficial. Simulados só oficiais; nenhuma TRI estimada.
- [ ] FSRS 4 avaliações, revisão curricular independente, estudo livre pode satisfazer revisão, leitura não comprova domínio; sem cronograma obrigatório.

## IA e redação
- [ ] Avaliação conceitual 0–3, sem ajuda antes de envio; contexto suficiente sem identificadores desnecessários.
- [ ] Redação cinco competências em incrementos de 40, total coerente, rubrica oficial/zero, citações verificáveis do texto, nota independente de histórico, RAG com fontes autorizadas. Benchmark separado e relatório de qualidade, sem alegação de nota oficial.
- [ ] Uma correção completa, gêmea tem duas chamadas; validação de schema, falhas/retentativas idempotentes; quota não cobrada por resultado inválido; orçamento e logs de tokens, sem dados sensíveis.
- [ ] Limites 1/5/15 explicações, 1/6/12 redações, 3/20/60 reescritas, 5/30/90 discursivos; Gratuito 20 questões, 2 sessões e 20 flashcards/dia, 1 simulado/mês; concorrência, períodos, limites e plano esgotado testados. Valores configuráveis; mesmas avaliações em todos os planos.

## Comercial, admin e UX
- [ ] Checkout Asaas sandbox, verificação de eventos, repetição/reordenação de webhook, transições, cancelamento/reembolso/inadimplência e histórico; preços não publicados sem aprovação. Sem cobrança real em teste.
- [ ] Admin com MFA, controles auditáveis de conteúdo, planos e usuários, custos IA e financeiro, alertas, feedback discreto; sem gestão escolar no MVP.
- [ ] Seis seções, tema persistido, desktop/mobile, busca global, mapa líquido hierárquico, sessões e indicadores reais; estados vazios/erro/carregamento; foco, semântica, contraste, zoom e teclado testados conforme exigências.
- [ ] XP por participação legítima e sem duplicata, streak não penaliza domínio, ranking opt-in protegido; sem funcionalidades expressamente rejeitadas no Anexo A.
- [ ] Fluxos E2E: cadastro → recomendação → questão/sessão → evidência → domínio; revisão/flashcard; redação/reescrita; simulado; plano e cancelamento; painel admin e direitos de conta.

## Go/no-go comercial
- [ ] Todo requisito obrigatório rastreado e testado, banco oficial elegível integral/currículo coberto, zero falha crítica conhecida.
- [ ] Custos e modelos medidos, preços e regras contratuais aprovados; segurança/restore, direitos autorais, legislação e proteção de menores revisados.
- [ ] Piloto voluntário antes/depois, questões distintas comparáveis, custos e feedback medidos, limitações relatadas; não atribuir causalidade sem desenho adequado.
- [ ] Aprovação dos dois sócios para publicação e cobrança. Um build verde sozinho não é autorização de lançamento.
