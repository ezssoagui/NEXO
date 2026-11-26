#!/usr/bin/env bash
# Teste mensal de restauração (13.5): baixa o backup mais recente, decifra, restaura em um banco
# DESCARTÁVEL (RESTORE_DATABASE_URL — nunca produção) e verifica tabelas essenciais.
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL ausente (banco temporário)}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE ausente}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE ausente}"

WORKDIR="$(mktemp -d)"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATUS="failed"
cleanup() {
  if [ -n "${NEXO_APP_URL:-}" ] && [ -n "${CRON_SECRET:-}" ]; then
    curl -sS -X POST "${NEXO_APP_URL}/api/jobs/record-backup" -H "Authorization: Bearer ${CRON_SECRET}" -H "Content-Type: application/json" \
      --data "{\"kind\":\"restore_test\",\"status\":\"${STATUS}\",\"startedAt\":\"${STARTED}\",\"finishedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"notes\":\"${LATEST:-}\"}" >/dev/null || true
  fi
  rm -rf -- "${WORKDIR:?}"
}
trap cleanup EXIT

LATEST="$(rclone lsf "${BACKUP_REMOTE}" --include 'nexo-*.dump.gpg' | sort | tail -n 1)"
[ -n "${LATEST}" ] || { echo "Nenhum backup encontrado"; exit 1; }
rclone copyto "${BACKUP_REMOTE}/${LATEST}" "${WORKDIR}/b.gpg"
gpg --batch --yes --pinentry-mode loopback --passphrase "${BACKUP_PASSPHRASE}" -d "${WORKDIR}/b.gpg" > "${WORKDIR}/b.dump"
pg_restore --clean --if-exists --no-owner --dbname="${RESTORE_DATABASE_URL}" "${WORKDIR}/b.dump"
for t in profiles attempts mastery_scores essays subscriptions; do
  psql "${RESTORE_DATABASE_URL}" -tAc "select count(*) from public.${t}" >/dev/null
done
STATUS="success"
echo "Restauração verificada a partir de ${LATEST}"
