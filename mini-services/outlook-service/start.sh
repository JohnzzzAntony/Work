#!/usr/bin/env bash
# Start the outlook-service in the background.
# Usage: ./start.sh   (logs go to ./outlook.log)
set -e
cd "$(dirname "$0")"

# Kill any stale instance running this specific service.
pkill -f "mini-services/outlook-service" 2>/dev/null || true
sleep 1

# Start the self-healing runner detached. nohup + setsid keeps it alive.
nohup setsid ./run.sh >/dev/null 2>&1 < /dev/null &

echo "[start.sh] outlook-service started in background"
exit 0
