# Hermes — Infrastructure Requirements

The Hermes dashboard is a **frontend application**. It does not manage ROS 2
installation or robot provisioning. It connects to four external services that
must be running and reachable on the network before the dashboard can be used.

---

## Required services

| Service | Port | Protocol | Required | Notes |
|---|---|---|---|---|
| RMF API Server | 7878 | HTTP + WebSocket | Yes | Exposes fleet state and tasks |
| rosbridge_suite | 9090 | WebSocket | Phases 1–3 | Sensor data (costmaps, LiDAR) |
| freebotics_rmf_adapter | — | ROS 2 DDS | Yes | Bridges robot ↔ RMF |
| ROS 2 Humble | — | DDS | Yes | Base for all ROS services |

> **Phases 1–3**: rosbridge provides costmaps and LiDAR until the RMF API
> Server gains sensor streaming in Phase 4.

---

## Quick check

```bash
# Clone the repo
git clone https://github.com/MaximilianCF/hermes.git && cd hermes

# Verify all services are reachable
bash scripts/setup-ros2-rmf.sh

# If all checks pass, start the frontend
npm install && npm run dev
```

---

## Option 1: Bare-metal (Linux native) {#opcao-1-bare-metal}

**Recommended OS:** Ubuntu 22.04 LTS (Jammy Jellyfish)

ROS 2 Humble has first-class support on Ubuntu 22.04. Follow the official guide:

```
https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html
```

### On Debian (Unstable / Sid) {#ros2}

ROS 2 Humble is not officially supported on Debian Unstable. The Ubuntu Jammy
apt repository usually works, but some packages may require source builds
and ABI compatibility is not guaranteed across Debian sid updates.

Resources:
- https://docs.ros.org/en/humble/Installation/Alternatives/Debian-Install.html
- https://wiki.ros.org/Installation (community notes for Debian)

If bare-metal on Debian is problematic, **use the Docker option** — it is the
recommended development path for non-Ubuntu hosts.

### After installing ROS 2

```bash
# Add to ~/.bashrc (or run before every terminal session)
source /opt/ros/humble/setup.bash

# Create and build the Hermes ROS 2 workspace
mkdir -p ~/hermes_ws/src
ln -s /path/to/hermes/ros2/freebotics_rmf_adapter ~/hermes_ws/src/
cd ~/hermes_ws
rosdep install --from-paths src --ignore-src -y
colcon build --packages-select freebotics_rmf_adapter

# Start the full backend
export RMF_JWT_SECRET=your-secret-here
ros2 launch /path/to/hermes/ros2/launch/hermes_backend.launch.py
```

---

## Option 2: Docker (any OS) {#opcao-2-docker}

The `docker/` directory provides a `docker-compose.yml` that bundles the
RMF API Server and a mock fleet adapter without requiring ROS 2 on the host.

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- On Linux: recommended to use `network_mode: host` for DDS multicast
- On macOS/Windows: DDS requires unicast configuration (see below)

### Start with Docker Compose

```bash
# Set the JWT secret (never hardcode — use an env var or secrets manager)
export RMF_JWT_SECRET=hermes-dev-secret

# Start the backend
docker compose -f docker/docker-compose.yml up

# Services started:
#   api-server   → http://localhost:8000  (note: Docker uses 8000, native uses 7878)
#   mock-adapter → simulates a robot fleet over ROS 2
```

### Minimal docker-compose.yml (Linux, network_mode: host)

For mounting the Hermes ROS 2 packages into a container:

```yaml
services:
  rmf_backend:
    image: ros:humble
    network_mode: host       # Required for DDS multicast on Linux
    environment:
      - RMF_JWT_SECRET=${RMF_JWT_SECRET}
    command: >
      bash -c "source /opt/ros/humble/setup.bash &&
               cd /hermes &&
               colcon build --packages-select freebotics_rmf_adapter &&
               source install/setup.bash &&
               ros2 launch ros2/launch/hermes_backend.launch.py"
    volumes:
      - .:/hermes
    restart: unless-stopped
```

### DDS on macOS and Windows

DDS uses multicast by default, which Docker Desktop blocks on macOS and Windows.
Use Cyclone DDS with unicast peer configuration:

```xml
<!-- cyclone_dds.xml -->
<CycloneDDS>
  <Domain>
    <General>
      <Interfaces>
        <NetworkInterface name="lo" />
      </Interfaces>
    </General>
    <Discovery>
      <Peers>
        <Peer Address="localhost" />
      </Peers>
      <ParticipantIndex>auto</ParticipantIndex>
    </Discovery>
  </Domain>
</CycloneDDS>
```

Pass to Docker:
```bash
docker run \
  -e CYCLONEDDS_URI=/cyclone_dds.xml \
  -v $(pwd)/cyclone_dds.xml:/cyclone_dds.xml \
  -p 7878:7878 -p 9090:9090 \
  ros:humble
```

---

## Docker — implications for Hermes {#docker}

