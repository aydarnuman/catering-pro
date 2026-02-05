#!/bin/bash
# Pre-Build Checker - Shell Script
# Build oncesi type, lint ve cakisma kontrollerini yapar

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Proje dizini
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo ""
echo -e "${CYAN}  Pre-Build Checker${NC}"
echo -e "${DIM}  ═══════════════════════════════════════${NC}"
echo ""

ERRORS=0
WARNINGS=0

# 1. TypeScript Check
echo -n -e "  ${DIM}[1/4]${NC} TypeScript Check...      "
cd "$PROJECT_ROOT/frontend"
if npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 0 errors"
else
    TS_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
    TS_ERRORS=$(echo "$TS_OUTPUT" | grep -c "error TS" || echo "0")
    echo -e "${RED}✗${NC} $TS_ERRORS errors"
    ERRORS=$((ERRORS + TS_ERRORS))
fi
cd "$PROJECT_ROOT"

# 2. Frontend Lint Check
echo -n -e "  ${DIM}[2/4]${NC} Frontend Lint...         "
cd "$PROJECT_ROOT/frontend"
if npx biome check src/ 2>/dev/null; then
    echo -e "${GREEN}✓${NC} No issues"
else
    LINT_OUTPUT=$(npx biome check src/ 2>&1 || true)
    LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "Found.*error" || echo "0")
    if [ "$LINT_ERRORS" -gt 0 ]; then
        echo -e "${RED}✗${NC} Has errors"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${YELLOW}⚠${NC} Has warnings"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
cd "$PROJECT_ROOT"

# 3. Backend Lint Check
echo -n -e "  ${DIM}[3/4]${NC} Backend Lint...          "
cd "$PROJECT_ROOT/backend"
if npx biome check src/ 2>/dev/null; then
    echo -e "${GREEN}✓${NC} No issues"
else
    LINT_OUTPUT=$(npx biome check src/ 2>&1 || true)
    LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "Found.*error" || echo "0")
    if [ "$LINT_ERRORS" -gt 0 ]; then
        echo -e "${RED}✗${NC} Has errors"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${YELLOW}⚠${NC} Has warnings"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
cd "$PROJECT_ROOT"

# 4. Git Conflict Check
echo -n -e "  ${DIM}[4/4]${NC} Conflict Check...        "
CONFLICTS=$(grep -rn "^<<<<<<< \|^=======$\|^>>>>>>> " --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" frontend/src backend/src 2>/dev/null | wc -l || echo "0")
CONFLICTS=$(echo "$CONFLICTS" | tr -d ' ')
if [ "$CONFLICTS" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No conflicts"
else
    echo -e "${RED}✗${NC} $CONFLICTS conflict markers found"
    ERRORS=$((ERRORS + CONFLICTS))
fi

# Sonuc
echo ""
echo -e "${DIM}  ═══════════════════════════════════════${NC}"

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}  Result: FAILED ($ERRORS errors)${NC}"
    echo ""
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}  Result: PASSED ($WARNINGS warnings)${NC}"
    echo ""
    exit 0
else
    echo -e "${GREEN}  Result: PASSED${NC}"
    echo ""
    exit 0
fi
