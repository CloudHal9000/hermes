/**
 * freebotics_fleet_adapter — open-RMF Fleet Adapter (Phase 1 MVP)
 *
 * Bridges a Freebotics robot (ROS 2) ↔ open-RMF via topic-based FleetState.
 *
 * Data flow:
 *   [Robot TF]        → tf2_ros::Buffer   → current_pose_
 *   [/battery_state]  → BatteryState sub  → current_battery_
 *   [/robot/mode_str] → String sub        → current_mode_
 *   current_pose_ + current_battery_ + current_mode_  →  /fleet_states (10 Hz)
 *
 *   [{fleet}/robot_path_requests]  →  /goal_pose (Nav2)
 *   [{fleet}/robot_mode_requests]  →  cancel / idle
 *
 * Phase 2+: replace topic-based FleetState with rmf_fleet_adapter C++ API
 * for full Traffic Schedule integration and automated task planning.
 */

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cmath>
#include <memory>
#include <string>

#include <rclcpp/rclcpp.hpp>
#include <tf2/exceptions.h>
#include <tf2_ros/buffer.h>
#include <tf2_ros/transform_listener.h>

#include <geometry_msgs/msg/pose_stamped.hpp>
#include <sensor_msgs/msg/battery_state.hpp>
#include <std_msgs/msg/string.hpp>

#include <rmf_fleet_msgs/msg/fleet_state.hpp>
#include <rmf_fleet_msgs/msg/location.hpp>
#include <rmf_fleet_msgs/msg/mode_request.hpp>
#include <rmf_fleet_msgs/msg/path_request.hpp>
#include <rmf_fleet_msgs/msg/robot_mode.hpp>
#include <rmf_fleet_msgs/msg/robot_state.hpp>

// ── Helpers ───────────────────────────────────────────────────────────────────

struct Pose2D
{
  double x   = 0.0;
  double y   = 0.0;
  double yaw = 0.0;
};

/// Extract yaw (rotation around Z) from a quaternion.
/// Formula: atan2(2*(w*z + x*y), 1 - 2*(y² + z²))
static double quaternionToYaw(const geometry_msgs::msg::Quaternion & q)
{
  return std::atan2(
    2.0 * (q.w * q.z + q.x * q.y),
    1.0 - 2.0 * (q.y * q.y + q.z * q.z));
}

/// Case-insensitive string comparison against a fixed set of values.
static std::string toUpperASCII(const std::string & s)
{
  std::string out = s;
  std::transform(out.begin(), out.end(), out.begin(),
    [](unsigned char c) { return std::toupper(c); });
  return out;
}

// ── Node ──────────────────────────────────────────────────────────────────────

