#!/usr/bin/env bash
# Ingest automatizado STJ Dados Abertos (CKAN) → Pinecone
# Uso:
#   1. Configure no .env.local: CRON_SECRET=uma-senha-forte
#   2. No app: STJ_CKAN_INGEST_SECRET igual ao CRON_SECRET (ou use CRON_SECRET)
#   3. Agende no cron (ex.: semanal): 0 3 * * 0 /caminho/para/scripts/stj-ckan-ingest-cron.sh
# Ou chame a API manualmente:
#   curl -X POST https://SEU_DOMINIO/api/admin/stj-ckan-ingest \
#     -H "Authorization: Bearer SEU_CRON_SECRET" \
#     -H "Content-Type: application/json" \
#     -d '{"dryRun": false, "maxDocs": 40, "maxResources": 2}'

set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"
SECRET="${CRON_SECRET:-}"
if [ -z "$SECRET" ]; then
  echo "Defina CRON_SECRET (ou STJ_CKAN_INGEST_SECRET) no ambiente."
  exit 1
fi

curl -s -X POST "$BASE_URL/api/admin/stj-ckan-ingest" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "maxDocs": 40, "maxResources": 2}'
