#!/usr/bin/env bash
# Start the notif-service socket.io mini-service in the background on port 3003.
# Usage: ./start.sh   (logs go to ./notif.log)
set -e
cd "$(dirname "$0")"

# Kill any stale instance.
pkill -f "bun --hot index.ts" 2>/dev/null || true
sleep 1

# Start detached. nohup + setsid keeps it alive across shell exits.
nohup setsid bun --hot index.ts > "$(pwd)/notif.log" 2>&1 < /dev/null &
disown 2>/dev/null || true

# Wait for the port to come up.
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w '%{http_code}' http://localhost:3003/ 2>/dev/null | grep -q 200; then
    echo "[start.sh] notif-service is up on port 3003 (pid=$!)"
    exit 0
  fi
  sleep 0.5
done

echo "[start.sh] notif-service failed to start within 10s — see notif.log:" >&2
cat notif.log >&2
exit 1
