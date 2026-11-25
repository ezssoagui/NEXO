# ADR-0002: Gateway de Pagamento Desacoplado com Simulador Local no V1

- **Status**: Aceita
- **Data**: 2026-11-23
- **Escopo**: V1 Comercial (`001-nexo-commercial-v1-enem`)

## Contexto

A regra de negócio do NEXO V1 é 100% paga (NEXO Mensal e NEXO Anual, Cartão de Crédito recorrente/parcelado e Pix, pacotes avulsos de créditos de IA, direito de arrependimento CDC em 7 dias, janela de tolerância de 3 dias na inadimplência e separação LGPD entre Pagador e Estudante). No entanto, nesta fase de protótipo funcional local, integrar diretamente com um gateway financeiro real (Asaas, Pagar.me, Mercado Pago ou Stripe) exigiria conta PJ, homologação e credenciais externas.

## Decisão

1. Implementar toda a máquina de estados da assinatura, regras de CDC (7 dias), tolerância (3 dias), separação Pagador × Estudante e processamento **idempotente** de eventos financeiros (`payment_events`) no núcleo do backend.
2. Encapsular toda comunicação com provedores de cobrança atrás de uma interface de domínio `PaymentGateway` (`server/gateways/payment.ts`).
3. Fornecer no V1 a implementação `LocalPaymentGateway`, acompanhada de endpoints restritos ao ambiente de desenvolvimento (`/api/billing/dev/simulate`) para simular confirmação de pagamento Cartão/Pix, pagamento duplicado, evento fora de ordem, falha de renovação, expiração de tolerância e compra de pacote avulso.

## Alternativas Consideradas

- **Integrar Asaas ou Stripe imediatamente**: bloquearia o avanço técnico local em burocracia comercial e dificultaria testes determinísticos de casos de borda.
- **Omitir o fluxo de assinatura no V1**: impediria validar o gate `402`, a separação LGPD Pagador × Estudante e o ciclo de renovação mensal de cotas de IA.

## Consequências

- **Positivas**: 100% das regras comerciais e casos de borda ficam implementadas e cobertas por testes automatizados desde o V1; a troca para Asaas, Pagar.me, Mercado Pago ou Stripe no lançamento será apenas um novo adaptador implementando `PaymentGateway` + validação de assinatura do webhook real.
- **Negativas / Trade-offs**: exige garantir por configuração (`NODE_ENV` / `NEXO_PAYMENT_GATEWAY`) que o simulador local jamais seja habilitado em ambiente de produção.
