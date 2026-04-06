#!/usr/bin/env bash
# Boot everything needed for local FreeFlix dev:
#   1. Colima (Docker VM)
#   2. MongoDB container (freeflix-mongo)
#   3. Next.js dev server
#
# Usage: ./start.sh
# Ctrl-C stops the Next.js server. Mongo + Colima keep running in the
# background so restarts are instant. Use ./start.sh --stop to tear down.

set -euo pipefail

cd "$(dirname "$0")"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
log()  { echo "${GREEN}[start]${RESET} $*"; }
warn() { echo "${YELLOW}[start]${RESET} $*"; }
err()  { echo "${RED}[start]${RESET} $*" >&2; }

if [[ "${1:-}" == "--stop" ]]; then
  log "Stopping Mongo container…"
  docker-compose down || true
  log "Stopping Colima…"
  colima stop || true
  log "Done."
  exit 0
fi

# 1. Colima
if ! colima status >/dev/null 2>&1; then
  log "Starting Colima (Docker VM)…"
  colima start
else
  log "Colima already running ${DIM}(skip)${RESET}"
fi

# 2. Mongo
if ! docker ps --format '{{.Names}}' | grep -q '^freeflix-mongo$'; then
  log "Starting freeflix-mongo container…"
  docker-compose up -d
else
  log "freeflix-mongo already running ${DIM}(skip)${RESET}"
fi

# Wait for mongo to accept connections
log "Waiting for Mongo to be ready…"
for i in $(seq 1 30); do
  if docker exec freeflix-mongo mongosh --quiet \
       -u root -p changeme_local --authenticationDatabase admin \
       --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q '^1$'; then
    log "Mongo is ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    err "Mongo didn't come up in 30s. Check: docker logs freeflix-mongo"
    exit 1
  fi
  sleep 1
done

# 3. Next.js dev server (foreground — Ctrl-C ends the session)
log "Starting Next.js dev server (Ctrl-C to stop)…"
log "${DIM}Mongo and Colima will keep running. Tear down with: ./start.sh --stop${RESET}"
exec npm run dev
