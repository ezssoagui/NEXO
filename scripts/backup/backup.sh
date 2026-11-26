#!/usr/bin/env bash
# Backup externo criptografado do banco (13.5): executar a cada 3 dias (cron/GitHub Actions agendado),
# retenção de 30 dias no destino, teste de restauração mensal (scripts/backup/restore-test.sh).
# Requisitos: pg_dump (cliente PostgreSQL 15+), gpg, rclone configurado para o bucket externo (ex.: R2).
# Variáveis: DATABASE_URL, BACKUP_PASSPHRASE, BACKUP_REMOTE (ex.: r2:nexo-backups), NEXO_APP_URL, CRON_SECRET.
# Os segredos vêm do ambiente/cofre — nunca do repositório.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL ausente}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE ausente}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE ausente}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
FILE="nexo-${STAMP}.dump.gpg"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATUS="failed"
NOTES=""

report() {
  if [ -n "${NEXO_APP_URL:-}" ] && [ -n "${CRON_SECRET:-}" ]; then
    curl -sS -X POST "${NEXO_APP_URL}/api/jobs/record-backup" \
      -H "Authorization: Bearer ${CRON_SECRET}" -H "Content-Type: application/json" \
      --data "{\"kind\":\"backup\",\"status\":\"${STATUS}\",\"startedAt\":\"${STARTED}\",\"finishedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"sizeBytes\":${SIZE:-0},\"sha256\":\"${SHA:-}\",\"locationHint\":\"${BACKUP_REMOTE}/${FILE}\",\"notes\":\"${NOTES}\"}" >/dev/null || true
  fi
  rm -rf -- "${WORKDIR:?}"
}
trap report EXIT

pg_dump --format=custom --no-owner --no-privileges --dbname="${DATABASE_URL}" \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "${BACKUP_PASSPHRASE}" --symmetric --cipher-algo AES256 -o "${WORKDIR}/${FILE}"

SIZE="$(wc -c < "${WORKDIR}/${FILE}" | tr -d ' ')"
SHA="$(sha256sum "${WORKDIR}/${FILE}" | cut -d' ' -f1)"
rclone copyto "${WORKDIR}/${FILE}" "${BACKUP_REMOTE}/${FILE}"
# Retenção de 30 dias no destino externo.
rclone delete "${BACKUP_REMOTE}" --min-age 30d --include "nexo-*.dump.gpg"
STATUS="success"
NOTES="pg_dump custom + gpg AES256"
echo "Backup concluído: ${FILE} (${SIZE} bytes)"
