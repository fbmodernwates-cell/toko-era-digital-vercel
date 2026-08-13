#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ENV_FILE="$HOME/.toko_env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
exec node "$HOME/.npm-global/lib/node_modules/@supabase/cli/dist/cli-darwin-arm64/cli" "$@"
