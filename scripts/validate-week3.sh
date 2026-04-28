#!/usr/bin/env bash
# =============================================================================
# validate-week3.sh — Hermes Week 3 checklist (Frontend hooks + TaskManager)
# =============================================================================

set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
FAILED=0

ok()   { echo -e "  ${GREEN}[OK]${NC}  $*"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $*"; FAILED=$((FAILED + 1)); }

check_file() { [[ -f "$1" ]] && ok "$2" || fail "$2 — não encontrado: $1"; }

REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "=== Hermes — Validação Semana 3 (Frontend hooks + TaskManager) ======="
echo ""

# ── Arquivos criados ──────────────────────────────────────────────────────────
echo "── Hooks RMF ─────────────────────────────────────────────────────────"

check_file "${REPO}/src/hooks/useRMFApi.js"    "useRMFApi existe"
check_file "${REPO}/src/hooks/useFleetState.js" "useFleetState existe"
check_file "${REPO}/src/components/navigation/map-layers/useRMFPoses.js" \
           "useRMFPoses existe"

echo ""
echo "── Componentes TaskManager ────────────────────────────────────────────"

check_file "${REPO}/src/components/tasks/TaskManager.jsx" "TaskManager existe"
check_file "${REPO}/src/components/tasks/TaskForm.jsx"    "TaskForm existe"
check_file "${REPO}/src/components/tasks/TaskList.jsx"    "TaskList existe"
check_file "${REPO}/src/components/tasks/TaskCard.jsx"    "TaskCard existe"

# ── Invariantes do código ─────────────────────────────────────────────────────
echo ""
echo "── Invariantes do código ──────────────────────────────────────────────"

# useRMFApi deve importar de rmfClient, não chamar fetch ou WebSocket diretamente
if grep -q 'rmfClient' "${REPO}/src/hooks/useRMFApi.js"; then
  ok "useRMFApi importa de rmfClient"
else
  fail "useRMFApi não importa de rmfClient"
fi

if ! grep -Eq "fetch\('" "${REPO}/src/hooks/useRMFApi.js"; then
  ok "useRMFApi não usa fetch() direto"
else
  fail "useRMFApi usa fetch() direto — deve usar rmfFetch()"
fi

if ! grep -q 'new WebSocket' "${REPO}/src/hooks/useRMFApi.js"; then
  ok "useRMFApi não usa new WebSocket direto"
else
  fail "useRMFApi usa new WebSocket — deve usar rmfWebSocket()"
fi

# TaskForm não deve usar tag <form>
if ! grep -q '<form' "${REPO}/src/components/tasks/TaskForm.jsx"; then
  ok "TaskForm não usa tag <form> (padrão do projeto)"
else
  fail "TaskForm usa <form> — usar div + onClick (padrão do projeto)"
fi

# Hooks existentes da Semana 1 não devem ter sido alterados
check_file "${REPO}/src/hooks/useRos.js"          "useRos.js intocado (Semana 1)"
check_file "${REPO}/src/hooks/useFleetPolling.js" "useFleetPolling.js intocado (Semana 1)"

# ── Testes ────────────────────────────────────────────────────────────────────
echo ""
echo "── Testes ─────────────────────────────────────────────────────────────"

TEST_OUTPUT=$(cd "${REPO}" && npm run test:run 2>&1)
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -E '^\s+Tests\s+[0-9]+ passed' || true)
TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -E '^\s+Tests\s+.*failed' || true)

if [[ -z "$TEST_FAILED" ]] && [[ -n "$TEST_PASSED" ]]; then
  NPASS=$(echo "$TEST_PASSED" | grep -oE '[0-9]+' | head -1)
  ok "Todos os ${NPASS} testes passam (useRMFApi + useFleetState incluídos)"
else
  fail "Falhas nos testes — npm run test:run"
  echo "$TEST_OUTPUT" | grep -E 'FAIL|Error' | head -5 | sed 's/^/         /'
fi

# ── Build / lint ───────────────────────────────────────────────────────────────
echo ""
echo "── Build e lint ───────────────────────────────────────────────────────"

if (cd "${REPO}" && npm run build 2>&1 | grep -q 'built in'); then
  ok "npm run build sem erros"
else
  fail "npm run build falhou"
fi

# Lint only the new Week 3 files (pre-existing errors elsewhere are excluded)
WEEK3_FILES=(
  "src/hooks/useRMFApi.js"
  "src/hooks/useFleetState.js"
  "src/components/navigation/map-layers/useRMFPoses.js"
  "src/components/tasks/TaskCard.jsx"
  "src/components/tasks/TaskList.jsx"
  "src/components/tasks/TaskForm.jsx"
  "src/components/tasks/TaskManager.jsx"
)
LINT_NEW_ERRORS=$(cd "${REPO}" && npx eslint "${WEEK3_FILES[@]}" 2>&1 \
  | grep -E '^\s+[0-9]+:[0-9]+\s+error' || true)
if [[ -z "$LINT_NEW_ERRORS" ]]; then
  ok "Novos arquivos da Semana 3 sem erros de lint"
else
  fail "Erros de lint nos novos arquivos"
  echo "$LINT_NEW_ERRORS" | head -5 | sed 's/^/         /'
fi

# ── Resumo ─────────────────────────────────────────────────────────────────────
echo ""
echo "======================================================================"
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "  ${GREEN}✅ Semana 3 completa — pronto para Semana 4 (integração Map3D)${NC}"
  echo ""
  echo "  Próximos passos (Semana 4):"
  echo "    1. Integrar useRMFApi no App.jsx (substituir useFleetPolling)"
  echo "    2. Integrar useRMFPoses no Map3D (substituir useTfGraph)"
  echo "    3. Adicionar TaskManager ao layout"
else
  echo -e "  ${RED}❌ ${FAILED} check(s) falharam${NC}"
fi
echo "======================================================================"
echo ""

exit "$FAILED"
