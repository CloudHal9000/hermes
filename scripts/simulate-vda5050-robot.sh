#!/bin/bash

# simulate-vda5050-robot.sh — Simulate a VDA5050 robot publishing state via MQTT
#
# Usage: bash scripts/simulate-vda5050-robot.sh [robot_id] [x] [y]
# Example: bash scripts/simulate-vda5050-robot.sh sim_agv_001 5.0 3.0
#
# Requires:
#   - mosquitto-clients (for mosquitto_pub)
#   - mosquitto broker running on localhost:1883
#
# This script publishes fake robot state messages every 0.5 seconds
# to simulate a real VDA5050 robot. Useful for testing without hardware.

set -e

# ─── Configuration ─────────────────────────────────────────────────────

ROBOT_ID="${1:-sim_agv_001}"
X="${2:-5.0}"
Y="${3:-3.0}"
BROKER="localhost"
PORT="1883"
TOPIC="uagv/v2/simulator/1.0/${ROBOT_ID}/state"

# Simulation parameters
BATTERY_START=75.0
BATTERY_DRAIN_RATE=0.01  # % per cycle
SPEED=0.5  # cells per second

# ─── Startup ───────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       VDA5050 Robot Simulator — Publishing MQTT State          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Robot ID:          $ROBOT_ID"
echo "Initial Position:  ($X, $Y)"
echo "MQTT Broker:       $BROKER:$PORT"
echo "Topic:             $TOPIC"
echo ""
echo "Publishing state messages every 0.5 seconds..."
echo "Press Ctrl+C to stop"
echo ""

# Verify mosquitto-clients installed
if ! command -v mosquitto_pub &>/dev/null; then
  echo "[ERROR] mosquitto-clients not found"
  echo "Install: sudo apt install mosquitto-clients"
  exit 1
fi

# Verify broker is running
if ! mosquitto_sub -h "$BROKER" -p "$PORT" -t 'uagv/v2/simulator/ping' -C 1 &>/dev/null; then
  echo "[WARNING] MQTT broker not responding on $BROKER:$PORT"
  echo "Assuming broker will be available, continuing anyway..."
  sleep 1
fi

# ─── Main loop ─────────────────────────────────────────────────────────

BATTERY=$BATTERY_START
CYCLE=0

while true; do
  CYCLE=$((CYCLE + 1))
  BATTERY=$(awk "BEGIN {b=$BATTERY-$BATTERY_DRAIN_RATE; print (b<0?0:b)}")
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  HEADER_ID=$(($CYCLE * 1000))

  # Simulate some movement (drifting slightly)
  X_DRIFT=$(awk "BEGIN {printf \"%.1f\", $X + sin($CYCLE*0.01)*0.5}")
  Y_DRIFT=$(awk "BEGIN {printf \"%.1f\", $Y + cos($CYCLE*0.01)*0.5}")

  # VDA5050 state message (minimal valid schema)
  PAYLOAD=$(cat <<EOF
{
  "headerId": $HEADER_ID,
  "timestamp": "$TIMESTAMP",
  "version": "2.0.0",
  "manufacturer": "simulator",
  "serialNumber": "$ROBOT_ID",
  "orderId": "",
  "orderUpdateId": 0,
  "lastNodeId": "node_1",
  "lastNodeSequenceId": 0,
  "driving": false,
  "operatingMode": "AUTOMATIC",
  "newBaseRequest": false,
  "batteryState": {
    "batteryCharge": $BATTERY,
    "batteryHealth": 100.0,
    "charging": false
  },
  "agvPosition": {
    "x": $X_DRIFT,
    "y": $Y_DRIFT,
    "theta": 0.0,
    "mapId": "L1",
    "positionInitialized": true
  },
  "errors": [],
  "information": []
}
EOF
)

  # Publish to MQTT
  mosquitto_pub -h "$BROKER" -p "$PORT" -t "$TOPIC" -m "$PAYLOAD" 2>/dev/null || {
    echo "[WARNING] Failed to publish — broker may be down"
  }

  # Status message every 20 cycles (~10 seconds)
  if [ $((CYCLE % 20)) -eq 0 ]; then
    echo "[$CYCLE] $ROBOT_ID @ ($X_DRIFT, $Y_DRIFT) | Battery: $(printf %.1f $BATTERY)%"
  fi

  sleep 0.5
done
