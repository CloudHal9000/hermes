#!/usr/bin/env bash
# =============================================================================
# validate-week2.sh — Hermes Week 2 completion checklist
#
# Usage:
#   bash scripts/validate-week2.sh               # file checks only
#   bash scripts/validate-week2.sh --with-backend # file + running service checks
#
# Returns exit code = number of failed checks (0 = all passed).
# =============================================================================

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0
WITH_BACKEND=false
if [[ "${1:-}" == "--with-backend" ]]; then
  WITH_BACKEND=true
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RMF_URL="${RMF_URL:-http://localhost:8000}"  # 8000 = Docker dev; 7878 = native

ok()   { echo -e "  ${GREEN}[OK]${NC}   $*"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $*"; FAILED=$((FAILED + 1)); }
skip() { echo -e "  ${YELLOW}[SKIP]${NC} $*"; }

check_file() {
  local desc="$1"
  local path="$2"
  if [[ -f "$path" ]]; then
    ok "$desc"
  else
    fail "$desc — not found: $path"
  fi
}

check_python_syntax() {
  local desc="$1"
  local path="$2"
  if [[ ! -f "$path" ]]; then
    fail "$desc — file not found: $path"
    return
  fi
  if python3 -m py_compile "$path" 2>/dev/null; then
    ok "$desc"
  else
    fail "$desc — Python syntax error in $path"
    python3 -m py_compile "$path" 2>&1 | head -5
  fi
}

echo ""
echo "=== Hermes — Validação Semana 2 ======================================"
echo "    Mode: $([ "$WITH_BACKEND" = true ] && echo 'files + live services' || echo 'files only')"
echo ""

# ── Section 1: Config files ───────────────────────────────────────────────────
echo "── Config files ───────────────────────────────────────────────────────"

check_file "ros2/config/rmf_api_server.config.yaml" \
  "${REPO_ROOT}/ros2/config/rmf_api_server.config.yaml"

check_file "ros2/config/rmf_traffic_schedule.config.yaml" \
  "${REPO_ROOT}/ros2/config/rmf_traffic_schedule.config.yaml"

check_file "ros2/config/rosbridge.config.yaml" \
  "${REPO_ROOT}/ros2/config/rosbridge.config.yaml"

# ── Section 2: Launch files (syntax check) ────────────────────────────────────
echo ""
echo "── Launch files ───────────────────────────────────────────────────────"

check_python_syntax "ros2/launch/hermes_backend.launch.py is valid Python" \
  "${REPO_ROOT}/ros2/launch/hermes_backend.launch.py"

check_python_syntax "ros2/launch/hermes_sim.launch.py is valid Python" \
  "${REPO_ROOT}/ros2/launch/hermes_sim.launch.py"

# ── Section 3: Scripts ────────────────────────────────────────────────────────
echo ""
echo "── Scripts ────────────────────────────────────────────────────────────"

check_file "scripts/test-rmf-pipeline.sh" \
  "${REPO_ROOT}/scripts/test-rmf-pipeline.sh"

if [[ -x "${REPO_ROOT}/scripts/test-rmf-pipeline.sh" ]]; then
  ok "scripts/test-rmf-pipeline.sh é executável"
else
  fail "scripts/test-rmf-pipeline.sh não é executável (chmod +x)"
fi

check_file "scripts/validate-week2.sh" \
  "${REPO_ROOT}/scripts/validate-week2.sh"

# Verify Week 1 scripts still present
check_file "scripts/setup-ros2-rmf.sh (Semana 1)" \
  "${REPO_ROOT}/scripts/setup-ros2-rmf.sh"

check_file "scripts/validate-week1.sh (Semana 1)" \
  "${REPO_ROOT}/scripts/validate-week1.sh"

# ── Section 4: Documentation ──────────────────────────────────────────────────
echo ""
echo "── Documentation ──────────────────────────────────────────────────────"

check_file "docs/troubleshooting-backend.md" \
  "${REPO_ROOT}/docs/troubleshooting-backend.md"

check_file "docs/auth-spec.md (Semana 1)" \
  "${REPO_ROOT}/docs/auth-spec.md"

check_file "docs/performance-benchmark-report.md (Semana 1)" \
  "${REPO_ROOT}/docs/performance-benchmark-report.md"

# ── Section 5: Ros2 adapter (Week 1 — must not be broken) ────────────────────
echo ""
echo "── Week 1 adapter (regression check) ─────────────────────────────────"

check_file "ros2/freebotics_rmf_adapter/src/freebotics_fleet_adapter.cpp" \
  "${REPO_ROOT}/ros2/freebotics_rmf_adapter/src/freebotics_fleet_adapter.cpp"

check_file "ros2/freebotics_rmf_adapter/config/freebotics.yaml" \
  "${REPO_ROOT}/ros2/freebotics_rmf_adapter/config/freebotics.yaml"

# ── Section 6: Live service checks (only with --with-backend) ─────────────────
echo ""
echo "── Live service checks ────────────────────────────────────────────────"

if [ "$WITH_BACKEND" = false ]; then
  skip "Checks 4-6 skipped — pass --with-backend to test live services"
  echo ""
  echo "  To test with live services:"
  echo "    export RMF_JWT_SECRET=hermes-dev-secret"
  echo "    ros2 launch hermes_backend.launch.py  # or: docker compose up"
  echo "    bash scripts/validate-week2.sh --with-backend"
else
  # Check 4: API Server
  RMF_TOKEN="${RMF_TOKEN:-}"
  AUTH_ARGS=()
  if [ -n "$RMF_TOKEN" ]; then
    AUTH_ARGS=(-H "Authorization: Bearer ${RMF_TOKEN}")
  fi

  if curl -sf --max-time 5 "${AUTH_ARGS[@]}" "${RMF_URL}/health" > /dev/null 2>&1 || \
     curl -sf --max-time 5 "${AUTH_ARGS[@]}" "${RMF_URL}/alive" > /dev/null 2>&1; then
    ok "API Server responde em ${RMF_URL}"
  else
    fail "API Server não responde em ${RMF_URL}"
  fi

  # Check 5: Fleet State returns valid JSON with robots field
  FLEET_BODY=$(curl -sf --max-time 5 "${AUTH_ARGS[@]}" "${RMF_URL}/fleets" 2>/dev/null || \
               curl -sf --max-time 5 "${AUTH_ARGS[@]}" "${RMF_URL}/fleet_states" 2>/dev/null || \
               echo "")
  if echo "$FLEET_BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    ok "Fleet State retorna JSON válido"
  else
    fail "Fleet State não retorna JSON válido"
  fi

  # Check 6: rosbridge port 9090
  if command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ':9090'; then
    ok "rosbridge responde em :9090"
  elif command -v nc &>/dev/null && nc -z localhost 9090 2>/dev/null; then
    ok "rosbridge responde em :9090"
  else
    fail "rosbridge não responde em :9090"
    echo "         Diagnóstico: ros2 node list | grep rosbridge"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "======================================================================"
if [ "$FAILED" -eq 0 ]; then
  echo -e "  ${GREEN}✅ Semana 2 completa — pronto para Semana 3 (Frontend)${NC}"
  echo ""
  echo "  Próximos passos (Semana 3):"
  echo "    1. npm run dev  → abrir http://localhost:5173"
  echo "    2. Confirmar que VITE_RMF_API_URL=http://localhost:${RMF_URL##*:}"
  echo "    3. Desenvolver useFleetState e integrar Zustand store"
else
  echo -e "  ${RED}❌ ${FAILED} check(s) falharam${NC}"
  echo ""
  echo "  Consulte: docs/troubleshooting-backend.md"
  echo "  Semana 1: bash scripts/validate-week1.sh"
fi
echo "======================================================================"
echo ""

exit "$FAILED"
