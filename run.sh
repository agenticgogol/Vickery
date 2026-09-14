#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

printf '\nBillboard Exchange V0\n'
printf '%s\n' '────────────────────────────────────────'

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: Node.js is required but was not found.' >&2
  printf '%s\n' 'Install Node.js 20.9+ from https://nodejs.org/ and run ./run.sh again.' >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: npm is required but was not found.' >&2
  printf '%s\n' 'Install npm with Node.js 20.9+ and run ./run.sh again.' >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: curl is required for local route readiness checks but was not found.' >&2
  printf '%s\n' 'Install curl with your operating system package manager and run ./run.sh again.' >&2
  exit 1
fi

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 20 || (major === 20 && minor < 9)) { console.error(`ERROR: Node.js ${process.versions.node} found; Node.js 20.9+ is required.`); process.exit(1); }'
printf '✓ Node.js %s\n' "$(node --version)"
printf '✓ npm %s\n' "$(npm --version)"
printf '%s\n' '✓ curl available for readiness checks'

if [ ! -f package.json ] || [ ! -f package-lock.json ]; then
  printf '%s\n' 'ERROR: package.json and package-lock.json are required.' >&2
  exit 1
fi

if ! node -e 'const p = require("./package.json"); if (!p.scripts || !p.scripts.dev) process.exit(1);'; then
  printf '%s\n' 'ERROR: package.json does not define the required dev script.' >&2
  exit 1
fi

if [ ! -d node_modules ] || ! npm ls --depth=0 --silent >/dev/null 2>&1; then
  printf '%s\n' '→ Installing missing or stale npm dependencies...'
  npm ci
  printf '%s\n' '✓ Dependencies ready'
else
  printf '%s\n' '✓ Dependencies already installed'
fi

printf '%s\n' '✓ No environment variables or API keys are required for this V0 demo'
printf '\nDemo URLs\n'
printf '%s\n' '  Owner UI:                       http://127.0.0.1:3000/owner'
printf '%s\n' '  Advertiser UI:                  http://127.0.0.1:3000/advertiser'
printf '%s\n' '  Admin/Management Dashboard:     http://127.0.0.1:3000/admin'
printf '%s\n' '  Virtual Billboard / Player:     http://127.0.0.1:3000/playback/slot-cyber-7pm'
printf '\nManagement dashboard: open http://127.0.0.1:3000/admin\n'
printf 'Starting the single required service at http://127.0.0.1:3000\n'
printf 'Press Ctrl-C to stop.\n\n'

npm run dev -- --hostname 127.0.0.1 --port 3000 &
APP_PID=$!

cleanup() {
  trap - EXIT INT TERM
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

BASE_URL="http://127.0.0.1:3000"
ROUTES=(
  "/owner"
  "/advertiser"
  "/admin"
  "/playback/slot-cyber-7pm"
)

for attempt in $(seq 1 30); do
  if curl -fsS "$BASE_URL/" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    printf '%s\n' 'ERROR: Next.js exited before becoming ready.' >&2
    exit 1
  fi
  sleep 1
  if [ "$attempt" -eq 30 ]; then
    printf '%s\n' 'ERROR: Next.js did not become ready within 30 seconds.' >&2
    exit 1
  fi
done

printf '\nRoute status\n'
for route in "${ROUTES[@]}"; do
  if curl -fsS "$BASE_URL$route" >/dev/null 2>&1; then
    printf '✓ %s%s\n' "$BASE_URL" "$route"
  else
    printf 'ERROR: %s%s is not responding.\n' "$BASE_URL" "$route" >&2
    exit 1
  fi
done
printf '\n✓ All V0 demo URLs are ready.\n\n'

wait "$APP_PID"
