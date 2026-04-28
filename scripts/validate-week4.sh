#!/usr/bin/env bash
# =============================================================================
# validate-week4.sh — Hermes Week 4 checklist (Integration: Map3D + App + MVP)
# =============================================================================

set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
FAILED=0

ok()   { echo -e "  ${GREEN}[OK]${NC}  $*"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $*"; FAILED=$((FAILED + 1)); }

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null 2>&1; then ok "$desc"; else fail "$desc"; fi
}

REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "=== Hermes — Validação Semana 4 (Integração Final MVP) ==============="
echo ""

# ── Estrutura ─────────────────────────────────────────────────────────────────
echo "── Novos arquivos ─────────────────────────────────────────────────────"

check "useMultiRobotModel existe" \
  "test -f '${REPO}/src/components/navigation/map-layers/useMultiRobotModel.js'"

# ── Map3D integrado ───────────────────────────────────────────────────────────
echo ""
echo "── Map3D integrado ────────────────────────────────────────────────────"

check "Map3D não importa useTfGraph" \
  "! grep -q 'useTfGraph' '${REPO}/src/components/navigation/Map3D.jsx'"

check "Map3D importa useRMFPoses" \
  "grep -q 'useRMFPoses' '${REPO}/src/components/navigation/Map3D.jsx'"

check "Map3D importa useFleetState" \
  "grep -q 'useFleetState' '${REPO}/src/components/navigation/Map3D.jsx'"

check "Map3D usa useMultiRobotModel" \
  "grep -q 'useMultiRobotModel' '${REPO}/src/components/navigation/Map3D.jsx'"

# ── useNavigationTool migrado ─────────────────────────────────────────────────
echo ""
echo "── useNavigationTool migrado ──────────────────────────────────────────"

check "useNavigationTool não publica via goalTopic.publish" \
  "! grep -q 'goalTopic\.publish' '${REPO}/src/components/navigation/map-layers/useNavigationTool.js'"

check "useNavigationTool não usa navigate_to_pose topic" \
  "! grep -q 'navigate_to_pose' '${REPO}/src/components/navigation/map-layers/useNavigationTool.js'"

check "useNavigationTool usa createTask" \
  "grep -q 'createTask' '${REPO}/src/components/navigation/map-layers/useNavigationTool.js'"

# ── App.jsx integrado ─────────────────────────────────────────────────────────
echo ""
echo "── App.jsx integrado ──────────────────────────────────────────────────"

check "App.jsx importa useRMFApi" \
  "grep -q 'useRMFApi' '${REPO}/src/App.jsx'"

check "App.jsx importa useFleetState (hooks/)" \
  "grep -q \"from './hooks/useFleetState'\" '${REPO}/src/App.jsx'"

check "App.jsx renderiza TaskManager" \
  "grep -q 'TaskManager' '${REPO}/src/App.jsx'"

check "App.jsx tem comentário LEGACY (useRos mantido)" \
  "grep -q 'LEGACY' '${REPO}/src/App.jsx'"

# ── FleetSelector tem modo RMF ────────────────────────────────────────────────
echo ""
echo "── FleetSelector modo RMF ─────────────────────────────────────────────"

check "FleetSelector detecta modo RMF (campo fleet)" \
  "grep -q 'isRMFMode\|fleet' '${REPO}/src/components/fleet/FleetSelector.jsx'"

# ── CLAUDE.md atualizado ──────────────────────────────────────────────────────
echo ""
echo "── Documentação ───────────────────────────────────────────────────────"

check "CLAUDE.md menciona open-RMF" \
  "grep -q 'open-RMF' '${REPO}/CLAUDE.md'"

check "CLAUDE.md menciona useRMFApi" \
  "grep -q 'useRMFApi' '${REPO}/CLAUDE.md'"

check "CLAUDE.md menciona useMultiRobotModel" \
  "grep -q 'useMultiRobotModel' '${REPO}/CLAUDE.md'"

# ── Build e testes ────────────────────────────────────────────────────────────
echo ""
echo "── Build e testes ─────────────────────────────────────────────────────"

if (cd "${REPO}" && npm run build 2>&1 | grep -q 'built in'); then
  ok "npm run build sem erros"
else
  fail "npm run build falhou"
fi

WEEK4_FILES=(
  "src/App.jsx"
  "src/components/navigation/Map3D.jsx"
  "src/components/fleet/FleetSelector.jsx"
  "src/components/navigation/map-layers/useMultiRobotModel.js"
  "src/components/navigation/map-layers/useNavigationTool.js"
  "src/components/navigation/map-layers/useLidarLayer.js"
)
LINT_ERRORS=$(cd "${REPO}" && npx eslint "${WEEK4_FILES[@]}" 2>&1 \
  | grep -E '^\s+[0-9]+:[0-9]+\s+error' || true)
if [[ -z "$LINT_ERRORS" ]]; then
  ok "Arquivos da Semana 4 sem erros de lint"
else
  fail "Erros de lint nos arquivos da Semana 4"
  echo "$LINT_ERRORS" | head -5 | sed 's/^/         /'
fi

TEST_OUTPUT=$(cd "${REPO}" && npm run test:run 2>&1)
TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -E '^\s+Tests\s+.*\bfailed\b' || true)
# Parse "Tests: XX passed" line (not "Test Files: X passed")
NPASS=$(echo "$TEST_OUTPUT" | grep -E '^\s+Tests\s+[0-9]+ passed' | grep -oE '[0-9]+' | head -1 || echo "0")
if [[ -z "$TEST_FAILED" ]] && [[ "${NPASS:-0}" -ge 32 ]]; then
  ok "npm run test:run — ${NPASS} testes passam"
else
  fail "Falhas nos testes ou cobertura < 32 (atual: ${NPASS:-0})"
  echo "$TEST_OUTPUT" | grep -E 'FAIL|Error' | head -5 | sed 's/^/         /'
fi

# ── Resumo ─────────────────────────────────────────────────────────────────────
echo ""
echo "======================================================================"
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ MVP completo — Hermes pronto para uso com open-RMF${NC}"
  echo ""
  echo "  Para iniciar:"
  echo "    docker compose -f docker/docker-compose.yml up"
  echo "    npm run dev  →  http://localhost:5173"
else
  echo -e "  ${RED}❌ ${FAILED} check(s) falharam${NC}"
  echo ""
  echo "  Consulte: docs/troubleshooting-backend.md"
fi
echo "======================================================================"
echo ""

exit "$FAILED"
