"""
Launch file for freebotics_rmf_adapter.

Usage:
    ros2 launch freebotics_rmf_adapter adapter.launch.py
    ros2 launch freebotics_rmf_adapter adapter.launch.py robot_name:=freebotics_002

The robot_name argument overrides the value in freebotics.yaml, which is useful
when running multiple Freebotics robots in the same fleet.
"""

import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    pkg_share = get_package_share_directory('freebotics_rmf_adapter')
    default_config = os.path.join(pkg_share, 'config', 'freebotics.yaml')

    robot_name_arg = DeclareLaunchArgument(
        'robot_name',
        default_value='',
        description='Override robot_name from config (leave empty to use config value)'
    )

    robot_name = LaunchConfiguration('robot_name')

    adapter_node = Node(
        package='freebotics_rmf_adapter',
        executable='freebotics_fleet_adapter',
        name='freebotics_fleet_adapter',
        output='screen',
        parameters=[
            default_config,
            # CLI override: only applied when robot_name is non-empty.
            # ros2 launch passes an empty string when the arg is not provided,
            # which would override the yaml value — guarded in the node itself.
            {'robot_name': robot_name},
        ],
        arguments=['--ros-args', '--log-level', 'info'],
    )

    return LaunchDescription([
        robot_name_arg,
        adapter_node,
    ])
