#!/usr/bin/env bash
set -euo pipefail
if systemctl --user is-active --quiet photo-frame-calendar-tunnel.service; then
  printf 'Calendar SSH tunnel is already running.\n'
  exit 0
fi
systemd-run --user --unit=photo-frame-calendar-tunnel --collect \
  --property=Restart=on-failure --property=RestartSec=10 \
  /usr/bin/ssh -F /dev/null -NT \
  -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=yes -o ForwardAgent=no -o ForwardX11=no -o RequestTTY=no \
  -L 127.0.0.1:18787:127.0.0.1:8787 -- ctse@192.168.1.183
