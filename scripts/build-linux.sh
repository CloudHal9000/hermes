#!/bin/bash

# build-linux.sh — Build Hermes .deb and .AppImage packages for Linux
# Usage: bash scripts/build-linux.sh [--deb | --appimage | --all]
#
# Requires:
#   - Node.js 18+
#   - electron and electron-builder in devDependencies
#   - dist/ directory will be created/overwritten

set -e

# Configuration
TARGET="${1:---all}"
NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")

# ─── Header ───────────────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Hermes Linux Packaging (electron-builder)           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Node.js version: $NODE_VERSION"
echo "Target: $TARGET"
echo ""

# ─── Validation ────────────────────────────────────────────────────────────

echo "[1/3] Validating environment..."

# Check Node.js version (18+)
NODE_MAJOR=$(node --version | grep -oE 'v([0-9]+)' | grep -oE '[0-9]+')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found: v$NODE_MAJOR)"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "ℹ️  node_modules not found, installing..."
  npm install
fi

# Check for essential files
for f in package.json vite.config.js electron/main.js electron/preload.js; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing required file: $f"
    exit 1
  fi
done

echo "✅ Environment validated"
echo ""

# ─── Build frontend ──────────────────────────────────────────────────────────

echo "[2/3] Building frontend (Vite + ELECTRON=true)..."
rm -rf dist
ELECTRON=true npm run build

if [ ! -f "dist/index.html" ]; then
  echo "❌ Frontend build failed: dist/index.html not found"
  exit 1
fi

echo "✅ Frontend built successfully"
echo ""

# ─── Package with electron-builder ─────────────────────────────────────────

echo "[3/3] Packaging with electron-builder..."

case "$TARGET" in
  --deb)
    echo "  → Building .deb package..."
    npx electron-builder --linux deb
    ;;
  --appimage)
    echo "  → Building .AppImage package..."
    npx electron-builder --linux AppImage
    ;;
  *)
    echo "  → Building both .deb and .AppImage..."
    npx electron-builder --linux deb AppImage
    ;;
esac

echo "✅ Packaging complete"
echo ""

# ─── Summary ───────────────────────────────────────────────────────────────

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Build Successfully Complete                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Generated packages:"

# List .deb files
if ls release/*.deb 1> /dev/null 2>&1; then
  for deb in release/*.deb; do
    size=$(du -h "$deb" | cut -f1)
    name=$(basename "$deb")
    echo "   • $name ($size)"
  done
fi

# List .AppImage files
if ls release/*.AppImage 1> /dev/null 2>&1; then
  for appimage in release/*.AppImage; do
    size=$(du -h "$appimage" | cut -f1)
    name=$(basename "$appimage")
    echo "   • $name ($size)"
  done
fi

echo ""
echo "📖 Usage:"
echo ""
echo "   Install .deb:"
echo "   $ sudo dpkg -i release/Hermes-*.deb"
echo "   $ hermes  # Launch from terminal"
echo ""
echo "   Run .AppImage (no installation needed):"
echo "   $ chmod +x release/Hermes-*.AppImage"
echo "   $ ./release/Hermes-*.AppImage"
echo ""
