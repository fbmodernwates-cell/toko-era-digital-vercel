#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ENV_FILE="$HOME/.toko_env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
exec node "$(which vercel)" "$@"
