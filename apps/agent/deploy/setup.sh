#!/bin/bash
# Run this on the Hetzner VPS as root (or with sudo)
# Usage: sudo bash setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Copying systemd files..."
cp "$SCRIPT_DIR/coding-agent.service" /etc/systemd/system/
cp "$SCRIPT_DIR/coding-agent.timer" /etc/systemd/system/

echo "==> Reloading systemd..."
systemctl daemon-reload

echo "==> Enabling and starting timer..."
systemctl enable coding-agent.timer
systemctl start coding-agent.timer

echo "==> Timer status:"
systemctl list-timers | grep coding-agent

echo ""
echo "==> Done! Useful commands:"
echo "  journalctl -u coding-agent.service -f        # follow logs"
echo "  systemctl status coding-agent.timer           # timer status"
echo "  systemctl start coding-agent.service          # trigger manual run"
echo "  systemctl stop coding-agent.timer             # pause the agent"
