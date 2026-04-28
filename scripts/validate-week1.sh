#!/usr/bin/env bash
# =============================================================================
# validate-week1.sh — Automated checklist for Hermes Week 1 completion
#
# Run after setup-ros2-rmf.sh and after compiling the workspace.
# Each check prints [OK], [SKIP], or [FAIL] with a description.
#
# Usage:
#   bash scripts/validate-week1.sh
# =============================================================================

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

FAILED=0

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo -e "  ${GREEN}[OK]${NC}   $desc"
  else
    echo -e "  ${RED}[FAIL]${NC} $desc"
    FAILED=$((FAILED + 1))
  fi
}

echo ""
echo "=== Hermes — Validação Semana 1 ==================================="
echo ""

# ── 1. ROS 2 Humble ─────────────────────────────────────────────────────────
echo "── ROS 2 Humble ────────────────────────────────────────────────────"

check "ROS 2 Humble instalado (/opt/ros/humble/setup.bash)" \
  "test -f /opt/ros/humble/setup.bash"

check "ROS 2 Humble sourced e ros2 CLI disponível" \
  "source /opt/ros/humble/setup.bash && ros2 --version"

# ── 2. open-RMF packages ──────────────────────────────────────────────────────
echo ""
echo "── open-RMF packages ───────────────────────────────────────────────"

check "rmf_fleet_msgs disponível" \
  "source /opt/ros/humble/setup.bash && ros2 pkg list | grep -q rmf_fleet_msgs"

check "rmf_fleet_adapter disponível" \
  "source /opt/ros/humble/setup.bash && ros2 pkg list | grep -q rmf_fleet_adapter"

check "rosbridge_suite disponível" \
  "source /opt/ros/humble/setup.bash && ros2 pkg list | grep -q rosbridge_suite"

check "nav2_bringup disponível" \
  "source /opt/ros/humble/setup.bash && ros2 pkg list | grep -q nav2_bringup"

# rmf_api_server may be a Python package (not a ROS package)
if source /opt/ros/humble/setup.bash && ros2 pkg list 2>/dev/null | grep -q rmf_api_server; then
  echo -e "  ${GREEN}[OK]${NC}   rmf_api_server disponível (ROS package)"
elif python3 -c "import api_server" 2>/dev/null || command -v rmf_api_server &>/dev/null; then
  echo -e "  ${GREEN}[OK]${NC}   rmf_api_server disponível (Python package)"
else
  echo -e "  ${RED}[FAIL]${NC} rmf_api_server não encontrado — usar Docker: docker/docker-compose.yml"
  FAILED=$((FAILED + 1))
fi

# ── 3. Workspace ──────────────────────────────────────────────────────────────
echo ""
echo "── Workspace ───────────────────────────────────────────────────────"

ADAPTER_BIN="$HOME/hermes_ws/install/freebotics_rmf_adapter/lib/freebotics_rmf_adapter/freebotics_fleet_adapter"

check "freebotics_rmf_adapter compilado" \
  "test -f '${ADAPTER_BIN}'"

check "Workspace install/setup.bash presente" \
  "test -f '$HOME/hermes_ws/install/setup.bash'"

check "rmf_demos no workspace" \
  "source $HOME/hermes_ws/install/setup.bash 2>/dev/null && ros2 pkg list | grep -q rmf_demos"

# ── 4. freebotics_rmf_adapter functional test ─────────────────────────────────
echo ""
echo "── freebotics_fleet_adapter smoke test ─────────────────────────────"

# Launch with 3-second timeout and check for the startup INFO log
check "freebotics_fleet_adapter lança sem crash e loga inicialização" \
  "source /opt/ros/humble/setup.bash && \
   source $HOME/hermes_ws/install/setup.bash && \
   timeout 3 ros2 run freebotics_rmf_adapter freebotics_fleet_adapter \
     --ros-args \
     --params-file $(cd "$(dirname "$0")/.." && pwd)/ros2/freebotics_rmf_adapter/config/freebotics.yaml \
     2>&1 | grep -q 'Fleet Adapter initialized'"

# ── 5. Hermes repo structure ──────────────────────────────────────────────────
echo ""
echo "── Hermes repo structure ───────────────────────────────────────────"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

check "ros2/freebotics_rmf_adapter/CMakeLists.txt existe" \
  "test -f '${REPO_ROOT}/ros2/freebotics_rmf_adapter/CMakeLists.txt'"

check "ros2/freebotics_rmf_adapter/src/freebotics_fleet_adapter.cpp existe" \
  "test -f '${REPO_ROOT}/ros2/freebotics_rmf_adapter/src/freebotics_fleet_adapter.cpp'"

check "scripts/setup-ros2-rmf.sh é executável" \
  "test -x '${REPO_ROOT}/scripts/setup-ros2-rmf.sh'"

check "docker/docker-compose.yml existe" \
  "test -f '${REPO_ROOT}/docker/docker-compose.yml'"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "==================================================================="
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ Semana 1 completa — pronto para Semana 2${NC}"
  echo ""
  echo "  Próximos passos (Semana 2):"
  echo "    1. Iniciar RMF API Server: docker compose -f docker/docker-compose.yml up"
  echo "    2. Lançar adapter: ros2 launch freebotics_rmf_adapter adapter.launch.py"
  echo "    3. Verificar /fleet_states: ros2 topic echo /fleet_states"
  echo "    4. Verificar dashboard: npm run dev → http://localhost:5173"
else
  echo -e "  ${RED}❌ ${FAILED} check(s) falharam — ver erros acima${NC}"
  echo ""
  echo "  Dica: rodar setup-ros2-rmf.sh para corrigir dependências faltando"
  echo "        ou usar: docker compose -f docker/docker-compose.yml up"
fi
echo "==================================================================="
echo ""

exit "$FAILED"