| Aspect | Impact | Notes |
|---|---|---|
| Frontend → :7878 (HTTP/WS) | None | Works on any OS |
| Frontend → :9090 (WebSocket) | None | Works on any OS |
| JWT auth (VITE_RMF_TOKEN) | None | Token validated by API Server |
| DDS multicast | Requires attention | Use `network_mode: host` on Linux |
| Multiple containers | Requires attention | All on same Docker network or use host networking |
| Port 8000 vs 7878 | Dev discrepancy | Docker dev uses 8000; native ROS 2 uses 7878 |
| Gazebo simulation | Out of scope | Requires Xvfb or VirtualGL for headless display |

### Port 7878 vs 8000 {#porta-7878-vs-8000}

The current Docker development config (`docker/api-server-config.py`) uses
port **8000**. The native ROS 2 launch config and `OPENRMF_MIGRATION.md`
specify port **7878** (open-RMF convention).

Set `.env.local` to match whichever is running:

```bash
# Docker dev (port 8000)
VITE_RMF_API_URL=http://localhost:8000
VITE_RMF_WS_URL=ws://localhost:8000

# Native ROS 2 (port 7878)
VITE_RMF_API_URL=http://localhost:7878
VITE_RMF_WS_URL=ws://localhost:7878
```

---

## Generating a JWT token {#gerando-jwt-token} {#jwt}

The Hermes frontend authenticates against the RMF API Server using a JWT
Bearer token stored in `.env.local` as `VITE_RMF_TOKEN`.

The token must be signed with the same secret as `RMF_JWT_SECRET` and include
`aud: "rmf_api_server"` in its payload.

### Generate with Node.js (no extra dependencies)

```bash
node -e "
const crypto = require('crypto');
const secret = process.env.RMF_JWT_SECRET;
if (!secret) { console.error('RMF_JWT_SECRET not set'); process.exit(1); }

const b64url = (s) => Buffer.from(s).toString('base64url');
const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = b64url(JSON.stringify({
  sub: 'hermes-dashboard',
  preferred_username: 'admin',
  iss: 'stub',
  aud: 'rmf_api_server',
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,  // 1 year
}));
const sig = crypto.createHmac('sha256', secret)
  .update(header + '.' + payload).digest('base64url');
console.log(header + '.' + payload + '.' + sig);
"
```

```bash
# Set the secret (must match what the API Server uses)
export RMF_JWT_SECRET=hermes-dev-secret

# Run the command above, then copy the output to .env.local:
VITE_RMF_TOKEN=<generated-token>
```

### Generate with Python (no extra dependencies)

```python
import hmac, hashlib, base64, json, time, os, sys

secret = os.environ.get('RMF_JWT_SECRET')
if not secret:
    print('RMF_JWT_SECRET not set', file=sys.stderr)
    sys.exit(1)

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header  = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
payload = b64url(json.dumps({
    'sub': 'hermes-dashboard',
    'preferred_username': 'admin',
    'iss': 'stub',
    'aud': 'rmf_api_server',
    'exp': int(time.time()) + 86400 * 365,
}).encode())

sig = b64url(hmac.new(
    secret.encode(), f'{header}.{payload}'.encode(), hashlib.sha256
).digest())

print(f'{header}.{payload}.{sig}')
```

### Decode and inspect an existing token

```bash
# Inspect the token in .env.local without external tools
TOKEN=$(grep VITE_RMF_TOKEN .env.local | cut -d= -f2)
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool

# Check expiry
python3 -c "
import base64, json, sys, time
token = '${TOKEN}'
payload = json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '=='))
exp = payload.get('exp', 0)
remaining = exp - time.time()
print(f'aud: {payload.get(\"aud\")}')
print(f'iss: {payload.get(\"iss\")}')
print(f'exp: {time.strftime(\"%Y-%m-%d\", time.gmtime(exp))}')
print(f'expires in: {remaining/86400:.0f} days' if remaining > 0 else 'EXPIRED')
"
```

---

## Network topology

```
                    ┌─────────────────────────────────────────┐
                    │           Host / Docker Network          │
                    │                                          │
  Browser           │  ┌──────────────┐   ROS 2 DDS          │
  (Vite dev)  HTTP  │  │ RMF API      │◄──────────────────┐  │
  :5173 ──────────► │  │ Server :7878 │                   │  │
              WS    │  │              │   /fleet_states    │  │
  :5173 ──────────► │  └──────────────┘ ◄─────────────────┤  │
                    │                    rmf_fleet_msgs    │  │
  Browser     WS    │  ┌──────────────┐                   │  │
  :5173 ──────────► │  │ rosbridge    │   /tf /costmap    │  │
                    │  │ :9090        │◄──────────────────┤  │
                    │  └──────────────┘                   │  │
                    │                        ┌────────────┴──┐│
                    │                        │ freebotics    ││
                    │                        │ rmf_adapter   ││
                    │                        └───────────────┘│
                    └─────────────────────────────────────────┘
                                                    │ ROS 2 DDS
                                                    ▼
                                           ┌───────────────┐
                                           │  Robot (ROS 2)│
                                           │  /tf /battery │
                                           │  /mode_str    │
                                           └───────────────┘
```

---

## Security notes

- `RMF_JWT_SECRET` must never appear in any version-controlled file
- `VITE_RMF_TOKEN` is embedded in the compiled JS bundle (Vite inlines `VITE_*` vars)
  — acceptable on isolated networks; use a BFF proxy for internet-facing deploys
- See `docs/auth-spec.md` for the complete threat model and auth roadmap
