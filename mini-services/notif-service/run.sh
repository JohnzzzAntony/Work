#!/usr/bin/env bash
# Self-healing launcher for the notif-service.
# Runs the service in a loop so that if the bun process dies, it restarts.
# Fully detached via setsid + disown.
cd "$(dirname "$0")"

while true; do
  echo "[runner] starting notif-service at $(date -Iseconds)" >> notif.log
  bun --hot index.ts >> notif.log 2>&1
  EXIT=$?
  echo "[runner] notif-service exited with code $EXIT at $(date -Iseconds) — restarting in 2s" >> notif.log
  sleep 2
done
