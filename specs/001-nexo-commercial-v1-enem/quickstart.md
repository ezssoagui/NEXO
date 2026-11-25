# Quickstart & End-to-End Validation Guide: NEXO V1 Comercial

**Feature**: `001-nexo-commercial-v1-enem`  
**References**: [spec.md](./spec.md) · [data-model.md](./data-model.md) · [contracts/api.md](./contracts/api.md)

Este guia descreve os cenários executáveis para validar o funcionamento ponta a ponta da plataforma comercial NEXO V1 em ambiente local.

---

## 1. Pré-requisitos e Configuração Local

1. **Runtime**: Node.js 22+ (`node:sqlite` nativo habilitado).
2. **Variáveis de ambiente** (`.env` baseado em `.env.example`):
   - `NEXO_AI_PROVIDERS=anthropic,gemini,openai` (ordem de prioridade/fallback)
   - Ao menos uma chave de IA para chamadas reais (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`) — testes automatizados usam provedores mockados determinísticos.
   - `NEXO_PAYMENT_GATEWAY=local` (habilita `LocalPaymentGateway` para simular Cartão/Pix, CDC e falhas).
   - `NEXO_ADMIN_CODE=<codigo-admin>` para criar conta operacional `admin`.
3. **Instalação e testes base**:
   ```bash
   npm install
   npm test
   npm run build
   ```

---

## 2. Ingestão do Acervo Oficial ENEM (Onda 1)

1. Execute a CLI offline de ingestão (usando fixture/dump local em dev ou coleta completa):
   ```bash
   npm run ingest:enem -- --years 2023-2024 --assets-dir server/data/assets
   ```
2. **Resultado esperado**:
   - Banco SQLite populado com `enem_skills` (120 habilidades oficiais `LC/CH/CN/MT` × `H01–H30`) e `enem_questions` contendo textos, alternativas, gabaritos, `skill_id`, parâmetros TRI (`tri_a/b/c`) e imagens espelhadas em `server/data/assets/`.
   - Reexecutar o comando é **idempotente** (não duplica registros nem imagens).

---

## 3. Execução Local (Back-end + Front-end)

```bash
# Terminal 1 — Servidor API + SQLite + Multi-LLM
npm run server

# Terminal 2 — Front-end SPA (Vite com proxy /api -> :8787)
npm run dev
```

---

## 4. Cenários de Validação Ponta a Ponta por Onda

### Cenário A — Ciclo Comercial 100% Pago & LGPD (Onda 1)
1. Cadastre um estudante com e-mail, senha, apelido e `isMinor: true` (sem CPF).
2. Confirme que rotas pedagógicas ficam bloqueadas (`402`) sem plano gratuito nem trial.
3. Simule checkout **NEXO Anual via Pix** com pagador responsável (`isGuardian: true`) e dispare confirmação duplicada no `LocalPaymentGateway`.
4. **Valide**: assinatura `active`, zero duplicação de créditos, perfil pedagógico sem CPF, cotas mensais creditadas.
5. Teste cancelamento em ≤ 7 dias (CDC → `refunded` + bloqueio imediato), cancelamento > 7 dias (`canceled_until_end`), falha de renovação (`grace_period` de 3 dias → `suspended` preservando histórico) e exportação/exclusão LGPD sempre acessíveis.

### Cenário B — IA Multi-LLM, Cotas, Redação C1–C5 e Comprovação Oficial (Onda 2)
1. Envie uma redação digitada (≤ 30 linhas) e confirme: consumo de exatamente 1 crédito, retorno C1–C5 + destaques + 5 elementos da C5 + aviso formativo explícito.
2. Envie uma reescrita e confirme novo consumo de 1 crédito + comparação entre versões.
3. Simule falha no provedor primário de IA e confirme acionamento transparente do provedor secundário.
4. Simule falha em **todos** os provedores de IA e confirme: resposta `503`, rascunho preservado, **0 crédito debitado** e **nenhuma resposta heurística simulada**.
5. Zere a cota de redação e confirme: bloqueio apenas da correção por IA (com oferta de pacote avulso), mantendo Banco ENEM, Flashcards e Simulados 100% utilizáveis.
6. Erre uma questão oficial de `MT-H19`, passe pela intervenção da IA Tutora em tempo real e confirme que a comprovação entrega **outra questão oficial inédita de `MT-H19`** com TRI compatível (sem gastar cota de geração).

### Cenário C — Evolução, Flashcards SRS e Simulados TRI (Onda 3)
1. Conclua o onboarding + diagnóstico inicial e valide geração da trilha semanal adaptativa.
2. Confirme que um erro em questão cria flashcard automático e que o aluno consegue criar/editar um flashcard manual privado e revisar com SRS (`Errei`/`Com dúvida`/`Com segurança`).
3. Finalize um simulado cronometrado e confirme exclusão de questões anuladas, estimativa formativa estilo TRI (rotulada como estimativa) e plano de recuperação gerado.

### Cenário D — Gamificação Individual e Painel Admin (Onda 4)
1. Confirme atualização de streak, meta semanal e bloqueio anti-abuso de XP em repetição imediata da mesma questão.
2. Confirme ausência total de rotas fora do V1 (Arena, Microaulas, Feynman, Portfólio, Vestibulares/Olimpíadas).
3. Acesse `/admin` com conta `admin` (e valide `403` para `student`), conferindo assinaturas por estado, custo/margem de IA, taxa de fallback, métricas pseudonimizadas e ajuste manual de crédito registrado em auditoria.
