#!/usr/bin/env bash
# =============================================================================
# setup-ros2-rmf.sh — ROS 2 Humble + open-RMF setup for Debian Unstable (sid)
#
# Idempotent: safe to run multiple times. Each step is skipped if already done.
# Run as a regular user with sudo access (NOT as root).
#
# Usage:
#   chmod +x scripts/setup-ros2-rmf.sh
#   ./scripts/setup-ros2-rmf.sh
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # no colour

ok()   { echo -e "  ${GREEN}[OK]${NC}    $*"; }
skip() { echo -e "  ${YELLOW}[SKIP]${NC}  $*"; }
fail() { echo -e "  ${RED}[FAIL]${NC}  $*"; STEP_FAILED+=("$*"); }
info() { echo -e "          $*"; }

STEP_FAILED=()

# ── Configuration ─────────────────────────────────────────────────────────────
ROS_DISTRO="humble"
WORKSPACE="$HOME/hermes_ws"
ROS_INSTALL="/opt/ros/${ROS_DISTRO}"

echo ""
echo "============================================================"
echo "  Hermes — ROS 2 + open-RMF Setup  (Debian Unstable)"
echo "  ROS distro : ${ROS_DISTRO}"
echo "  Workspace  : ${WORKSPACE}"
echo "============================================================"
echo ""

# =============================================================================
# STEP 1: Verify system prerequisites
# =============================================================================
echo "── Step 1: System prerequisites ──────────────────────────────"

if command -v lsb_release &>/dev/null; then
  DISTRO=$(lsb_release -is 2>/dev/null || echo "Unknown")
  CODENAME=$(lsb_release -cs 2>/dev/null || echo "unknown")
  info "Detected: ${DISTRO} ${CODENAME}"
  if [[ "$DISTRO" != "Debian" ]]; then
    info "Warning: this script targets Debian Unstable. Behaviour on ${DISTRO} may differ."
  fi
fi

# Required tools
for pkg in curl gnupg2 lsb-release git python3-pip; do
  if dpkg -s "$pkg" &>/dev/null; then
    skip "$pkg already installed"
  else
    info "Installing $pkg..."
    if sudo apt-get install -y "$pkg"; then
      ok "$pkg installed"
    else
      fail "Could not install $pkg"
    fi
  fi
done

# =============================================================================
# STEP 2: ROS 2 Humble
# =============================================================================
echo ""
echo "── Step 2: ROS 2 Humble ───────────────────────────────────────"

if [[ -f "${ROS_INSTALL}/setup.bash" ]]; then
  skip "ROS 2 Humble already installed at ${ROS_INSTALL}"
else
  info "Adding Open Robotics apt key and repository..."
  info "NOTE: Debian Unstable (sid) is not an official ROS target."
  info "      The Ubuntu Jammy (22.04) packages usually work on Debian sid."
  info "      If installation fails, use the source install:"
  info "      https://docs.ros.org/en/humble/Installation/Alternatives/Ubuntu-Development-Setup.html"
  echo ""

  # Add GPG key
  if [[ ! -f /usr/share/keyrings/ros-archive-keyring.gpg ]]; then
    curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
      | sudo gpg --dearmor -o /usr/share/keyrings/ros-archive-keyring.gpg
    ok "ROS GPG key added"
  else
    skip "ROS GPG key already present"
  fi

  # Add apt source (using Ubuntu Jammy packages on Debian sid)
  ROS_SOURCE="/etc/apt/sources.list.d/ros2.list"
  if [[ ! -f "${ROS_SOURCE}" ]]; then
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] \
https://packages.ros.org/ros2/ubuntu jammy main" \
      | sudo tee "${ROS_SOURCE}" > /dev/null
    ok "ROS 2 apt source added (Ubuntu Jammy → works on Debian sid)"
  else
    skip "ROS 2 apt source already present"
  fi

  sudo apt-get update

  if sudo apt-get install -y ros-humble-ros-base; then
    ok "ROS 2 Humble base installed"
  else
    fail "ROS 2 Humble installation failed — see note above about source install"
    echo ""
    info "Alternative: use the Docker environment at docker/docker-compose.yml"
    info "which bundles ROS 2 + open-RMF without host installation."
  fi
