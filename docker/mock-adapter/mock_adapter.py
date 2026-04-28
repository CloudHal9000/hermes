#!/usr/bin/env python3
"""
Hermes Mock Fleet Adapter — WebSocket Internal mode
"""
import asyncio
import json
import math
import websockets

WS_URL = "ws://localhost:8000/_internal"
FLEET_NAME = "hermes_fleet"


def build_fleet_state(t):
    return {
        "type": "fleet_state_update",
        "data": {
            "name": FLEET_NAME,
            "robots": {
                "hermes_bot_01": {
                    "name": "hermes_bot_01",
                    "status": "working",
                    "location": {
                        "map": "L1",
                        "x": round(5.0 * math.cos(t * 0.1), 2),
                        "y": round(5.0 * math.sin(t * 0.1), 2),
                        "yaw": round(t * 0.1, 3),
                        "obstructed": False,
                    },
                    "battery": round(max(0.2, (95.0 - t * 0.05) / 100), 3),
                    "issues": [],
                    "mutex_groups": {"locked": [], "requesting": []},
                },
                "hermes_bot_02": {
                    "name": "hermes_bot_02",
                    "status": "working",
                    "location": {
                        "map": "L1",
                        "x": round(3.0 * math.sin(t * 0.15), 2),
                        "y": 2.0,
                        "yaw": round(math.pi if math.sin(t * 0.15) < 0 else 0.0, 3),
                        "obstructed": False,
                    },
                    "battery": round(max(0.2, (80.0 - t * 0.03) / 100), 3),
                    "issues": [],
                    "mutex_groups": {"locked": [], "requesting": []},
                },
            },
        },
    }


async def run():
    t = 0.0
    print(f"[Hermes Mock Adapter] Conectando em {WS_URL}")
    while True:
        try:
            async with websockets.connect(WS_URL) as ws:
                print("[Hermes Mock Adapter] Conectado — publicando fleet states")
                while True:
                    t += 1.0
                    msg = build_fleet_state(t)
                    await ws.send(json.dumps(msg))
                    x1 = msg["data"]["robots"]["hermes_bot_01"]["location"]["x"]
                    y1 = msg["data"]["robots"]["hermes_bot_01"]["location"]["y"]
                    b1 = msg["data"]["robots"]["hermes_bot_01"]["battery"]
                    b2 = msg["data"]["robots"]["hermes_bot_02"]["battery"]
                    print(f"[t={t:.0f}s] bot_01=({x1},{y1}) bat={b1}% | bot_02 bat={b2}%")
                    await asyncio.sleep(1.0)
        except Exception as e:
            print(f"[WARN] Reconectando em 3s... ({e})")
            await asyncio.sleep(3.0)


if __name__ == "__main__":
    asyncio.run(run())