class FreeboticsFleetAdapter : public rclcpp::Node
{
public:
  FreeboticsFleetAdapter()
  : Node("freebotics_fleet_adapter")
  {
    // ── Declare parameters (all sourced from freebotics.yaml) ────────────────
    declare_parameter<std::string>("fleet_name",               "freebotics");
    declare_parameter<std::string>("robot_name",               "freebotics_001");
    declare_parameter<double>     ("max_speed",                0.5);
    declare_parameter<double>     ("max_accel",                0.3);
    declare_parameter<double>     ("footprint_radius",         0.35);
    declare_parameter<std::string>("map_frame",                "map");
    declare_parameter<std::string>("base_frame",               "base_footprint");
    declare_parameter<std::string>("battery_topic",            "/battery_state");
    declare_parameter<std::string>("mode_topic",               "/robot/mode_str");
    declare_parameter<std::string>("goal_topic",               "/goal_pose");
    declare_parameter<std::string>("rmf_server_url",           "http://localhost:7878");
    declare_parameter<double>     ("fleet_state_publish_rate", 10.0);

    // ── Load parameters ──────────────────────────────────────────────────────
    fleet_name_        = get_parameter("fleet_name").as_string();
    map_frame_         = get_parameter("map_frame").as_string();
    base_frame_        = get_parameter("base_frame").as_string();

    // robot_name may be overridden via launch argument; fall back to yaml value
    const std::string robot_name_param = get_parameter("robot_name").as_string();
    robot_name_ = robot_name_param.empty() ? "freebotics_001" : robot_name_param;

    const std::string battery_topic   = get_parameter("battery_topic").as_string();
    const std::string mode_topic      = get_parameter("mode_topic").as_string();
    const std::string goal_topic      = get_parameter("goal_topic").as_string();
    const std::string rmf_server_url  = get_parameter("rmf_server_url").as_string();
    const double      publish_rate    = get_parameter("fleet_state_publish_rate").as_double();

    RCLCPP_INFO(get_logger(),
      "Fleet Adapter initialized — fleet: '%s', robot: '%s', rmf_server: '%s'",
      fleet_name_.c_str(), robot_name_.c_str(), rmf_server_url.c_str());

    RCLCPP_INFO(get_logger(),
      "Frames: map='%s', base='%s' | Publish rate: %.1f Hz",
      map_frame_.c_str(), base_frame_.c_str(), publish_rate);

    // ── TF2 ──────────────────────────────────────────────────────────────────
    tf_buffer_   = std::make_shared<tf2_ros::Buffer>(get_clock());
    tf_listener_ = std::make_shared<tf2_ros::TransformListener>(*tf_buffer_);

    // ── Subscriptions ─────────────────────────────────────────────────────────
    battery_sub_ = create_subscription<sensor_msgs::msg::BatteryState>(
      battery_topic, 10,
      [this](sensor_msgs::msg::BatteryState::SharedPtr msg)
      {
        // percentage field: 0.0 (empty) … 1.0 (full); NaN when unknown
        if (std::isfinite(msg->percentage)) {
          current_battery_ = std::clamp(static_cast<double>(msg->percentage), 0.0, 1.0);
        }
      });

    mode_sub_ = create_subscription<std_msgs::msg::String>(
      mode_topic, 10,
      [this](std_msgs::msg::String::SharedPtr msg) { onModeMessage(msg->data); });

    // RMF Task Manager sends path requests to /{fleet_name}/robot_path_requests
    path_request_sub_ = create_subscription<rmf_fleet_msgs::msg::PathRequest>(
      fleet_name_ + "/robot_path_requests", 10,
      [this](rmf_fleet_msgs::msg::PathRequest::SharedPtr msg) { onPathRequest(msg); });

    // RMF Task Manager sends mode requests to /{fleet_name}/robot_mode_requests
    mode_request_sub_ = create_subscription<rmf_fleet_msgs::msg::ModeRequest>(
      fleet_name_ + "/robot_mode_requests", 10,
      [this](rmf_fleet_msgs::msg::ModeRequest::SharedPtr msg) { onModeRequest(msg); });

    // ── Publishers ────────────────────────────────────────────────────────────
    // The RMF API Server subscribes to /fleet_states to expose state via HTTP.
    fleet_state_pub_ = create_publisher<rmf_fleet_msgs::msg::FleetState>(
      "fleet_states", rclcpp::QoS(10));

    goal_pub_ = create_publisher<geometry_msgs::msg::PoseStamped>(
      goal_topic, rclcpp::QoS(10));

    // ── Timer: publish FleetState at configured rate ──────────────────────────
    const auto period_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(
      std::chrono::duration<double>(1.0 / publish_rate));
    timer_ = create_wall_timer(period_ns, [this]() { publishFleetState(); });
  }

private:
  // ── Mutable state ────────────────────────────────────────────────────────────
  std::string fleet_name_;
  std::string robot_name_;
  std::string map_frame_;
  std::string base_frame_;

  Pose2D  current_pose_;
  Pose2D  last_logged_pose_;       // tracks when to emit pose-change INFO log
  double  current_battery_  = 1.0; // 0.0–1.0; default full until first message
  bool    is_autonomous_     = false;
  uint32_t current_mode_     = rmf_fleet_msgs::msg::RobotMode::MODE_IDLE;
  std::string current_task_id_;

  // ── ROS interfaces ────────────────────────────────────────────────────────────
  std::shared_ptr<tf2_ros::Buffer>             tf_buffer_;
  std::shared_ptr<tf2_ros::TransformListener>  tf_listener_;

  rclcpp::Subscription<sensor_msgs::msg::BatteryState>::SharedPtr  battery_sub_;
  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr            mode_sub_;
  rclcpp::Subscription<rmf_fleet_msgs::msg::PathRequest>::SharedPtr path_request_sub_;
  rclcpp::Subscription<rmf_fleet_msgs::msg::ModeRequest>::SharedPtr mode_request_sub_;

  rclcpp::Publisher<rmf_fleet_msgs::msg::FleetState>::SharedPtr fleet_state_pub_;
  rclcpp::Publisher<geometry_msgs::msg::PoseStamped>::SharedPtr  goal_pub_;

  rclcpp::TimerBase::SharedPtr timer_;

  // ── Callbacks ────────────────────────────────────────────────────────────────

  void onModeMessage(const std::string & mode_str)
  {
    const bool prev_autonomous = is_autonomous_;
    const std::string upper    = toUpperASCII(mode_str);

    is_autonomous_ = (upper == "AUTONOMOUS" || upper == "AUTO");

    if (is_autonomous_ != prev_autonomous) {
      RCLCPP_INFO(get_logger(), "Mode changed: %s → %s",
        prev_autonomous ? "AUTONOMOUS" : "MANUAL",
        is_autonomous_  ? "AUTONOMOUS" : "MANUAL");
    }

    // Map to RMF mode: autonomous with active task = MOVING, otherwise IDLE.
    // Manual mode (e.g. joystick) = PAUSED — tells RMF scheduler to avoid
    // assigning new tasks until the robot is back under autonomous control.
    if (!is_autonomous_) {
      current_mode_ = rmf_fleet_msgs::msg::RobotMode::MODE_PAUSED;
    } else if (current_task_id_.empty()) {
      current_mode_ = rmf_fleet_msgs::msg::RobotMode::MODE_IDLE;
    } else {
      current_mode_ = rmf_fleet_msgs::msg::RobotMode::MODE_MOVING;
    }
  }

