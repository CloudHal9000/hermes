# VDA5050 Integration Guide

## Overview

**VDA5050** is the industry standard communication protocol for Automated Guided Vehicles (AGVs) and fleet management systems. It enables **interoperability** between robots from different manufacturers and a central fleet controller (like Hermes).

**In Hermes**, VDA5050 support means:
- ✅ Connect any VDA5050-compliant robot (Otto, MiR, OTTO, Fetch, etc.)
- ✅ Robot appears automatically in FleetSelector with a `[VDA5050]` badge
- ✅ Zero configuration in the dashboard — it's plug and play
- ✅ Mix ROS 2 native robots and VDA5050 robots in the same fleet

## Prerequisites

### System Requirements
- **Linux** (Debian/Ubuntu, tested on Debian Unstable)
- **ROS 2 Humble** (installed)
- **Workspace**: `~/hermes_ws` with Hermes cloned

### Software
1. **mosquitto** MQTT broker (lightweight message broker)
2. **vda5050_connector** (ROS 2 package — bridges ROS 2 ↔ VDA5050)

### Network
- Hermes backend and VDA5050 robot on the **same LAN** or routable network
- MQTT port **1883** (unencrypted) open between robot and Hermes

## Installation

### Step 1: Install VDA5050 Dependencies

```bash
bash scripts/install-vda5050.sh
```

This script:
1. Installs **mosquitto** broker (via apt or from source)
2. Installs **vda5050_connector** (via apt or clones + builds from source)
3. Creates MQTT log directory (`/tmp/hermes_mqtt/`)
4. Verifies both components are working

**Output:**
```
[✓] mosquitto installed (2.0.18)
[✓] vda5050_connector available
[✓] mosquitto.conf found
✅ Installation Complete
```

