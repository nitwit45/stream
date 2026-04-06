#!/usr/bin/env bash
# Full DB sync: crawl TMDB for new titles + refresh TV seasons/episodes.
#
# Safe to run repeatedly. Upserts are scoped by (tmdbId, type) and the DB has
# a unique index on that pair, so duplicates cannot be created even under
# concurrent runs.
#
# Does NOT delete anything. For pruning, run: npm run cleanup
#
# Usage: ./scripts/sync-all.sh    (or: npm run sync-all)

set -euo pipefail

cd "$(dirname "$0")/.."

GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
log()  { echo "${GREEN}[sync-all]${RESET} $*"; }
warn() { echo "${YELLOW}[sync-all]${RESET} $*"; }
err()  { echo "${RED}[sync-all]${RESET} $*" >&2; }

START_TS=$(date +%s)

# Sanity: Mongo reachable?
if ! docker exec freeflix-mongo mongosh --quiet -u app -p changeme_app freeflix \
     --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q '^1$'; then
  err "Mongo is not reachable. Start it first: ./start.sh (or docker-compose up -d)"
  exit 1
fi

COUNT_BEFORE=$(docker exec freeflix-mongo mongosh --quiet -u app -p changeme_app freeflix \
  --eval 'db.content.countDocuments()' 2>/dev/null | tail -1)
log "Starting sync. Current doc count: ${COUNT_BEFORE}"

# Step 1: crawl TMDB discover for movies + tv, check availability, upsert.
log "Step 1/2: fetching all content (npm run fetch-all)…"
npm run fetch-all

# Step 2: refresh seasons/episodes for every TV show in DB.
log "Step 2/2: refreshing TV seasons/episodes (npm run update-tv)…"
npm run update-tv

COUNT_AFTER=$(docker exec freeflix-mongo mongosh --quiet -u app -p changeme_app freeflix \
  --eval 'db.content.countDocuments()' 2>/dev/null | tail -1)
DELTA=$((COUNT_AFTER - COUNT_BEFORE))
ELAPSED=$(( $(date +%s) - START_TS ))

log "Sync complete in ${ELAPSED}s."
log "Docs: ${COUNT_BEFORE} → ${COUNT_AFTER} (Δ ${DELTA})"
log "${DIM}Nothing was deleted. To prune stale entries, run: npm run cleanup${RESET}"