  void onPathRequest(const rmf_fleet_msgs::msg::PathRequest::SharedPtr msg)
  {
    if (msg->robot_name != robot_name_) return;
    if (msg->path.empty()) {
      RCLCPP_WARN(get_logger(), "Received PathRequest with empty path — ignored");
      return;
    }

    current_task_id_ = msg->task_id;
    current_mode_    = rmf_fleet_msgs::msg::RobotMode::MODE_MOVING;

    const auto & goal = msg->path.front();
    RCLCPP_INFO(get_logger(),
      "Task received: '%s', goal: (%.2f, %.2f, yaw: %.2f rad)",
      current_task_id_.c_str(), goal.x, goal.y, goal.yaw);

    // Convert RMF Location to Nav2 PoseStamped
    const double half_yaw = static_cast<double>(goal.yaw) / 2.0;

    geometry_msgs::msg::PoseStamped pose_msg;
    pose_msg.header.stamp    = now();
    pose_msg.header.frame_id = map_frame_;
    pose_msg.pose.position.x = static_cast<double>(goal.x);
    pose_msg.pose.position.y = static_cast<double>(goal.y);
    pose_msg.pose.position.z = 0.0;
    pose_msg.pose.orientation.x = 0.0;
    pose_msg.pose.orientation.y = 0.0;
    pose_msg.pose.orientation.z = std::sin(half_yaw);
    pose_msg.pose.orientation.w = std::cos(half_yaw);

    goal_pub_->publish(pose_msg);
  }

  void onModeRequest(const rmf_fleet_msgs::msg::ModeRequest::SharedPtr msg)
  {
    if (msg->robot_name != robot_name_) return;

    const uint32_t requested = msg->mode.mode;
    if (requested == rmf_fleet_msgs::msg::RobotMode::MODE_IDLE ||
        requested == rmf_fleet_msgs::msg::RobotMode::MODE_PAUSED)
    {
      RCLCPP_INFO(get_logger(),
        "Task cancelled — clearing task_id: '%s'", current_task_id_.c_str());
      current_task_id_.clear();
      current_mode_ = rmf_fleet_msgs::msg::RobotMode::MODE_IDLE;
    }
  }

  // ── Timer callback ────────────────────────────────────────────────────────────

  void publishFleetState()
  {
    updatePoseFromTF();

    rmf_fleet_msgs::msg::RobotState robot;
    robot.name                = robot_name_;
    robot.model               = "freebotics_v1";
    robot.task_id             = current_task_id_;
    robot.mode.mode           = current_mode_;
    robot.battery_percent     = static_cast<float>(current_battery_ * 100.0);
    robot.location.x          = static_cast<float>(current_pose_.x);
    robot.location.y          = static_cast<float>(current_pose_.y);
    robot.location.yaw        = static_cast<float>(current_pose_.yaw);
    robot.location.level_name = "L1";
    // robot.path: planned waypoints — empty in Phase 1, populated by Phase 2 planner

    rmf_fleet_msgs::msg::FleetState fleet_state;
    fleet_state.name = fleet_name_;
    fleet_state.robots.push_back(robot);

    fleet_state_pub_->publish(fleet_state);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  void updatePoseFromTF()
  {
    try {
      // TimePointZero = "give me the most recent available transform"
      auto tf = tf_buffer_->lookupTransform(
        map_frame_, base_frame_, tf2::TimePointZero);

      current_pose_.x   = tf.transform.translation.x;
      current_pose_.y   = tf.transform.translation.y;
      current_pose_.yaw = quaternionToYaw(tf.transform.rotation);

      logPoseIfChanged();
    } catch (const tf2::TransformException & ex) {
      // Throttle to avoid flooding logs when TF is not yet available
      RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 5000 /* ms */,
        "TF lookup failed ('%s' → '%s'): %s",
        map_frame_.c_str(), base_frame_.c_str(), ex.what());
    }
  }

  void logPoseIfChanged()
  {
    const double dx   = current_pose_.x - last_logged_pose_.x;
    const double dy   = current_pose_.y - last_logged_pose_.y;
    const double dist = std::sqrt(dx * dx + dy * dy);
    const double dyaw = std::abs(current_pose_.yaw - last_logged_pose_.yaw);

    constexpr double kDistThreshold = 0.1;                // metres
    constexpr double kYawThreshold  = 5.0 * M_PI / 180.0; // 5 degrees in radians

    if (dist > kDistThreshold || dyaw > kYawThreshold) {
      RCLCPP_INFO(get_logger(),
        "Pose updated — x: %.3f  y: %.3f  yaw: %.3f rad",
        current_pose_.x, current_pose_.y, current_pose_.yaw);
      last_logged_pose_ = current_pose_;
    }
  }
};

// ── Entry point ───────────────────────────────────────────────────────────────

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<FreeboticsFleetAdapter>());
  rclcpp::shutdown();
  return 0;
}