If any step fails, the script stops and shows error details. See [Troubleshooting](#troubleshooting).

### Step 2: Start Hermes Backend

```bash
ros2 launch ros2/launch/hermes_backend.launch.py
```

The launch file **automatically detects** if mosquitto is installed:
- ✅ If installed → starts mosquitto + vda5050_connector
- ✅ If not installed → skips VDA5050, backend runs normally with ROS 2 only

**Log output:**
```
[hermes_backend] Starting ROS 2 nodes...
[hermes_backend] ✓ rmf_traffic_ros2
[hermes_backend] ✓ freebotics_rmf_adapter (ROS 2 native)
[hermes_backend] ✓ mosquitto_broker ← VDA5050 support
[hermes_backend] ✓ vda5050_connector ← VDA5050 support
[hermes_backend] ✓ rmf_api_server (REST + WebSocket)
[hermes_backend] ✓ rosbridge ← Legacy sensor data
```

### Step 3: Connect a VDA5050 Robot

Configure the robot to publish to the MQTT broker:

| Config | Value |
|--------|-------|
| MQTT Host | `<HERMES_IP>` (e.g., `192.168.1.100`) |
| MQTT Port | `1883` |
| Topic Prefix | `uagv/v2` |

**VDA5050 state topic** the robot must publish to:
```
uagv/v2/{manufacturer}/{serial}/state
```

**Example:**
```
uagv/v2/otto/AGV-001/state
uagv/v2/mir/MiR-250-HOOK-123/state
uagv/v2/fetch/FR-001/state
```

The connector translates these MQTT messages into RMF Fleet State.

### Step 4: Launch Hermes Dashboard

```bash
npm run electron:dev
# or in browser:
npm run dev
```

Open http://localhost:5173 (browser) or wait for Electron window to appear.

### Step 5: Verify Robot Connected

In **FleetSelector** (left sidebar):
- Look for your robot ID with `[VDA5050]` badge
- Badge appears within **30 seconds** of first MQTT state message
- Color: purple (#a855f7) — distinguishes from ROS 2 robots (no badge)

**Example FleetSelector output:**
```
Fleet: vda5050_fleet
 ● otto_agv_001    [VDA5050]    Battery: 72%   [idle]
 ● mir_250_001     [VDA5050]    Battery: 85%   [moving]

Fleet: freebotics_fleet
 ● freebotics_001               Battery: 91%   [idle]
```

## Configuration

### MQTT Broker on Different Host

By default, vda5050_connector expects mosquitto on `localhost:1883`.

If running on a **different host**:

#### Option A: Update vda5050_connector.yaml
Edit `ros2/config/vda5050_connector.yaml`:
```yaml
vda5050_connector:
  ros__parameters:
    mqtt_host: "192.168.1.100"  # ← Change to your broker IP
    mqtt_port: 1883
```

Then restart backend:
```bash
ros2 launch ros2/launch/hermes_backend.launch.py
```

#### Option B: Hermes UI (Coming in Future Release)
In **Settings** (⚙️ button) → **Advanced** → **MQTT Broker URL**:
```
mqtt://192.168.1.100:1883
```

Save and reconnect. Dashboard caches the setting.

### Robot Configuration Examples

#### OTTO Motors OTTO 100
- Vendor: Otto Motors
- Protocol: VDA5050 2.0.0
- Publish to: `uagv/v2/otto/{{robot_id}}/state`
- Subscribe to: `uagv/v2/otto/{{robot_id}}/order`

**Setup:**
1. Fleet Manager → MQTT Settings
2. Broker: `<HERMES_IP>:1883`
3. Topic prefix: `uagv/v2/otto`

#### Mobile Industrial Robots MiR250 HOOK
- Vendor: MiR (Mobile Industrial Robots)
- Protocol: VDA5050 2.0.0
- Publish to: `uagv/v2/mir/{{robot_id}}/state`

**Setup:** Similar to OTTO, use prefix `uagv/v2/mir`

#### Fetch Robotics (or any VDA5050-compliant robot)
Any robot implementing VDA5050 2.0.0 spec should work.

## Testing Without Hardware

### Simulate a VDA5050 Robot

```bash
bash scripts/simulate-vda5050-robot.sh [robot_id] [x] [y]

# Example:
bash scripts/simulate-vda5050-robot.sh sim_agv_001 5.0 3.0
```

This script:
1. Generates fake VDA5050 state messages every 0.5 seconds
2. Publishes to `uagv/v2/simulator/1.0/sim_agv_001/state`
3. Shows robot position, battery level, and heading

**Output:**
```
╔════════════════════════════════════════════════════════════╗
║   VDA5050 Robot Simulator — Publishing MQTT State         ║
╚════════════════════════════════════════════════════════════╝

Robot ID:          sim_agv_001
Initial Position:  (5.0, 3.0)
MQTT Broker:       localhost:1883
Topic:             uagv/v2/simulator/1.0/sim_agv_001/state

Publishing state messages every 0.5 seconds...
[20] sim_agv_001 @ (5.2, 3.1) | Battery: 74.8%
[40] sim_agv_001 @ (4.9, 3.3) | Battery: 74.6%
```

Within **30 seconds**, the robot appears in Hermes FleetSelector.

### Full Test Flow

**Terminal 1: Start backend**
```bash
ros2 launch ros2/launch/hermes_backend.launch.py
```

**Terminal 2: Simulate robot**
```bash
bash scripts/simulate-vda5050-robot.sh sim_agv_001 5.0 3.0
```

**Terminal 3: Launch dashboard**
```bash
npm run dev
# Open http://localhost:5173
```

**Expected behavior:**
- Hermes loads, shows `FleetSelector`
- ~30 seconds later, `sim_agv_001 [VDA5050]` appears
- Clicking the robot shows simulated position in Map3D

## Troubleshooting

### Robot not appearing in FleetSelector

**Check 1: mosquitto is running**
```bash
ps aux | grep mosquitto
```
Should show: `mosquitto -c ros2/config/mosquitto.conf`

If missing, restart backend:
```bash
pkill mosquitto
ros2 launch ros2/launch/hermes_backend.launch.py
```

**Check 2: Robot is publishing to MQTT**
```bash
mosquitto_sub -h localhost -t "uagv/v2/#" -v
```
Should show state messages from your robot. If empty, check:
- Robot MQTT host/port configuration
- Network connectivity (ping between robot and Hermes)
- Firewall blocking port 1883

**Check 3: vda5050_connector is running**
```bash
ros2 node list | grep vda5050
```
Should show: `/vda5050_connector`

If missing, check backend logs:
```bash
tail -f /tmp/hermes_mqtt/mosquitto.log
```

### MQTT Broker Error: "Connection refused"

mosquitto not running or not listening on port 1883.

**Fix:**
```bash
# Check if mosquitto is installed
which mosquitto

# If not:
bash scripts/install-vda5050.sh

# If installed, check port:
netstat -tln | grep 1883

# If not listening, start it manually:
mosquitto -c ros2/config/mosquitto.conf
```

### vda5050_connector Crashes

Check ROS 2 environment and logs:
```bash
source /opt/ros/humble/setup.bash
source ~/hermes_ws/install/setup.bash
ros2 node list
```

If vda5050_connector missing from package list, rebuild:
```bash
cd ~/hermes_ws
colcon build --symlink-install --packages-select vda5050_connector
```

### Robot appears, but position not updating

1. Check MQTT message frequency:
   ```bash
   mosquitto_sub -h localhost -t "uagv/v2/+/+/state" -v
   ```
   Should see updates every 0.5-1 second

2. Check RMF API Server logs:
   ```bash
   ros2 node info /rmf_api_server
   ```

3. Verify robot is in the same map level as configured:
   - Robot `agvPosition.mapId` must match a level in RMF world database
   - Default: `"L1"`
   - If robot reports `"L2"`, update `vda5050_connector.yaml`:
     ```yaml
     default_level: "L2"
     ```

### Multiple VDA5050 robots

Each robot must publish to a **unique topic**:
```
uagv/v2/otto/AGV-001/state    ← Robot 1
uagv/v2/otto/AGV-002/state    ← Robot 2
uagv/v2/mir/MiR-001/state     ← Robot 3 (different manufacturer)
```

All appear in the same `vda5050_fleet` in Hermes.

## Architecture

### Data Flow

```
VDA5050 Robot
    ↓ (MQTT publish: uagv/v2/.../state)
Mosquitto Broker (localhost:1883)
    ↓
vda5050_connector (ROS 2 node)
    ├→ Subscribe MQTT state
    ├→ Translate to RMF FleetState
    └→ Publish to rmf_fleet_msgs
        ↓
RMF Fleet State Database
    ↓
RMF API Server (:7878)
    ↓ (WebSocket: /fleet_states)
Hermes Dashboard
    ↓
FleetSelector (with [VDA5050] badge)
```

### Files Modified / Created

| File | Purpose |
|------|---------|
| `ros2/config/mosquitto.conf` | MQTT Broker config |
| `ros2/config/vda5050_connector.yaml` | Bridge configuration |
| `scripts/install-vda5050.sh` | Auto-install dependencies |
| `scripts/simulate-vda5050-robot.sh` | Test simulator |
| `src/hooks/useFleetState.js` | Protocol detection (inferProtocol) |
| `src/components/fleet/FleetSelector.jsx` | VDA5050 badge display |
| `src/components/settings/ConnectionSettings.jsx` | MQTT Broker URL field |

## References

- **VDA5050 Spec**: https://github.com/VDA5050/VDA5050
- **vda5050_connector**: https://github.com/tum-fml/vda5050_connector
- **open-RMF**: https://www.open-rmf.org/
- **Mosquitto**: https://mosquitto.org/

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review backend logs: `tail -f /tmp/hermes_mqtt/mosquitto.log`
3. Run validation: `bash scripts/validate-sprint2.sh`
4. Open an issue: https://github.com/needtech-robotics/hermes/issues
