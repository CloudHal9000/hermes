#!/usr/bin/env bash
# =============================================================================
# setup-ros2-rmf.sh — Hermes prerequisite checker
#
# Verifies that all external services required by the Hermes dashboard are
# reachable and configured. Does NOT install anything.
#
# For installation instructions:
#   docs/infrastructure-requirements.md
#
# Usage:
#   bash scripts/setup-ros2-rmf.sh
# =============================================================================

set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

COUNT_OK=0
COUNT_WARN=0
COUNT_FAIL=0

ok()   { echo -e "  ${GREEN}[OK]${NC}   $*";   COUNT_OK=$((COUNT_OK + 1)); }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $*";  COUNT_WARN=$((COUNT_WARN + 1)); }
fail() { echo -e "  ${RED}[FAIL]${NC} $*";    COUNT_FAIL=$((COUNT_FAIL + 1)); }
info() { echo -e "  ${CYAN}[INFO]${NC} $*"; }

echo ""
echo "=== Hermes — Verificação de Pré-requisitos ==========================="
echo ""

# =============================================================================
# CHECK 1: ROS 2 Humble
# =============================================================================
echo "── ROS 2 ──────────────────────────────────────────────────────────────"

ROS_SETUP="/opt/ros/humble/setup.bash"

if [[ -f "${ROS_SETUP}" ]]; then
  # shellcheck source=/dev/null
  ROS_VERSION=$(source "${ROS_SETUP}" 2>/dev/null && ros2 --version 2>/dev/null || echo "")
  if [[ -n "$ROS_VERSION" ]]; then
    ok "ROS 2 Humble detectado — ${ROS_VERSION}"
  else
    warn "ROS 2 Humble instalado mas 'ros2 --version' falhou"
    info "Tentar: source /opt/ros/humble/setup.bash"
  fi
else
  # Check for other ROS 2 distros
  if command -v ros2 &>/dev/null; then
    ACTIVE_DISTRO=$(ros2 --version 2>/dev/null || echo "unknown")
    warn "ROS 2 detectado mas não é Humble: ${ACTIVE_DISTRO}"
    info "Hermes foi validado com ROS 2 Humble (22.04)"
    info "Ver: docs/infrastructure-requirements.md#ros2"
  else
    fail "ROS 2 Humble não encontrado em /opt/ros/humble"
    info "Ver: docs/infrastructure-requirements.md#opcao-1-bare-metal"
    info "Ref: https://docs.ros.org/en/humble/Installation.html"
  fi
fi

# =============================================================================
# CHECK 2: freebotics_rmf_adapter compilado
# =============================================================================
echo ""
echo "── freebotics_rmf_adapter ─────────────────────────────────────────────"

ADAPTER_BIN="${HOME}/hermes_ws/install/freebotics_rmf_adapter/lib/freebotics_rmf_adapter/freebotics_fleet_adapter"

if [[ -f "${ADAPTER_BIN}" ]]; then
  ok "freebotics_rmf_adapter compilado em ~/hermes_ws"
else
  fail "Binário não encontrado: ${ADAPTER_BIN}"
  info "Compilar com:"
  info "  source /opt/ros/humble/setup.bash"
  info "  cd ~/hermes_ws && colcon build --packages-select freebotics_rmf_adapter"
fi

# =============================================================================
# CHECK 3: RMF API Server em :7878
# =============================================================================
echo ""
echo "── RMF API Server ─────────────────────────────────────────────────────"

# Try :7878 (native ROS 2) then :8000 (Docker dev)
RMF_PORT=""
if curl -sf --max-time 2 "http://localhost:7878/health" &>/dev/null || \
   curl -sf --max-time 2 "http://localhost:7878/alive"  &>/dev/null; then
  RMF_PORT="7878"
  ok "RMF API Server acessível em :7878"
elif curl -sf --max-time 2 "http://localhost:8000/health" &>/dev/null || \
     curl -sf --max-time 2 "http://localhost:8000/alive"  &>/dev/null; then
  RMF_PORT="8000"
  ok "RMF API Server acessível em :8000 (Docker dev)"
  warn "A porta padrão do Hermes é :7878 — atualizar VITE_RMF_API_URL em .env.local"
  info "Ver: docs/infrastructure-requirements.md#porta-7878-vs-8000"
