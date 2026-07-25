#!/usr/bin/env bash
set -Eeuo pipefail

umask 027

APP_PATH="${APP_PATH:?APP_PATH is required}"
RELEASES_DIR="$APP_PATH/releases"
CURRENT_LINK="$APP_PATH/current"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/}"

log() {
  printf '[rollback] %s\n' "$*"
}

fail() {
  printf '[rollback] ERROR: %s\n' "$*" >&2
  exit 1
}

health_check() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

[[ "$APP_PATH" == /* && "$APP_PATH" != *".."* ]] || fail "APP_PATH must be a safe absolute path."
[[ -d "$RELEASES_DIR" ]] || fail "Releases directory is missing."
[[ -L "$CURRENT_LINK" ]] || fail "Current release symlink is missing."

for command_name in curl cut find ln mv pm2 readlink seq sort; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Required command is unavailable: $command_name"
done

current_real="$(readlink -f "$CURRENT_LINK")"
current_id="$(basename "$current_real")"
[[ "$current_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Current release has an unsafe identifier."
previous_release=""

while IFS= read -r candidate; do
  [[ -n "$candidate" && -d "$candidate" ]] || continue
  [[ "$(readlink -f "$candidate")" != "$current_real" ]] || continue
  [[ -f "$candidate/ecosystem.config.cjs" && -f "$candidate/.next/BUILD_ID" ]] || continue
  [[ -d "$candidate/node_modules" && -L "$candidate/.env.production" ]] || continue
  [[ -f "$candidate/.deploy/migration-status" ]] || continue
  grep -qx 'status=success' "$candidate/.deploy/migration-status" || continue
  previous_release="$candidate"
  break
done < <(
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '.incoming' \
    -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-
)

[[ -n "$previous_release" ]] || fail "No previous deployable release was found."
previous_id="$(basename "$previous_release")"
[[ "$previous_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Previous release has an unsafe identifier."

log "WARNING: rollback changes application code only."
log "WARNING: Prisma migrations are forward-only and will not be reverted."
log "Switching from $current_id to $previous_id."

rollback_link="$APP_PATH/.rollback-$previous_id"
[[ ! -e "$rollback_link" && ! -L "$rollback_link" ]] || fail "Temporary rollback symlink already exists."
ln -s "releases/$previous_id" "$rollback_link"
mv -Tf "$rollback_link" "$CURRENT_LINK"

(
  cd "$CURRENT_LINK"
  pm2 startOrReload ecosystem.config.cjs --env production --update-env
)

if ! health_check; then
  printf '[rollback] ERROR: Previous release failed its health check; restoring original current symlink.\n' >&2
  restore_link="$APP_PATH/.restore-$current_id"
  [[ ! -e "$restore_link" && ! -L "$restore_link" ]] || fail "Temporary restore symlink already exists."
  ln -s "releases/$current_id" "$restore_link"
  mv -Tf "$restore_link" "$CURRENT_LINK"
  (
    cd "$CURRENT_LINK"
    pm2 startOrReload ecosystem.config.cjs --env production --update-env
  )
  fail "Rollback target was unhealthy. Original code release was restored; no database changes were made."
fi

pm2 save
log "Health check result: success ($HEALTH_URL)."
log "Current target: $(readlink "$CURRENT_LINK")"
log "PM2 status:"
pm2 status
