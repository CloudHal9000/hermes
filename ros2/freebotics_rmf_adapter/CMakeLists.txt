cmake_minimum_required(VERSION 3.8)
project(freebotics_rmf_adapter)

# Require C++17 for std::clamp and structured bindings
if(NOT CMAKE_CXX_STANDARD)
  set(CMAKE_CXX_STANDARD 17)
endif()

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# ── Find packages ─────────────────────────────────────────────────────────────
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(rmf_fleet_msgs REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(tf2 REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(std_msgs REQUIRED)

# Phase 2+: full fleet adapter C++ API (not yet used in compiled node)
# find_package(rmf_fleet_adapter QUIET)
# find_package(rmf_task QUIET)

# ── Executable ────────────────────────────────────────────────────────────────
add_executable(freebotics_fleet_adapter
  src/freebotics_fleet_adapter.cpp
)

ament_target_dependencies(freebotics_fleet_adapter
  rclcpp
  rmf_fleet_msgs
  tf2_ros
  tf2
  geometry_msgs
  sensor_msgs
  std_msgs
)

# ── Install ───────────────────────────────────────────────────────────────────
install(TARGETS freebotics_fleet_adapter
  DESTINATION lib/${PROJECT_NAME}
)

install(DIRECTORY
  config
  launch
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
