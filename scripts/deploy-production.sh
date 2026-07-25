#!/usr/bin/env bash
set -Eeuo pipefail

umask 027

APP_PATH="${APP_PATH:?APP_PATH is required}"
RELEASE_ID="${RELEASE_ID:?RELEASE_ID is required}"
ARTIFACT_PATH="${ARTIFACT_PATH:?ARTIFACT_PATH is required}"
CHECKSUM_PATH="${CHECKSUM_PATH:?CHECKSUM_PATH is required}"

RELEASES_DIR="$APP_PATH/releases"
SHARED_DIR="$APP_PATH/shared"
LOGS_DIR="$APP_PATH/logs"
CURRENT_LINK="$APP_PATH/current"
RELEASE_PATH="$RELEASES_DIR/$RELEASE_ID"
INCOMING_DIR="$(dirname "$ARTIFACT_PATH")"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command is unavailable: $1"
}

validate_absolute_path() {
  local value="$1"
  local label="$2"
  [[ "$value" == /* ]] || fail "$label must be an absolute path."
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* && "$value" != *".."* ]] \
    || fail "$label contains an unsafe path component."
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

validate_absolute_path "$APP_PATH" "APP_PATH"
validate_absolute_path "$ARTIFACT_PATH" "ARTIFACT_PATH"
validate_absolute_path "$CHECKSUM_PATH" "CHECKSUM_PATH"
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]] || fail "RELEASE_ID contains unsupported characters."
[[ "$KEEP_RELEASES" =~ ^[1-9][0-9]*$ ]] || fail "KEEP_RELEASES must be a positive integer."

for command_name in curl cut find grep head ln mv npm pm2 readlink seq sha256sum sort tar wc; do
  require_command "$command_name"
done

[[ -d "$RELEASES_DIR" && -w "$RELEASES_DIR" ]] || fail "$RELEASES_DIR must exist and be writable."
[[ -f "$SHARED_DIR/.env.production" && -r "$SHARED_DIR/.env.production" ]] \
  || fail "Shared production environment file is missing or unreadable."
[[ -d "$SHARED_DIR/uploads" && -w "$SHARED_DIR/uploads" ]] \
  || fail "Shared uploads directory is missing or not writable."
[[ -d "$LOGS_DIR" && -w "$LOGS_DIR" ]] || fail "Logs directory is missing or not writable."
[[ -f "$ARTIFACT_PATH" && -r "$ARTIFACT_PATH" ]] || fail "Release artifact is missing or unreadable."
[[ -f "$CHECKSUM_PATH" && -r "$CHECKSUM_PATH" ]] || fail "Checksum file is missing or unreadable."
[[ "$(dirname "$CHECKSUM_PATH")" == "$INCOMING_DIR" ]] \
  || fail "Artifact and checksum must be in the same incoming directory."
[[ "$INCOMING_DIR" == "$RELEASES_DIR/.incoming/$RELEASE_ID" ]] \
  || fail "Artifact must be stored in the release-specific incoming directory."

artifact_name="$(basename "$ARTIFACT_PATH")"
[[ "$artifact_name" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Artifact file name is unsafe."
read -r expected_checksum checksum_file_name checksum_extra <"$CHECKSUM_PATH" || fail "Checksum file is invalid."
checksum_file_name="${checksum_file_name#\*}"
[[ "$expected_checksum" =~ ^[A-Fa-f0-9]{64}$ ]] || fail "Checksum value is invalid."
[[ "$checksum_file_name" == "$artifact_name" && -z "${checksum_extra:-}" ]] \
  || fail "Checksum file must reference only the uploaded artifact."
[[ "$(wc -l <"$CHECKSUM_PATH")" -eq 1 ]] || fail "Checksum file must contain exactly one record."

log "Verifying artifact checksum."
(
  cd "$INCOMING_DIR"
  sha256sum --check --status "$(basename "$CHECKSUM_PATH")"
) || fail "Artifact checksum verification failed."

log "Inspecting artifact paths."
while IFS= read -r archive_entry; do
  normalized_entry="${archive_entry#./}"
  [[ -n "$normalized_entry" ]] || continue
  [[ "$normalized_entry" != /* ]] || fail "Artifact contains an absolute path."
  [[ "$normalized_entry" != ".." && "$normalized_entry" != ../* && "$normalized_entry" != */../* ]] \
    || fail "Artifact contains a parent-directory traversal."

  IFS='/' read -r -a path_parts <<< "$normalized_entry"
  for path_part in "${path_parts[@]}"; do
    case "$path_part" in
      .env*|.git|node_modules|uploads|logs|tmp|coverage)
        fail "Artifact contains forbidden path component: $path_part"
        ;;
    esac
  done
done < <(tar -tzf "$ARTIFACT_PATH")

[[ ! -e "$RELEASE_PATH" ]] || fail "Release already exists: $RELEASE_ID"
mkdir -p "$RELEASE_PATH"

log "Extracting release $RELEASE_ID."
tar -xzf "$ARTIFACT_PATH" -C "$RELEASE_PATH"

private_key_match="$(
  grep -RIl --binary-files=without-match \
    -E 'BEGIN (OPENSSH|RSA|EC|DSA) PRIVATE KEY' "$RELEASE_PATH" \
    | head -n 1 || true
)"
if [[ -n "$private_key_match" ]]; then
  fail "Artifact contains private-key material."
fi

for required_path in \
  ".next/BUILD_ID" \
  "public" \
  "package.json" \
  "package-lock.json" \
  "next.config.ts" \
  "prisma/schema.prisma" \
  "prisma/migrations" \
  "prisma.config.ts" \
  "ecosystem.config.cjs"; do
  [[ -e "$RELEASE_PATH/$required_path" ]] || fail "Artifact is missing required path: $required_path"
done

ln -s "$SHARED_DIR/.env.production" "$RELEASE_PATH/.env.production"
ln -s "$SHARED_DIR/.env.production" "$RELEASE_PATH/.env"
ln -s "$SHARED_DIR/uploads" "$RELEASE_PATH/uploads"
mkdir -p "$RELEASE_PATH/.deploy"

log "Installing production and deploy dependencies without rebuilding Next.js."
(
  cd "$RELEASE_PATH"
  NODE_ENV=production npm ci --omit=dev --no-audit --no-fund
)

[[ -x "$RELEASE_PATH/node_modules/.bin/prisma" ]] \
  || fail "Prisma CLI is unavailable after production dependency installation."

log "Applying forward-only Prisma migrations."
if (
  cd "$RELEASE_PATH"
  NODE_ENV=production ./node_modules/.bin/prisma migrate deploy \
    >"$RELEASE_PATH/.deploy/prisma-migrate.log" 2>&1
); then
  {
    printf 'release_id=%s\n' "$RELEASE_ID"
    printf 'completed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'status=success\n'
  } >"$RELEASE_PATH/.deploy/migration-status"
  log "Prisma migration result: success."
else
  printf 'status=failed\n' >"$RELEASE_PATH/.deploy/migration-status"
  fail "Prisma migration failed. Diagnostic log retained in the new release."
fi

previous_target=""
if [[ -e "$CURRENT_LINK" || -L "$CURRENT_LINK" ]]; then
  [[ -L "$CURRENT_LINK" ]] || fail "Current path exists but is not a symlink."
  previous_target="$(readlink -f "$CURRENT_LINK" || true)"
fi
printf 'previous_current=%s\n' "$previous_target" >"$RELEASE_PATH/.deploy/previous-current"

next_link="$APP_PATH/.current-$RELEASE_ID"
[[ ! -e "$next_link" && ! -L "$next_link" ]] || fail "Temporary current symlink already exists."
ln -s "releases/$RELEASE_ID" "$next_link"
mv -Tf "$next_link" "$CURRENT_LINK"

log "Current symlink switched to release $RELEASE_ID."
(
  cd "$CURRENT_LINK"
  pm2 startOrReload ecosystem.config.cjs --env production --update-env
)

if ! health_check; then
  pm2 status || true
  printf '[deploy] ERROR: Health check failed after migrations and PM2 reload.\n' >&2
  printf '[deploy] ERROR: Automatic database rollback was not attempted.\n' >&2
  printf '[deploy] ERROR: Release %s was retained for diagnostics; use the reviewed rollback script only after checking migration compatibility.\n' "$RELEASE_ID" >&2
  exit 1
fi

log "Health check result: success ($HEALTH_URL)."
pm2 save

current_real="$(readlink -f "$CURRENT_LINK")"
kept_count=1
while IFS= read -r candidate; do
  [[ -n "$candidate" && -d "$candidate" ]] || continue
  candidate_real="$(readlink -f "$candidate")"
  [[ "$candidate_real" != "$current_real" ]] || continue

  if (( kept_count < KEEP_RELEASES )); then
    kept_count=$((kept_count + 1))
    continue
  fi

  case "$candidate" in
    "$RELEASES_DIR"/*)
      log "Removing old inactive release: $(basename "$candidate")"
      rm -rf -- "$candidate"
      ;;
    *)
      fail "Refusing to remove a path outside releases: $candidate"
      ;;
  esac
done < <(
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '.incoming' \
    -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-
)

case "$INCOMING_DIR" in
  "$RELEASES_DIR/.incoming"/*)
    rm -rf -- "$INCOMING_DIR"
    ;;
  *)
    fail "Refusing to clean an unexpected incoming directory."
    ;;
esac

log "Release ID: $RELEASE_ID"
log "Current target: $(readlink "$CURRENT_LINK")"
log "Migration result: success"
log "PM2 status:"
pm2 status
