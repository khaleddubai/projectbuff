#!/bin/sh
# =============================================================================
# AEGIS — Docker Entrypoint
# Validates environment and starts the production server
# =============================================================================

set -e

echo ""
echo "  █████╗ ███████╗ ██████╗ ██╗███████╗"
echo " ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝"
echo " ███████║█████╗  ██║  ███╗██║███████╗"
echo " ██╔══██║██╔══╝  ██║   ██║██║╚════██║"
echo " ██║  ██║███████╗╚██████╔╝██║███████║"
echo " ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝"
echo "  v1.0.0 — Production Server"
echo ""

# Validate critical env vars
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "[WARN] OPENROUTER_API_KEY is not set. AI features will not work."
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "[WARN] ENCRYPTION_KEY is not set. Using default key — change in production!"
fi

if [ -z "$MASTER_API_KEY" ]; then
  echo "[WARN] MASTER_API_KEY is not set. API authentication is disabled."
fi

# Ensure data directory exists
mkdir -p /data /app/output

echo "[INFO] Starting AEGIS API..."
echo "[INFO] Mode: production"
echo "[INFO] Port: ${PORT:-3001}"
echo ""

exec node dist/index.js
