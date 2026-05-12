/**
 * Tipos legados para rosbridge (:9090)
 * SERÃO REMOVIDOS NA FASE 4 - substituídos por RMF API
 * @deprecated Remove in Phase 4 - replaced by RMF API
 */

// ROS Costmap message from /local_costmap/costmap and /global_costmap/costmap
export interface RosCostmapMessage {
  header: {
    seq: number;
    stamp: {
      sec: number;
      nsec: number;
    };
    frame_id: string;
  };
  info: {
    resolution: number;
    width: number;
    height: number;
    origin: {
      position: {
        x: number;
        y: number;
        z: number;
      };
      orientation: {
        x: number;
        y: number;
        z: number;
        w: number;
      };
    };
  };
  data: Uint8Array; // costmap data as byte array
}

// ROS LiDAR message from /lidar/front_aligned
export interface RosLidarMessage {
  header: {
    seq: number;
    stamp: {
      sec: number;
      nsec: number;
    };
    frame_id: string;
  };
  ranges: number[]; // distance readings in meters
  intensities: number[]; // intensity values for each point
  angle_min: number; // starting angle in radians
  angle_max: number; // ending angle in radians
  angle_increment: number; // angular resolution in radians
  range_min: number; // minimum range in meters
  range_max: number; // maximum range in meters
  scan_time: number; // time between scans in seconds
  range_min: number; // minimum measurable range
  range_max: number; // maximum measurable range
}

// ROS InitialPose message from /initialpose
export interface RosInitialPoseMessage {
  header: {
    seq: number;
    stamp: {
      sec: number;
      nsec: number;
    };
    frame_id: string;
  };
  pose: {
    pose: {
      position: {
        x: number;
        y: number;
        z: number;
      };
      orientation: {
        x: number;
        y: number;
        z: number;
        w: number;
      };
    };
    covariance: number[]; // 36-element covariance matrix
  };
}

// Verify fields inferred from ROS 2 standard messages:
// - RosCostmapMessage: based on nav2_msgs/OccupancyGrid
// - RosLidarMessage: based on sensor_msgs/LaserScan
// - RosInitialPoseMessage: based on geometry_msgs/PoseWithCovarianceStamped