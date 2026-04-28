#!/usr/bin/env bash
# =============================================================================
# test-rmf-pipeline.sh — Hermes RMF End-to-End Pipeline Test
#
# Tests the full data path: Adapter → RMF Core → API Server → curl
#
# Prerequisites (in a separate terminal):
#   export RMF_JWT_SECRET=hermes-dev-secret
#   ros2 launch hermes_backend.launch.py
#   # or: docker compose -f docker/docker-compose.yml up
#
# Usage:
#   bash scripts/test-rmf-pipeline.sh
#   RMF_TOKEN=$(cat .env.local | grep VITE_RMF_TOKEN | cut -d= -f2) \
#     bash scripts/test-rmf-pipeline.sh
# =============================================================================

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Configuration (override via env vars) ─────────────────────────────────────
RMF_URL="${RMF_URL:-http://localhost:8000}"   # 8000 = Docker dev; 7878 = native
RMF_TOKEN="${RMF_TOKEN:-}"                    # JWT from .env.local VITE_RMF_TOKEN
ROSBRIDGE_URL="${ROSBRIDGE_URL:-ws://localhost:9090}"
LATENCY_THRESHOLD_MS="${LATENCY_THRESHOLD_MS:-500}"

FAILED=0
TASK_ID=""

ok()   { echo -e "  ${GREEN}[OK]${NC}   $*"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $*"; FAILED=$((FAILED + 1)); }
info() { echo -e "         $*"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $*"; }

# Build curl auth header
auth_args() {
  if [ -n "$RMF_TOKEN" ]; then
    echo "-H" "Authorization: Bearer $RMF_TOKEN"
  fi
}

echo ""
echo "=== Hermes — Pipeline RMF End-to-End Test ==========================="
echo "    RMF API: ${RMF_URL}"
echo "    Auth:    $([ -n "$RMF_TOKEN" ] && echo 'Bearer token set' || echo 'NO TOKEN — unauthenticated')"
echo ""

# ── Check 1: API Server health ────────────────────────────────────────────────
echo "── Check 1: API Server responds ──────────────────────────────────────"

HEALTH_RESPONSE=$(curl -sf --max-time 5 $(auth_args) "${RMF_URL}/health" 2>&1) && \
  ok "API Server responds at ${RMF_URL}/health" || {
  # Some versions expose /alive instead
  HEALTH_RESPONSE=$(curl -sf --max-time 5 $(auth_args) "${RMF_URL}/alive" 2>&1) && \
    ok "API Server responds at ${RMF_URL}/alive" || {
    fail "API Server not responding at ${RMF_URL} — is the backend running?"
    echo ""
    info "Start with one of:"
    info "  ros2 launch hermes_backend.launch.py"
    info "  docker compose -f docker/docker-compose.yml up"
    echo ""
    echo "Cannot continue without API Server."
    exit 1
  }
}

# ── Check 2: Fleet State ───────────────────────────────────────────────────────
echo ""
echo "── Check 2: Fleet State ───────────────────────────────────────────────"

FLEET_RESPONSE=$(curl -sf --max-time 5 $(auth_args) "${RMF_URL}/fleets" 2>&1)
if [ $? -eq 0 ]; then
  ok "GET /fleets returned 200"
  info "Response: $(echo "$FLEET_RESPONSE" | head -c 200)"
else
  # Try alternative endpoint format
  FLEET_RESPONSE=$(curl -sf --max-time 5 $(auth_args) "${RMF_URL}/fleet_states" 2>&1)
  if [ $? -eq 0 ]; then
    ok "GET /fleet_states returned 200"
    info "Response: $(echo "$FLEET_RESPONSE" | head -c 200)"
  else
    fail "No fleet endpoint responded — adapter may not be publishing /fleet_states"
    info "Diagnose: ros2 topic echo /fleet_states --once"
  fi
fi

# Check for freebotics fleet in response
if echo "$FLEET_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# Handle both list of fleets and dict with robots key
fleets = data if isinstance(data, list) else [data]
found = any(
    str(f).find('freebotics') >= 0
    for f in fleets
)
sys.exit(0 if found else 1)
" 2>/dev/null; then
  ok "Fleet 'freebotics' found in response"
else
  warn "Fleet 'freebotics' not found in response — adapter may not be connected"
  info "Diagnose: ros2 topic echo /fleet_states --once"
  info "          ros2 node list | grep freebotics"
fi

# ── Check 3: WebSocket events ─────────────────────────────────────────────────
echo ""
echo "── Check 3: WebSocket events (fleet_states stream) ───────────────────"

WS_ENDPOINT="${RMF_URL/http/ws}/fleet_states"
WS_TOKEN_PARAM=$([ -n "$RMF_TOKEN" ] && echo "?token=${RMF_TOKEN}" || echo "")

if command -v websocat &>/dev/null; then
  # websocat: connect, receive for 3s, count messages
  WS_EVENTS=$(timeout 3 websocat --exit-on-eof "${WS_ENDPOINT}${WS_TOKEN_PARAM}" 2>/dev/null | wc -l || echo "0")
  if [ "$WS_EVENTS" -gt 0 ]; then
    ok "WebSocket received ${WS_EVENTS} events in 3s (expected ~30 at 10 Hz)"
  else
    warn "WebSocket connected but no events received — adapter may be disconnected"
    FAILED=$((FAILED + 1))
  fi
elif python3 -c "import websocket" 2>/dev/null; then
  # Python websocket-client fallback
  WS_COUNT=$(timeout 5 python3 - <<PYEOF 2>/dev/null || echo "0"
import websocket, json, time
count = 0
ws = websocket.create_connection("${WS_ENDPOINT}${WS_TOKEN_PARAM}", timeout=3)
deadline = time.time() + 3
while time.time() < deadline:
    try:
        ws.settimeout(deadline - time.time())
        msg = ws.recv()
        count += 1
    except:
        break
ws.close()
print(count)
PYEOF
  )
  if [ "${WS_COUNT:-0}" -gt 0 ]; then
    ok "WebSocket received ${WS_COUNT} events in 3s"
  else
    warn "WebSocket: no events in 3s — check adapter connection"
    FAILED=$((FAILED + 1))
  fi
else
  warn "WebSocket test skipped — install websocat or pip3 install websocket-client"
  info "  Install websocat: cargo install websocat  OR  apt install websocat"
fi

# ── Check 4: POST /tasks (dispatch) ───────────────────────────────────────────
echo ""
echo "── Check 4: Task dispatch (POST /tasks) ──────────────────────────────"

TASK_PAYLOAD='{"category":"navigation","description":{"places":["goal_0"]},"unix_millis_request_time":'$(date +%s%3N)'}'

# Try open-RMF v2 endpoint first, then simplified endpoint
TASK_RESPONSE=$(curl -sf --max-time 10 \
  -X POST "${RMF_URL}/tasks" \
  $(auth_args) \
  -H "Content-Type: application/json" \
  -d "$TASK_PAYLOAD" 2>&1)

if [ $? -ne 0 ]; then
  # Fallback to dispatch_task endpoint
  TASK_PAYLOAD_V1='{"type":"dispatch_task_request","request":{"category":"navigation","description":{"places":["goal_0"]},"unix_millis_request_time":'$(date +%s%3N)'}}'
  TASK_RESPONSE=$(curl -sf --max-time 10 \
    -X POST "${RMF_URL}/tasks/dispatch_task" \
    $(auth_args) \
    -H "Content-Type: application/json" \
    -d "$TASK_PAYLOAD_V1" 2>&1)
fi

if [ $? -eq 0 ]; then
  TASK_ID=$(echo "$TASK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('task_id', d.get('booking',{}).get('id','')))" 2>/dev/null || echo "")
  if [ -n "$TASK_ID" ]; then
    ok "POST /tasks → task_id: ${TASK_ID}"
  else
    ok "POST /tasks returned 200 (task_id field not found in response — check API version)"
    info "Response: $(echo "$TASK_RESPONSE" | head -c 200)"
  fi
else
  fail "POST /tasks failed — check auth token and API Server logs"
  info "Diagnose: is VITE_RMF_TOKEN set in .env.local?"
  info "          decode at https://jwt.io — check aud='rmf_api_server'"
fi

# ── Check 5: GET /tasks/{id} ──────────────────────────────────────────────────
echo ""
echo "── Check 5: Task state (GET /tasks/{id}) ─────────────────────────────"

if [ -n "$TASK_ID" ]; then
  sleep 1  # give the task manager time to register the task
  TASK_STATE=$(curl -sf --max-time 5 $(auth_args) "${RMF_URL}/tasks/${TASK_ID}" 2>&1)
  if [ $? -eq 0 ]; then
    STATE=$(echo "$TASK_STATE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
# RMF v2: d.status.value or d.booking.id
state = d.get('status',{}).get('value','') or d.get('state','') or 'unknown'
print(state)
" 2>/dev/null || echo "unknown")
    ok "GET /tasks/${TASK_ID} → state: ${STATE}"
  else
    fail "GET /tasks/${TASK_ID} returned error"
  fi
else
  warn "Check 5 skipped — no task_id from check 4"
fi

# ── Check 6: rosbridge in parallel ────────────────────────────────────────────
echo ""
echo "── Check 6: rosbridge parallel on :9090 ──────────────────────────────"

# Check port is open (netcat or ss)
if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -q ':9090'; then
    ok "Port :9090 is open (rosbridge bound)"
  elif ss -tlnp 2>/dev/null | grep -q ':9090\|:7878'; then
    PORTS=$(ss -tlnp 2>/dev/null | grep -E ':9090|:7878' | awk '{print $4}' | tr '\n' ' ')
    ok "Ports open: ${PORTS}"
  else
    fail "Port :9090 not open — rosbridge not running"
    info "Check: ros2 launch hermes_backend.launch.py"
  fi
elif command -v nc &>/dev/null; then
  if nc -z localhost 9090 &>/dev/null; then
    ok "Port :9090 reachable (rosbridge)"
  else
    fail "Port :9090 not reachable"
  fi
else
  warn "rosbridge port check skipped (no ss or nc)"
fi

# Verify no port conflict between :7878 and :9090
if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -E ':7878' | grep -q ':7878' && \
     ss -tlnp 2>/dev/null | grep -E ':9090' | grep -q ':9090'; then
    ok "No port conflict: :7878 (RMF API) and :9090 (rosbridge) both bound"
  fi
fi

# ── Check 7: FleetState latency ───────────────────────────────────────────────
echo ""
echo "── Check 7: FleetState latency ───────────────────────────────────────"

T_START=$(date +%s%3N)
curl -sf --max-time 2 $(auth_args) "${RMF_URL}/fleets" > /dev/null 2>&1
T_END=$(date +%s%3N)
LATENCY=$((T_END - T_START))

if [ "$LATENCY" -le "$LATENCY_THRESHOLD_MS" ]; then
  ok "FleetState REST latency: ${LATENCY}ms (threshold: ${LATENCY_THRESHOLD_MS}ms)"
else
  fail "FleetState REST latency: ${LATENCY}ms exceeds threshold of ${LATENCY_THRESHOLD_MS}ms"
  info "Check: ros2 topic hz /fleet_states (should be ~10 Hz)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "====================================================================="
if [ "$FAILED" -eq 0 ]; then
  echo -e "  ${GREEN}✅ Pipeline Semana 2 validado — pronto para Semana 3 (Frontend)${NC}"
  echo ""
  echo "  Next: npm run dev  →  open http://localhost:5173"
  echo "        VITE_RMF_API_URL=http://localhost:${RMF_URL##*:} in .env.local"
else
  echo -e "  ${RED}❌ ${FAILED} check(s) falharam — ver diagnósticos acima${NC}"
  echo ""
  echo "  Consulte: docs/troubleshooting-backend.md"
fi
echo "====================================================================="
echo ""

exit "$FAILED"
