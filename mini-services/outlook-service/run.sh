#!/usr/bin/env bash
# Self-healing launcher for the outlook-service.
# Runs the service in a loop so that if the bun process dies, it restarts.
# Detached via setsid + disown.
cd "$(dirname "$0")"

while true; do
  echo "[runner] starting outlook-service at $(date -Iseconds)" >> outlook.log
  bun --hot index.ts >> outlook.log 2>&1
  EXIT=$?
  echo "[runner] outlook-service exited with code $EXIT at $(date -Iseconds) — restarting in 2s" >> outlook.log
  sleep 2
done
