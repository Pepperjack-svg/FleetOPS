#!/usr/bin/env bash
# FleetOPS Agent — pushes metrics to FleetOPS over HTTPS
# Usage: curl -fsSL https://YOUR_FLEETOPS/agent.sh | FLEETOPS_URL=https://... FLEETOPS_TOKEN=xxx bash

set -euo pipefail

FLEETOPS_URL="${FLEETOPS_URL:-}"
FLEETOPS_TOKEN="${FLEETOPS_TOKEN:-}"
INTERVAL="${INTERVAL:-5}"
AGENT_USER="${SUDO_USER:-$(whoami)}"

# ── Validate ──────────────────────────────────────────────────────────────────
if [ -z "$FLEETOPS_URL" ] || [ -z "$FLEETOPS_TOKEN" ]; then
  echo "Error: FLEETOPS_URL and FLEETOPS_TOKEN must be set."
  echo "Run: curl -fsSL $FLEETOPS_URL/agent.sh | FLEETOPS_URL=https://... FLEETOPS_TOKEN=xxx bash"
  exit 1
fi

# Strip trailing slash
FLEETOPS_URL="${FLEETOPS_URL%/}"
INSTALL_DIR="/opt/fleetops-agent"
SERVICE_FILE="/etc/systemd/system/fleetops-agent.service"

echo "==> Installing FleetOPS Agent"
echo "    URL:  $FLEETOPS_URL"
echo "    User: $AGENT_USER"

# ── Write the agent loop script ───────────────────────────────────────────────
sudo mkdir -p "$INSTALL_DIR"
sudo tee "$INSTALL_DIR/agent.sh" > /dev/null << 'AGENT_EOF'
#!/usr/bin/env bash
# FleetOPS metric collector — do not edit, managed by installer

FLEETOPS_URL="__FLEETOPS_URL__"
FLEETOPS_TOKEN="__FLEETOPS_TOKEN__"
INTERVAL=5
HOSTNAME=$(hostname)

PREV_CPU_USER=0; PREV_CPU_NICE=0; PREV_CPU_SYS=0; PREV_CPU_IDLE=0
PREV_CPU_IOWAIT=0; PREV_CPU_IRQ=0; PREV_CPU_SOFTIRQ=0; PREV_CPU_STEAL=0
PREV_RX=0; PREV_TX=0; FIRST=1

get_cpu_percent() {
  local line
  line=$(grep '^cpu ' /proc/stat)
  read -r _ u n s id iw irq sirq steal _ <<< "$line"
  local total=$(( u+n+s+id+iw+irq+sirq+steal ))
  local idle=$id
  if [ "$FIRST" -eq 1 ]; then
    PREV_CPU_IDLE=$idle; PREV_CPU_USER=$u; PREV_CPU_NICE=$n
    PREV_CPU_SYS=$s; PREV_CPU_IOWAIT=$iw; PREV_CPU_IRQ=$irq
    PREV_CPU_SOFTIRQ=$sirq; PREV_CPU_STEAL=$steal
    FIRST=0; echo "0"; return
  fi
  local prev_total=$(( PREV_CPU_USER+PREV_CPU_NICE+PREV_CPU_SYS+PREV_CPU_IDLE+PREV_CPU_IOWAIT+PREV_CPU_IRQ+PREV_CPU_SOFTIRQ+PREV_CPU_STEAL ))
  local d_total=$(( total - prev_total ))
  local d_idle=$(( idle - PREV_CPU_IDLE ))
  PREV_CPU_IDLE=$idle; PREV_CPU_USER=$u; PREV_CPU_NICE=$n
  PREV_CPU_SYS=$s; PREV_CPU_IOWAIT=$iw; PREV_CPU_IRQ=$irq
  PREV_CPU_SOFTIRQ=$sirq; PREV_CPU_STEAL=$steal
  if [ "$d_total" -le 0 ]; then echo "0"; return; fi
  # Multiply by 1000 to get one decimal via integer math, divide later in awk
  echo $(( (d_total - d_idle) * 1000 / d_total ))
}

get_net_bytes() {
  # Sum rx/tx bytes across all non-loopback interfaces
  awk '
    NR>2 && $1 !~ /^lo:/ {
      gsub(/:/, "", $1)
      rx += $2; tx += $10
    }
    END { print rx, tx }
  ' /proc/net/dev
}

while true; do
  # CPU
  CPU_RAW=$(get_cpu_percent)
  CPU=$(awk "BEGIN { printf \"%.1f\", $CPU_RAW / 10 }")

  # Memory (KB)
  RAM_TOTAL=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
  RAM_AVAIL=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
  RAM_USED=$(( RAM_TOTAL - RAM_AVAIL ))

  # Disk (KB) — root filesystem
  read -r _ DISK_TOTAL_1K DISK_USED_1K _ _ _ <<< "$(df -k / | tail -1)"
  DISK_USED_KB=$DISK_USED_1K
  DISK_TOTAL_KB=$DISK_TOTAL_1K

  # Network bytes
  read -r RX TX <<< "$(get_net_bytes)"

  # Send to FleetOPS
  curl -sf -X POST "$FLEETOPS_URL/api/agents/heartbeat" \
    -H "Content-Type: application/json" \
    -H "X-Agent-Token: $FLEETOPS_TOKEN" \
    --max-time 5 \
    -d "{\"cpu\":$CPU,\"ramUsedKB\":$RAM_USED,\"ramTotalKB\":$RAM_TOTAL,\"diskUsedKB\":$DISK_USED_KB,\"diskTotalKB\":$DISK_TOTAL_KB,\"rxBytes\":$RX,\"txBytes\":$TX,\"hostname\":\"$HOSTNAME\"}" \
    > /dev/null 2>&1 || true

  sleep "$INTERVAL"
done
AGENT_EOF

# Inject real values
sudo sed -i "s|__FLEETOPS_URL__|${FLEETOPS_URL}|g" "$INSTALL_DIR/agent.sh"
sudo sed -i "s|__FLEETOPS_TOKEN__|${FLEETOPS_TOKEN}|g" "$INSTALL_DIR/agent.sh"
sudo chmod +x "$INSTALL_DIR/agent.sh"

# ── Write systemd service ─────────────────────────────────────────────────────
sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=FleetOPS Metrics Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash $INSTALL_DIR/agent.sh
Restart=always
RestartSec=10
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# ── Enable and start ──────────────────────────────────────────────────────────
sudo systemctl daemon-reload
sudo systemctl enable fleetops-agent
sudo systemctl restart fleetops-agent

sleep 2
if sudo systemctl is-active --quiet fleetops-agent; then
  echo ""
  echo "✓ FleetOPS Agent is running"
  echo "  Metrics will appear in FleetOPS within 10 seconds."
  echo ""
  echo "  Useful commands:"
  echo "    sudo systemctl status fleetops-agent"
  echo "    sudo journalctl -u fleetops-agent -f"
  echo "    sudo systemctl stop fleetops-agent"
else
  echo "✗ Agent failed to start. Check: sudo journalctl -u fleetops-agent -n 20"
  exit 1
fi
