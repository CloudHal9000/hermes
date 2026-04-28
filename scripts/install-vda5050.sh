#!/bin/bash

# install-vda5050.sh — Install VDA5050 dependencies (mosquitto + vda5050_connector)
# Idempotent: safe to run multiple times
#
# Usage: bash scripts/install-vda5050.sh
# Requires: sudo access for apt install

set -e

HERMES_WS="${HOME}/hermes_ws"
FAILED=0

# ─── Header ───────────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Hermes — VDA5050 Dependencies Installation            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ─── Utility functions ─────────────────────────────────────────────────

check() {
  local name="$1"
  local cmd="$2"
  echo -n "[*] $name... "
  if eval "$cmd" &>/dev/null; then
    echo "✓"
    return 0
  else
    echo "✗"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

require_sudo() {
  if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] This command requires sudo privileges"
    echo "Usage: sudo bash scripts/install-vda5050.sh"
    exit 1
  fi
}

# ─── Step 1: mosquitto MQTT Broker ────────────────────────────────────

echo "[1/3] Installing mosquitto broker..."

if ! command -v mosquitto &>/dev/null; then
  echo "  → mosquitto not found, installing..."
  require_sudo
  apt-get update
  apt-get install -y mosquitto mosquitto-clients
  mkdir -p /tmp/hermes_mqtt
  chmod 1777 /tmp/hermes_mqtt
  echo "  ✓ mosquitto installed"
else
  echo "  ✓ mosquitto already installed ($(mosquitto --version))"
fi

# Verify mosquitto config exists
if [ ! -f "ros2/config/mosquitto.conf" ]; then
  echo "  [ERROR] ros2/config/mosquitto.conf not found"
  FAILED=$((FAILED + 1))
else
  echo "  ✓ mosquitto.conf found"
fi

# ─── Step 2: vda5050_connector (ROS 2 package) ─────────────────────────

echo ""
echo "[2/3] Setting up vda5050_connector..."

# Source ROS 2
source /opt/ros/humble/setup.bash 2>/dev/null || {
  echo "  [ERROR] ROS 2 Humble not found. Install: sudo apt install ros-humble-desktop"
  FAILED=$((FAILED + 1))
}

# Check if vda5050_connector is available in apt
if apt-cache search vda5050 2>/dev/null | grep -q vda5050_connector; then
  if ! dpkg -l | grep -q vda5050-connector; then
    echo "  → vda5050_connector not installed, installing from apt..."
    require_sudo
    apt-get install -y ros-humble-vda5050-connector
  else
    echo "  ✓ vda5050_connector already installed via apt"
  fi
else
  # Fallback: build from source
  echo "  → vda5050_connector not in apt, checking if already in workspace..."

  if [ ! -d "$HERMES_WS/src/vda5050_connector" ]; then
    echo "  → Cloning vda5050_connector from GitHub..."
    mkdir -p "$HERMES_WS/src"
    cd "$HERMES_WS/src"
    git clone https://github.com/tum-fml/vda5050_connector.git 2>/dev/null || {
      echo "  [WARNING] Could not clone vda5050_connector. Manual setup required."
      echo "  See docs/vda5050-integration.md for details."
    }
  fi

  if [ -d "$HERMES_WS/src/vda5050_connector" ]; then
    echo "  → Building vda5050_connector in $HERMES_WS..."
    cd "$HERMES_WS"
    source /opt/ros/humble/setup.bash
    colcon build --symlink-install --packages-select vda5050_connector 2>/dev/null || {
      echo "  [WARNING] colcon build failed. Check dependencies."
      FAILED=$((FAILED + 1))
    }
    echo "  ✓ vda5050_connector built from source"
  fi
fi

# Verify vda5050_connector is available
if ros2 pkg list 2>/dev/null | grep -q vda5050_connector; then
  echo "  ✓ vda5050_connector available in ROS 2 path"
else
  echo "  [WARNING] vda5050_connector not available — may need to source workspace"
fi

# ─── Step 3: Configuration Verification ───────────────────────────────

echo ""
echo "[3/3] Verifying configuration..."

check "mosquitto.conf exists" "test -f ros2/config/mosquitto.conf"
check "vda5050_connector.yaml exists" "test -f ros2/config/vda5050_connector.yaml"
check "mosquitto can start" "timeout 2 mosquitto -c ros2/config/mosquitto.conf &>/dev/null; true"

# ─── Cleanup & Summary ─────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"

if [ "$FAILED" -eq 0 ]; then
  echo "║                  ✅ Installation Complete                       ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Next steps:"
  echo "  1. Start the backend: ros2 launch ros2/launch/hermes_backend.launch.py"
  echo "  2. Connect a VDA5050 robot to the MQTT broker (localhost:1883)"
  echo "  3. Robot appears in Hermes FleetSelector with [VDA5050] badge"
  echo ""
  echo "Troubleshooting:"
  echo "  • Check mosquitto: mosquitto_sub -h localhost -t 'uagv/v2/#' -v"
  echo "  • Check logs: tail -f /tmp/hermes_mqtt/mosquitto.log"
  exit 0
else
  echo "║                  ❌ Installation Failed                        ║"
  echo "║           $FAILED error(s) — see output above               ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  exit 1
fi
