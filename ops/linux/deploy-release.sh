#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/opt/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

release_id="${1:-}"
archive_path="${2:-}"
deploy_root="/var/www/jobdraftly"
environment_file="/etc/jobdraftly/jobdraftly.env"
releases_root="$deploy_root/releases"
release_path="$releases_root/$release_id"
current_link="$deploy_root/current"
incoming_link="$deploy_root/current.incoming"
health_origin="http://127.0.0.1:3100"

if [[ ! "$release_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Invalid release ID." >&2
  exit 1
fi
if [[ -z "$archive_path" || ! -f "$archive_path" ]]; then
  echo "Release archive does not exist: $archive_path" >&2
  exit 1
fi
if [[ ! -f "$environment_file" ]]; then
  echo "Protected environment file is missing: $environment_file" >&2
  exit 1
fi
if [[ ! -d "$deploy_root" || ! -w "$deploy_root" ]]; then
  echo "Deployment user $(id -un) cannot write to $deploy_root. Expected owner/group: jobdraftly:jobdraftly." >&2
  exit 1
fi
if [[ "$(command -v node)" != "/opt/node22/bin/node" ]]; then
  echo "JobDraftly Node.js 22 installation is missing at /opt/node22/bin/node." >&2
  exit 1
fi
if [[ -e "$release_path" ]]; then
  echo "Release already exists: $release_path" >&2
  exit 1
fi

mkdir -p "$releases_root"
mkdir "$release_path"
tar -xzf "$archive_path" -C "$release_path"
rm -f -- "$archive_path"

cd "$release_path"
npm ci
node --env-file="$environment_file" node_modules/prisma/build/index.js generate
node scripts/run-cli-with-env.mjs "$environment_file" node_modules/next/dist/bin/next build
node --env-file="$environment_file" scripts/production-preflight.mjs
node --env-file="$environment_file" scripts/backup-mysql.mjs
node --env-file="$environment_file" node_modules/prisma/build/index.js migrate deploy
node --env-file="$environment_file" --import tsx scripts/load-reference-data.ts

wait_for_health() {
  local path="$1"
  local attempts="${2:-60}"
  local url="$health_origin$path"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 10 "$url" >/dev/null; then
      echo "Healthy: $url"
      return 0
    fi
    sleep 5
  done
  echo "Health check timed out: $url" >&2
  return 1
}

previous_release=""
if [[ -L "$current_link" ]]; then
  previous_release="$(readlink -f "$current_link")"
  case "$previous_release" in
    "$releases_root"/*) ;;
    *) echo "Refusing deployment: current points outside $releases_root" >&2; exit 1 ;;
  esac
elif [[ -e "$current_link" ]]; then
  echo "Refusing deployment: $current_link exists and is not a symbolic link." >&2
  exit 1
fi

rm -f -- "$incoming_link"
ln -s "$release_path" "$incoming_link"
mv -Tf "$incoming_link" "$current_link"

rollback() {
  echo "Deployment health check failed. Database migrations are not reversed." >&2
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -s "$previous_release" "$incoming_link"
    mv -Tf "$incoming_link" "$current_link"
    sudo -n systemctl restart jobdraftly-app.service
    sudo -n systemctl restart jobdraftly-worker.service
    echo "Restored application release: $previous_release" >&2
  else
    sudo -n systemctl stop jobdraftly-worker.service jobdraftly-app.service || true
    echo "No previous release was available; JobDraftly services were stopped." >&2
  fi
}

if ! sudo -n systemctl restart jobdraftly-app.service; then
  rollback
  exit 1
fi
if ! wait_for_health "/api/health/live" 24 || ! wait_for_health "/api/health/ready" 60; then
  rollback
  exit 1
fi
if ! sudo -n systemctl restart jobdraftly-worker.service; then
  rollback
  exit 1
fi
if ! wait_for_health "/api/health/worker" 60; then
  rollback
  exit 1
fi

echo "Release $release_id is active and healthy."