fi

# Source ROS 2 for subsequent steps
# shellcheck source=/dev/null
if [[ -f "${ROS_INSTALL}/setup.bash" ]]; then
  source "${ROS_INSTALL}/setup.bash"
  ok "ROS 2 Humble sourced"
else
  fail "Cannot source ${ROS_INSTALL}/setup.bash — ROS 2 not installed"
  echo ""
  echo "  Cannot continue without ROS 2. Fix step 2 before re-running."
  exit 1
fi

# =============================================================================
# STEP 3: open-RMF dependencies via apt
# =============================================================================
echo ""
echo "── Step 3: open-RMF packages ──────────────────────────────────"

# These packages are available as binaries in the Open Robotics apt repo
RMF_APT_PACKAGES=(
  "ros-${ROS_DISTRO}-rmf-fleet-msgs"
  "ros-${ROS_DISTRO}-rosbridge-suite"
  "ros-${ROS_DISTRO}-nav2-bringup"
  "ros-${ROS_DISTRO}-rmf-fleet-adapter"
  "ros-${ROS_DISTRO}-rmf-task"
  "ros-${ROS_DISTRO}-rmf-traffic"
)

# The API server may not be available as a binary; handled separately below
OPTIONAL_APT_PACKAGES=(
  "ros-${ROS_DISTRO}-rmf-api-server"
)

for pkg in "${RMF_APT_PACKAGES[@]}"; do
  if dpkg -s "$pkg" &>/dev/null; then
    skip "$pkg already installed"
  else
    if sudo apt-get install -y "$pkg"; then
      ok "$pkg installed"
    else
      fail "$pkg — not available via apt (may need source build)"
    fi
  fi
done

for pkg in "${OPTIONAL_APT_PACKAGES[@]}"; do
  if dpkg -s "$pkg" &>/dev/null; then
    skip "$pkg already installed"
  elif sudo apt-get install -y "$pkg" 2>/dev/null; then
    ok "$pkg installed"
  else
    info "  $pkg not available via apt — will try pip/source install"
    # Try pip install for rmf-api-server (it is a Python package)
    if pip3 install rmf-api-server 2>/dev/null; then
      ok "rmf-api-server installed via pip"
    else
      info "  Install rmf-api-server manually from:"
      info "  https://github.com/open-rmf/rmf-web/tree/main/packages/api-server"
      info "  Or use the Docker image: docker/docker-compose.yml"
      skip "$pkg — skipped (Docker alternative available)"
    fi
  fi
done

# rosdep for resolving remaining dependencies
if ! command -v rosdep &>/dev/null; then
  if sudo apt-get install -y python3-rosdep; then
    ok "rosdep installed"
  else
    fail "rosdep installation failed"
  fi
fi

if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then
  sudo rosdep init
  ok "rosdep initialized"
else
  skip "rosdep already initialized"
fi

rosdep update --rosdistro="${ROS_DISTRO}"
ok "rosdep updated"

# =============================================================================
# STEP 4: Create workspace and clone rmf_demos
# =============================================================================
echo ""
echo "── Step 4: Workspace + rmf_demos ─────────────────────────────"

mkdir -p "${WORKSPACE}/src"
ok "Workspace directory: ${WORKSPACE}"

RMF_DEMOS_DIR="${WORKSPACE}/src/rmf_demos"
if [[ -d "${RMF_DEMOS_DIR}/.git" ]]; then
  skip "rmf_demos already cloned — pulling latest..."
  git -C "${RMF_DEMOS_DIR}" pull --ff-only 2>/dev/null || info "  (already up to date)"
else
  if git clone https://github.com/open-rmf/rmf_demos.git "${RMF_DEMOS_DIR}"; then
    ok "rmf_demos cloned"
  else
    fail "Failed to clone rmf_demos"
  fi
fi

