#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
LAN_IP="$(ip -j -4 route get 1.1.1.1 | python -c 'import json,sys; print(json.load(sys.stdin)[0]["prefsrc"])')"
if systemctl --user is-active --quiet photo-frame-anime-dashboard.service; then
  systemctl --user show photo-frame-anime-dashboard.service --property=ExecStart
  printf 'Already running. Open http://%s:5180/\n' "$LAN_IP"
  exit 0
fi
systemd-run --user --unit=photo-frame-anime-dashboard --collect \
  --property="WorkingDirectory=$PROJECT_ROOT/anime-dashboard" \
  /usr/bin/python "$PROJECT_ROOT/scripts/serve-anime-dashboard.py" --host "$LAN_IP" --port 5180
printf 'Open http://%s:5180/\n' "$LAN_IP"
