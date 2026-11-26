# Regras de negócio
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

- **Franquias (11.4/11.5/6.10/7.9):** Gratuito 20 questões, 2 sessões e 20 flashcards por dia; 1 explicação ativa/dia; 1 redação, 3 reescritas, 5 discursivos e 1 simulado por mês. Plus: 5/dia, 6/20/30 por mês, demais ilimitados. Pro: 15/dia, 12/60/90 por mês. Valores em `plan_limits`, editáveis e auditados. Mesma qualidade de correção em todos os planos.
- **Contagem (ADR-010, proposta):** questão distinta servida por dia fora de sessões/simulados; sessão no início; simulado no início; diagnóstico não conta.
- **Falha não consome (A.3.6):** reserva → confirmação somente com resultado válido → liberação em qualquer falha.
- **Preços (11.10):** não definidos; checkout bloqueado até `price_status = approved` registrado pelos sócios.
- **Assinatura (13.7):** upgrade imediato (nova assinatura substitui a anterior ao confirmar pagamento); downgrade no fim do período; cancelamento interrompe renovação e mantém acesso até o fim; arrependimento em 7 dias com reembolso; tolerância de 3 dias em pagamento recusado; retorno ao Gratuito preservando histórico; franquias não acumulam.
- **Acessos temporários (12.4):** `access_grants` por admin ou cupom `access_grant`; melhor plano entre assinatura e acesso.
- **XP (9.2/9.7):** questão 5, flashcard 2, microaula 10, aula 20, explicação 10, discursivo 10, reescrita 10, redação 30; uma vez por item/dia (questões e cartões), uma vez por aula/redação; sem bônus de desempenho.
- **Ranking (9.6):** opt-in com apelido; menores somente com consentimento do responsável.
- **Exclusão de conta (13.6):** exige renovação cancelada; dados pessoais/pedagógicos removidos; pagamentos retidos sem vínculo pessoal.
