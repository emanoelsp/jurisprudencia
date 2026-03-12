#!/usr/bin/env bash
# Roda ingestões iniciais no Pinecone (CF/CP, opcional STJ).
# Uso: ./scripts/run-ingestoes.sh   ou   BASE_URL=http://localhost:3000 ./scripts/run-ingestoes.sh
# Requer: app rodando (npm run dev). Para DataJud, use os curls do README com token Firebase.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Lê CRON_SECRET do .env.local (apenas esta linha, sem source do arquivo inteiro)
if [ -z "$CRON_SECRET" ] && [ -f "$ROOT/.env.local" ]; then
  CRON_SECRET=$(grep '^CRON_SECRET=' "$ROOT/.env.local" | cut -d= -f2- | tr -d '\r\n"' | head -1)
fi

echo "=== 1) Seed CF/88 + Código Penal (namespace legislacao) ==="
curl -s -X POST "$BASE_URL/api/setup/seed-legislacao" | head -20
echo ""

if [ -n "$CRON_SECRET" ]; then
  echo "=== 2) STJ Dados Abertos (CKAN) ==="
  curl -s -X POST "$BASE_URL/api/admin/stj-ckan-ingest" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": false, "maxDocs": 40, "maxResources": 2}' | head -30
  echo ""
else
  echo "=== 2) STJ Dados Abertos: omitido (defina CRON_SECRET no .env.local para rodar). ==="
fi

echo "=== 3) DataJud (CNJ) ==="
echo "DataJud exige token Firebase. No navegador (logado no app), abra o Console e execute:"
echo "  firebase.auth().currentUser.getIdToken().then(t => console.log(t))"
echo "Depois:"
echo "  curl -X POST $BASE_URL/api/admin/datajud-ingest \\"
echo "    -H \"Authorization: Bearer <token>\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"tribunalSigla\":\"TJSP\",\"size\":30}'"
echo ""
echo "Resumo: LexML não é ingestão (busca em tempo real). Ingestões são: CF+CP (acima), DataJud (token), STJ CKAN (CRON_SECRET)."
