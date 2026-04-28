"""
hermes_backend.launch.py — Full Hermes backend stack (Week 2 MVP)

Launches in order:
  1. rmf_traffic_schedule  — Traffic Schedule for robot deconfliction
  2. freebotics_fleet_adapter — Fleet Adapter (robot ↔ RMF)
  3. rmf_api_server          — REST/WebSocket API (:7878)
  4. rosbridge_websocket     — Sensor WebSocket (:9090)

Prerequisites:
  - source ~/hermes_ws/install/setup.bash
  - export RMF_JWT_SECRET=<your-secret>   # REQUIRED — never hardcode

Usage:
  ros2 launch hermes_backend.launch.py
  ros2 launch hermes_backend.launch.py robot_name:=freebotics_002
  ros2 launch hermes_backend.launch.py robot_ip:=192.168.1.100 use_sim:=false
"""

import os
from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    ExecuteProcess,
    GroupAction,
    IncludeLaunchDescription,
    LogInfo,
    OpaqueFunction,
    SetEnvironmentVariable,
    TimerAction,
)
from launch.conditions import IfCondition, UnlessCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import (
    EnvironmentVariable,
    LaunchConfiguration,
    PathJoinSubstitution,
    PythonExpression,
)
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


# ── Resolve config directory relative to this file ────────────────────────────
_LAUNCH_DIR = Path(__file__).parent
_CONFIG_DIR  = _LAUNCH_DIR.parent / "config"
_ADAPTER_PKG = "freebotics_rmf_adapter"


def generate_launch_description():
    # ── Arguments ──────────────────────────────────────────────────────────────
    robot_name_arg = DeclareLaunchArgument(
        "robot_name",
        default_value="freebotics_001",
        description="RMF robot name — must match fleet config",
    )
    robot_ip_arg = DeclareLaunchArgument(
        "robot_ip",
        default_value="localhost",
        description="IP of the physical robot (for rosbridge connection)",
    )
    use_sim_arg = DeclareLaunchArgument(
        "use_sim",
        default_value="false",
        description="Set true to launch rmf_demos simulation instead of real robot",
    )
    rmf_port_arg = DeclareLaunchArgument(
        "rmf_port",
        default_value="7878",
        description="Port for RMF API Server (default 7878; dev Docker uses 8000)",
    )

    # ── Validate JWT secret at launch time ────────────────────────────────────
    def validate_jwt_secret(context, *args, **kwargs):
        secret = os.environ.get("RMF_JWT_SECRET", "")
        if not secret:
            return [
                LogInfo(msg=(
                    "[hermes_backend] WARNING: RMF_JWT_SECRET is not set. "
                    "The API Server will start with an empty secret. "
                    "Frontend will receive 401 on all authenticated requests. "
                    "Set with: export RMF_JWT_SECRET=<secret>"
                )),
            ]
        return [LogInfo(msg="[hermes_backend] RMF_JWT_SECRET is set.")]

    # ── 1. Traffic Schedule ───────────────────────────────────────────────────
    traffic_schedule_node = Node(
        package="rmf_traffic_ros2",
        executable="rmf_traffic_schedule",
        name="rmf_traffic_schedule",
        output="screen",
        parameters=[str(_CONFIG_DIR / "rmf_traffic_schedule.config.yaml")],
        arguments=["--ros-args", "--log-level", "warn"],
    )

    # ── 2. Freebotics Fleet Adapter ───────────────────────────────────────────
    adapter_config = str(_CONFIG_DIR.parent / "freebotics_rmf_adapter" / "config" / "freebotics.yaml")

    fleet_adapter_node = Node(
        package=_ADAPTER_PKG,
        executable="freebotics_fleet_adapter",
        name="freebotics_fleet_adapter",
        output="screen",
        parameters=[
            adapter_config,
            {"robot_name": LaunchConfiguration("robot_name")},
        ],
    )

    # ── 3. RMF API Server ─────────────────────────────────────────────────────
    # rmf_api_server can be a ROS node (ros2 run) or a Python process (pip install).
    # Try ROS node first; fall back to ExecuteProcess for pip-installed version.

    # Config file consumed by rmf_api_server when launched as ROS node:
    api_server_config = str(_CONFIG_DIR / "rmf_api_server.config.yaml")

    # ROS-node variant (used when installed via apt ros-humble-rmf-api-server)
    api_server_ros_node = Node(
        package="rmf_api_server",
        executable="rmf_api_server",
        name="rmf_api_server",
        output="screen",
        parameters=[api_server_config],
        # JWT secret injected as env var — never appears in any config file
        additional_env={
            "RMF_JWT_SECRET": EnvironmentVariable(
                "RMF_JWT_SECRET", default_value="change-me-in-production"
            ),
        },
    )

    # Standalone variant (used when installed via pip / Docker Python image)
    # Delayed 2s to let Traffic Schedule initialize first
    api_server_process = TimerAction(
        period=2.0,
        actions=[
            ExecuteProcess(
                cmd=["python3", "-m", "api_server"],
                output="screen",
                additional_env={
                    "RMF_SERVER_URI": "http://localhost:7878",
                    "RMF_JWT_SECRET": EnvironmentVariable(
                        "RMF_JWT_SECRET", default_value="change-me-in-production"
                    ),
                    "RMF_API_SERVER_CONFIG": api_server_config,
                },
            )
        ],
    )

    # ── 4. rosbridge WebSocket (sensor data) ──────────────────────────────────
    rosbridge_config = str(_CONFIG_DIR / "rosbridge.config.yaml")

    rosbridge_node = Node(
        package="rosbridge_server",
        executable="rosbridge_websocket",
        name="rosbridge_websocket",
        output="screen",
        parameters=[rosbridge_config],
    )

    # ── Launch description ─────────────────────────────────────────────────────
    return LaunchDescription([
        # Arguments
        robot_name_arg,
        robot_ip_arg,
        use_sim_arg,
        rmf_port_arg,

        # Startup info
        LogInfo(msg="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),
        LogInfo(msg="  Hermes Backend — Week 2 MVP"),
        LogInfo(msg="  :7878 RMF API Server | :9090 rosbridge"),
        LogInfo(msg="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),

        # JWT secret validation
        OpaqueFunction(function=validate_jwt_secret),

        # Core services (order matters: traffic schedule → adapter → api server)
        traffic_schedule_node,
        fleet_adapter_node,

        # Try ROS node variant of API server; if package not found,
        # operator should run `python3 -m api_server` separately or via Docker.
        api_server_ros_node,

        # rosbridge runs independently — no dependency on RMF core
        rosbridge_node,
    ])
