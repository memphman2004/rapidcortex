#!/usr/bin/env bash
# Commit and push local Rapid Cortex changes on a schedule (LaunchAgent / cron).
# Safe defaults: skip if clean tree; never force-push; respect .gitignore.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/Volumes/Mac Mini/Coding Projects/Hibernation/WebApp/Rapid Cortex}"
LOG_DIR="${HOME}/Library/Logs/rapid-cortex"
LOG_FILE="${LOG_DIR}/daily-github-update.log"
LOCK_DIR="${TMPDIR:-/tmp}/rapid-cortex-daily-github-update.lock"

mkdir -p "${LOG_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "SKIP another daily-github-update is already running"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
cd "${REPO_ROOT}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "ERROR not a git repo: ${REPO_ROOT}"
  exit 1
fi

BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "${BRANCH}" ]]; then
  log "ERROR detached HEAD — refusing to auto-commit"
  exit 1
fi

# Refresh index; do not fail the job if remote is briefly unreachable later.
git status --porcelain >/dev/null

if [[ -z "$(git status --porcelain)" ]]; then
  log "SKIP clean working tree on ${BRANCH}"
  exit 0
fi

STAMP="$(date '+%Y-%m-%d %H:%M')"
MSG="Daily update ${STAMP}"

log "START branch=${BRANCH} committing: ${MSG}"

# Stage everything tracked/untracked that gitignore allows.
git add -A

# Extra belt-and-suspenders: never stage obvious secrets if they slipped past ignore.
git reset --quiet -- \
  '**/.env' \
  '**/.env.*' \
  '**/google-play-key.json' \
  '**/*credentials*.json' \
  '**/Secrets.plist' \
  2>/dev/null || true

if [[ -z "$(git diff --cached --name-only)" ]]; then
  log "SKIP nothing left staged after secret filters"
  exit 0
fi

git commit -m "${MSG}"
log "COMMITTED $(git rev-parse --short HEAD)"

if git push -u origin "HEAD:${BRANCH}"; then
  log "PUSHED origin/${BRANCH}"
else
  log "ERROR push failed — commit remains local"
  exit 1
fi

log "DONE"
