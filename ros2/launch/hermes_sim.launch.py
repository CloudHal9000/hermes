"""
hermes_sim.launch.py — Hermes backend + rmf_demos simulation

Launches everything from hermes_backend.launch.py plus:
  - rmf_demos_gz office simulation (2 simulated Turtlebot3 robots)

This replaces the need for a physical robot during development and CI.

Prerequisites:
  - source ~/hermes_ws/install/setup.bash
  - export RMF_JWT_SECRET=<any-value-for-sim>
  - rmf_demos must be built in the workspace

Usage:
  ros2 launch hermes_sim.launch.py
  ros2 launch hermes_sim.launch.py headless:=true   # no Gazebo GUI
"""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    IncludeLaunchDescription,
    LogInfo,
    TimerAction,
)
from launch.conditions import IfCondition, UnlessCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.substitutions import FindPackageShare


_LAUNCH_DIR = Path(__file__).parent


def generate_launch_description():
    # ── Arguments ──────────────────────────────────────────────────────────────
    headless_arg = DeclareLaunchArgument(
        "headless",
        default_value="false",
        description="Run Gazebo in headless mode (no GUI) for CI/remote servers",
    )
    world_arg = DeclareLaunchArgument(
        "world",
        default_value="office",
        description="rmf_demos world to simulate (office, airport_terminal, ...)",
    )

    # ── Include hermes_backend (all RMF services + rosbridge) ─────────────────
    hermes_backend = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(str(_LAUNCH_DIR / "hermes_backend.launch.py")),
        # Simulation uses the demo robots, not a real freebotics robot
        launch_arguments={
            "robot_name": "tinyRobot1",
            "use_sim": "true",
        }.items(),
    )

    # ── rmf_demos_gz simulation ────────────────────────────────────────────────
    # Delayed 5s to let RMF services initialize before the simulation starts
    # publishing robot state.
    def get_rmf_demos_launch(world: str, headless: bool):
        """Return IncludeLaunchDescription for the selected rmf_demos world."""
        try:
            pkg_share = get_package_share_directory("rmf_demos_gz")
        except Exception:
            return LogInfo(
                msg=(
                    "[hermes_sim] rmf_demos_gz not found in workspace. "
                    "Build it with: colcon build --packages-select rmf_demos_gz"
                )
            )

        launch_file = PathJoinSubstitution([
            FindPackageShare("rmf_demos_gz"),
            "launch",
            f"{world}.launch.xml",
        ])

        gz_args = ""
        if headless:
            gz_args = "-s"  # server-only, no GUI

        return IncludeLaunchDescription(
            # rmf_demos uses XML launch files
            PythonLaunchDescriptionSource(
                # Wrapped: XML launch from Python via PythonLaunchDescriptionSource
                # is not supported directly — use the path with appropriate source
                str(Path(pkg_share) / "launch" / f"{world}.launch.xml")
            ),
            launch_arguments={"gz_args": gz_args}.items(),
        )

    # Delay simulation start to let Traffic Schedule and API Server boot first
    sim_launch = TimerAction(
        period=5.0,
        actions=[
            LogInfo(msg="[hermes_sim] Starting rmf_demos_gz simulation..."),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(
                    # Use the XML launch source for rmf_demos
                    PathJoinSubstitution([
                        FindPackageShare("rmf_demos_gz"),
                        "launch",
                        [LaunchConfiguration("world"), ".launch.xml"],
                    ])
                ),
                launch_arguments={
                    # headless flag maps to Gazebo's server-only mode
                    "headless": LaunchConfiguration("headless"),
                }.items(),
            ),
        ],
    )

    return LaunchDescription([
        headless_arg,
        world_arg,

        LogInfo(msg="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),
        LogInfo(msg="  Hermes Simulation — rmf_demos + Full Backend"),
        LogInfo(msg="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),

        # Backend services first
        hermes_backend,

        # Simulation delayed to allow RMF services to initialize
        sim_launch,
    ])