# Install rmf_demos dependencies
if (cd "${WORKSPACE}" && rosdep install --from-paths src --ignore-src -y --rosdistro="${ROS_DISTRO}" 2>/dev/null); then
  ok "rmf_demos rosdep dependencies installed"
else
  info "  Some rosdep deps failed — continuing (may be OK for build)"
fi

# =============================================================================
# STEP 5: Build workspace (rmf_demos + freebotics_rmf_adapter)
# =============================================================================
echo ""
echo "── Step 5: Build workspace ────────────────────────────────────"

# Symlink our adapter package into the workspace
ADAPTER_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/ros2/freebotics_rmf_adapter"
ADAPTER_LINK="${WORKSPACE}/src/freebotics_rmf_adapter"

if [[ -L "${ADAPTER_LINK}" || -d "${ADAPTER_LINK}" ]]; then
  skip "freebotics_rmf_adapter already in workspace"
else
  ln -s "${ADAPTER_SRC}" "${ADAPTER_LINK}"
  ok "freebotics_rmf_adapter symlinked into workspace"
fi

if ! command -v colcon &>/dev/null; then
  if pip3 install colcon-common-extensions; then
    ok "colcon installed via pip"
  else
    fail "colcon not found — install with: pip3 install colcon-common-extensions"
  fi
fi

info "Building workspace (this may take several minutes)..."
if (cd "${WORKSPACE}" && colcon build \
    --symlink-install \
    --packages-select rmf_demos_gz freebotics_rmf_adapter \
    --cmake-args -DCMAKE_BUILD_TYPE=Release \
    2>&1 | tee /tmp/hermes_build.log | grep -E "Starting|Finished|Failed|Error" || true); then
  # Check if our adapter specifically built
  if [[ -f "${WORKSPACE}/install/freebotics_rmf_adapter/lib/freebotics_rmf_adapter/freebotics_fleet_adapter" ]]; then
    ok "freebotics_fleet_adapter built successfully"
  else
    fail "freebotics_fleet_adapter binary not found — check /tmp/hermes_build.log"
  fi
else
  fail "colcon build failed — check /tmp/hermes_build.log"
fi

# =============================================================================
# STEP 6: Smoke test
# =============================================================================
echo ""
echo "── Step 6: Smoke test ─────────────────────────────────────────"

INSTALL_SETUP="${WORKSPACE}/install/setup.bash"
if [[ -f "${INSTALL_SETUP}" ]]; then
  # shellcheck source=/dev/null
  source "${INSTALL_SETUP}"
  ok "Workspace install sourced"
else
  fail "Workspace install/setup.bash not found — build did not complete"
fi

if ros2 pkg list 2>/dev/null | grep -q "freebotics_rmf_adapter"; then
  ok "freebotics_rmf_adapter visible to ros2 pkg list"
else
  fail "freebotics_rmf_adapter not found in ros2 pkg list"
fi

info "Run this to start the office simulation (2 simulated robots):"
info "  source ~/hermes_ws/install/setup.bash"
info "  ros2 launch rmf_demos_gz office.launch.xml"
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "============================================================"
if [[ ${#STEP_FAILED[@]} -eq 0 ]]; then
  ok "Setup complete — all steps passed"
  echo ""
  echo "  Next steps:"
  echo "  1. Add to ~/.bashrc:"
  echo "       source /opt/ros/humble/setup.bash"
  echo "       source ~/hermes_ws/install/setup.bash"
  echo "  2. Run: bash scripts/validate-week1.sh"
  echo "  3. Launch the adapter:"
  echo "       ros2 launch freebotics_rmf_adapter adapter.launch.py"
else
  echo -e "  ${RED}Setup completed with ${#STEP_FAILED[@]} failure(s):${NC}"
  for f in "${STEP_FAILED[@]}"; do
    echo -e "    ${RED}✗${NC} $f"
  done
  echo ""
  echo "  Fix the failures above, then re-run this script."
  echo "  Alternatively, use the Docker environment: docker/docker-compose.yml"
fi
echo "============================================================"
echo ""
