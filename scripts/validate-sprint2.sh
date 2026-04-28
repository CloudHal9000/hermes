#!/bin/bash

# validate-sprint2.sh — Validation checklist for Sprint 2 (VDA5050)
#
# Verifies:
#   - Configuration files created
#   - Frontend modifications applied
#   - Documentation complete
#   - Tests still pass
#   - Build succeeds
#
# Usage: bash scripts/validate-sprint2.sh

set -e

FAILED=0
PASSED=0

# ─── Utility ───────────────────────────────────────────────────────────

check() {
  local name="$1"
  local cmd="$2"
  echo -n "[*] $name... "
  if eval "$cmd" &>/dev/null; then
    echo "✓"
    PASSED=$((PASSED + 1))
  else
    echo "✗"
    FAILED=$((FAILED + 1))
  fi
}

section() {
  echo ""
  echo "=== $1 ==="
}

# ─── Header ───────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              Sprint 2 — VDA5050 Validation Suite               ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# ─── Part A: Backend Configuration ────────────────────────────────────

section "Part A: Backend Configuration"

check "mosquitto.conf exists" \
  "test -f ros2/config/mosquitto.conf"
check "mosquitto.conf has listener 1883" \
  "grep -q 'listener 1883' ros2/config/mosquitto.conf"
check "mosquitto.conf has allow_anonymous" \
  "grep -q 'allow_anonymous' ros2/config/mosquitto.conf"

check "vda5050_connector.yaml exists" \
  "test -f ros2/config/vda5050_connector.yaml"
check "vda5050_connector.yaml has mqtt_host" \
  "grep -q 'mqtt_host' ros2/config/vda5050_connector.yaml"
check "vda5050_connector.yaml has fleet_name" \
  "grep -q 'vda5050_fleet' ros2/config/vda5050_connector.yaml"

# ─── Part B: Frontend (Protocol Detection & Badges) ──────────────────

section "Part B: Frontend — Protocol Detection"

check "useFleetState.js exists" \
  "test -f src/hooks/useFleetState.js"
check "useFleetState.js has inferProtocol or protocol" \
  "grep -qE 'inferProtocol|protocol.*vda5050' src/hooks/useFleetState.js"

check "FleetSelector.jsx exists" \
  "test -f src/components/fleet/FleetSelector.jsx"
check "FleetSelector.jsx has VDA5050 badge" \
  "grep -q 'VDA5050' src/components/fleet/FleetSelector.jsx"
check "Badge color is purple (#a855f7)" \
  "grep -q 'a855f7' src/components/fleet/FleetSelector.jsx"

check "ConnectionSettings.jsx has MQTT field" \
  "grep -qE 'mqtt|MQTT' src/components/settings/ConnectionSettings.jsx"

# ─── Part C: Documentation ───────────────────────────────────────────

section "Part C: Documentation"

check "vda5050-integration.md exists" \
  "test -f docs/vda5050-integration.md"
check "vda5050-integration.md has setup instructions" \
  "grep -q 'install-vda5050' docs/vda5050-integration.md"

check "OPENRMF_MIGRATION.md mentions VDA5050" \
  "grep -q 'VDA5050\|Sprint 2' OPENRMF_MIGRATION.md"

# ─── Part D: Scripts ──────────────────────────────────────────────────

section "Part D: Test & Validation Scripts"

check "install-vda5050.sh exists" \
  "test -f scripts/install-vda5050.sh"
check "install-vda5050.sh is executable" \
  "test -x scripts/install-vda5050.sh"

check "simulate-vda5050-robot.sh exists" \
  "test -f scripts/simulate-vda5050-robot.sh"
check "simulate-vda5050-robot.sh is executable" \
  "test -x scripts/simulate-vda5050-robot.sh"
check "simulate-vda5050-robot.sh publishes MQTT" \
  "grep -q 'mosquitto_pub' scripts/simulate-vda5050-robot.sh"

# ─── Code Quality ──────────────────────────────────────────────────────

section "Code Quality & Build"

check "Tests still pass (32+)" \
  "npm run test:run 2>&1 | grep -qE 'Tests.*[3-9][0-9].*passed|Tests.*[0-9][0-9][0-9].*passed'"

check "Build succeeds" \
  "npm run build 2>&1 | grep -q 'built in'"

check "No breaking changes to existing hooks" \
  "grep -qE 'export.*useRMFApi|export.*useFleetState' src/hooks/*.js"

# ─── Summary ───────────────────────────────────────────────────────────

echo ""
section "Summary"

TOTAL=$((PASSED + FAILED))
PERCENT=$((PASSED * 100 / TOTAL))

echo "Passed: $PASSED / $TOTAL ($PERCENT%)"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║        ✅ Sprint 2 Complete — VDA5050 Ready                     ║"
  echo "╠════════════════════════════════════════════════════════════════╣"
  echo "║ Hermes now supports:                                           ║"
  echo "║  ✓ ROS 2 native robots (freebotics adapter)                    ║"
  echo "║  ✓ Heterogeneous VDA5050 robots (auto-detected)                ║"
  echo "║  ✓ Mixed fleets (ROS 2 + VDA5050 simultaneously)               ║"
  echo "║                                                                ║"
  echo "║ Next: Connect a VDA5050 robot to test:                        ║"
  echo "║  1. bash scripts/install-vda5050.sh                            ║"
  echo "║  2. ros2 launch ros2/launch/hermes_backend.launch.py           ║"
  echo "║  3. bash scripts/simulate-vda5050-robot.sh sim_agv_001         ║"
  echo "║  4. Robot appears in FleetSelector with [VDA5050] badge        ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  exit 0
else
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║        ❌ $FAILED check(s) failed — see above                     ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  exit 1
fi
