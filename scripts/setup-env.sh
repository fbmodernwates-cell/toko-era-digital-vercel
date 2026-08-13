#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ENV_FILE="$HOME/.toko_env"
read -rp "VERCEL_TOKEN: " VERCEL_TOKEN
read -rp "SUPABASE_TOKEN: " SUPABASE_TOKEN
if [ -z "$VERCEL_TOKEN" ] || [ -z "$SUPABASE_TOKEN" ]; then
  echo "Token tidak boleh kosong"; exit 1
fi
cat > "$ENV_FILE" <<INNER
export VERCEL_TOKEN="$VERCEL_TOKEN"
export SUPABASE_TOKEN="$SUPABASE_TOKEN"
INNER
chmod 600 "$ENV_FILE"
echo "Selesai. Jalankan: source $ENV_FILE"