else
  fail "RMF API Server não responde em :7878 nem :8000"
  info "Iniciar com:"
  info "  ros2 launch ros2/launch/hermes_backend.launch.py"
  info "  ou: docker compose -f docker/docker-compose.yml up"
  info "Ver: docs/infrastructure-requirements.md"
fi

# =============================================================================
# CHECK 4: rosbridge em :9090
# =============================================================================
echo ""
echo "── rosbridge WebSocket ────────────────────────────────────────────────"

ROSBRIDGE_OK=false

# Try TCP port check (no WebSocket handshake needed to confirm port is open)
if command -v nc &>/dev/null && nc -z -w2 localhost 9090 &>/dev/null; then
  ROSBRIDGE_OK=true
elif command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ':9090'; then
  ROSBRIDGE_OK=true
elif curl -sf --max-time 2 "http://localhost:9090" &>/dev/null 2>&1; then
  ROSBRIDGE_OK=true
fi

if [ "$ROSBRIDGE_OK" = true ]; then
  ok "rosbridge acessível em :9090"
else
  fail "rosbridge não acessível em :9090"
  info "Iniciar com:"
  info "  ros2 launch rosbridge_server rosbridge_websocket_launch.xml"
  info "  ou via: ros2 launch ros2/launch/hermes_backend.launch.py"
fi

# =============================================================================
# CHECK 5: RMF_JWT_SECRET definido no ambiente
# =============================================================================
echo ""
echo "── Autenticação ───────────────────────────────────────────────────────"

if [[ -n "${RMF_JWT_SECRET:-}" ]]; then
  ok "RMF_JWT_SECRET definido no ambiente"
else
  warn "RMF_JWT_SECRET não definido — API Server vai recusar requests autenticados"
  info "Definir com: export RMF_JWT_SECRET=sua-chave-aqui"
  info "Para persistir: adicionar ao ~/.bashrc ou ao script de startup"
  info "Ver: docs/infrastructure-requirements.md#gerando-jwt-token"
fi

# =============================================================================
# CHECK 6: VITE_RMF_TOKEN em .env.local
# =============================================================================

if [[ -f ".env.local" ]]; then
  if grep -q "VITE_RMF_TOKEN" .env.local 2>/dev/null && \
     ! grep -q "VITE_RMF_TOKEN=your-" .env.local 2>/dev/null && \
     ! grep -q "VITE_RMF_TOKEN=$" .env.local 2>/dev/null; then
    ok "VITE_RMF_TOKEN presente em .env.local"
  else
    warn "VITE_RMF_TOKEN ausente ou com valor placeholder em .env.local"
    info "Frontend vai operar sem autenticação"
    info "Ver: docs/auth-spec.md e docs/infrastructure-requirements.md#jwt"
  fi
else
  warn ".env.local não encontrado — frontend vai usar variáveis padrão"
  info "Criar: cp .env.example .env.local"
  info "Preencher VITE_RMF_API_URL, VITE_RMF_WS_URL e VITE_RMF_TOKEN"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "======================================================================"
echo "  Resumo:"
echo -e "    ${GREEN}OK:${NC}   ${COUNT_OK} check(s)"
echo -e "    ${YELLOW}WARN:${NC} ${COUNT_WARN} check(s)"
echo -e "    ${RED}FAIL:${NC} ${COUNT_FAIL} check(s)"
echo ""

if [[ "$COUNT_FAIL" -gt 0 ]]; then
  echo -e "  ${RED}❌ Pré-requisitos incompletos — serviços bloqueantes ausentes${NC}"
  echo ""
  echo "  Ver: docs/infrastructure-requirements.md"
elif [[ "$COUNT_WARN" -gt 0 ]]; then
  echo -e "  ${YELLOW}⚠️  Hermes pode rodar com funcionalidade reduzida${NC}"
  echo ""
  echo "  Resolver os WARNs acima para funcionamento completo."
else
  echo -e "  ${GREEN}✅ Todos os pré-requisitos atendidos — pode iniciar o Hermes${NC}"
  echo ""
  echo "  npm run dev  →  http://localhost:5173"
fi
echo "======================================================================"
echo ""

exit "$COUNT_FAIL"
