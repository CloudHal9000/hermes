/**
 * useMultiRobotModel — Multi-robot URDF model manager
 *
 * Replaces useRobotModel for the open-RMF multi-robot scenario.
 * Manages N Three.js Groups, one per robot in robots[].
 *
 * Lifecycle per robot:
 *   new robot in robots[] → create THREE.Group, load URDF, add to scene
 *   robot removed from robots[] → dispose group, remove from scene
 *   per frame (update()) → sync group.position / quaternion from rmfPoses
 *
 * Returns:
 *   update()    — call in the animation loop (60fps)
 *   robotGroup  — the first robot's group, for LiDAR / sensor attachment
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';

// Distinct colours per robot index so operators can tell robots apart
const ROBOT_COLORS = [
  0x00d26a,  // green  — robot 0 (default Freebotics colour)
  0x3b82f6,  // blue   — robot 1
  0xf59e0b,  // amber  — robot 2
  0xef4444,  // red    — robot 3
  0xa855f7,  // purple — robot 4+
];

export function useMultiRobotModel(robots, rmfPoses, scene, showFootprint) {
  // Map<robotId, { group: THREE.Group, loaded: boolean }>
  const entriesRef     = useRef(new Map());
  const primaryGroupRef = useRef(null);
  const sceneRef       = useRef(scene);
  sceneRef.current = scene;

  // ── Lifecycle: add / remove groups when robots[] changes ──────────────────
  useEffect(() => {
    if (!scene) return;

    const currentIds = new Set(robots.map(r => r.id ?? r.name).filter(Boolean));

    // Remove departed robots
    for (const [id, entry] of entriesRef.current) {
      if (!currentIds.has(id)) {
        scene.remove(entry.group);
        entriesRef.current.delete(id);
        if (primaryGroupRef.current === entry.group) {
          primaryGroupRef.current = null;
        }
      }
    }

    // Add new robots
    robots.forEach((robot, index) => {
      const id = robot.id ?? robot.name;
      if (!id || entriesRef.current.has(id)) return;

      const color = ROBOT_COLORS[index % ROBOT_COLORS.length];

      const group = new THREE.Group();
      scene.add(group);

      // Rotation wrapper (URDF axis convention fix)
      const visualGroup = new THREE.Group();
      visualGroup.rotation.z = Math.PI;
      group.add(visualGroup);

      // Load URDF asynchronously
      const loader = new URDFLoader();
      loader.packages = { freebotics_description: './freebotics_description' };
      loader.load('./urdf/robot.urdf', (robot) => {
        robot.rotation.z = Math.PI;
        robot.position.z = 0.23;
        robot.position.x = 0.05;
        robot.traverse(c => {
          c.castShadow = true;
          // Tint robots 1+ with their assigned colour for visual distinction
          if (c.isMesh && index > 0) {
            c.material = c.material.clone();
            c.material.color.setHex(color);
          }
        });
        visualGroup.add(robot);
        const entry = entriesRef.current.get(id);
        if (entry) entry.loaded = true;
      });

      const entry = { group, loaded: false };
      entriesRef.current.set(id, entry);

      // Track the first robot's group for sensor (LiDAR) attachment
      if (!primaryGroupRef.current) {
        primaryGroupRef.current = group;
      }
    });
  }, [robots, scene]);

  // ── Footprint visibility ───────────────────────────────────────────────────
  useEffect(() => {
    for (const { group } of entriesRef.current.values()) {
      group.traverse(c => {
        if (c.isLine) c.visible = showFootprint;
      });
    }
  }, [showFootprint]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const s = sceneRef.current;
      for (const { group } of entriesRef.current.values()) {
        if (s) s.remove(group);
      }
      entriesRef.current.clear();
      primaryGroupRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-frame update (called in animation loop) ────────────────────────────
  const update = () => {
    if (!rmfPoses) return;
    for (const [id, { group }] of entriesRef.current) {
      const pose = rmfPoses[id];
      if (!pose) continue;
      group.position.set(pose.position.x, pose.position.y, 0);
      group.quaternion.set(
        pose.quaternion.x,
        pose.quaternion.y,
        pose.quaternion.z,
        pose.quaternion.w,
      );
    }
  };

  return {
    update,
    // Primary robot's group — for sensor (LiDAR) attachment, backward compat
    robotGroup: primaryGroupRef.current,
  };
}
