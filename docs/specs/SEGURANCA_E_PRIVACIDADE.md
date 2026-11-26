# Segurança e privacidade
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

- **Coleta mínima (13.1):** nome de exibição, e-mail, ano do ENEM, data de nascimento; opcionais curso/universidade/instituição; CPF apenas repassado ao Asaas no checkout (não armazenado).
- **Menores (13.2):** consentimento do responsável (token com hash, 14 dias), ranking bloqueado sem consentimento, sem anúncios/venda de dados. Pendente: envio de e-mail e validação jurídica do mecanismo de idade.
- **Autenticação (13.3):** Supabase Auth (prod), MFA obrigatório para admin (aal2), sessões assinadas httpOnly, verificação de origem, rate limits em login/cadastro/IA/etc.
- **Autorização:** níveis `public/user/student/admin` em cada rota; RLS em todas as tabelas; conteúdo sem GRANT ao cliente.
- **Logs:** sem PII/segredos (somente tipo e mensagem curta de erro); auditoria administrativa em `audit_logs`.
- **Cabeçalhos:** HSTS, nosniff, DENY frame, Referrer-Policy, Permissions-Policy (câmera/microfone/geolocalização desativados).
- **Backups (13.5):** `scripts/backup/backup.sh` (pg_dump + GPG AES-256 + rclone, retenção 30 dias, a cada 3 dias) e `restore-test.sh` mensal; alerta se > 72 h sem backup.
- **Direitos (13.6):** exportação JSON (sob RLS), solicitações de correção/acesso, exclusão com confirmação de senha.
- **Documentos (13.10):** `legal_documents` versionados com aceite; textos atuais são RASCUNHOS de desenvolvimento — revisão jurídica obrigatória antes do piloto.
