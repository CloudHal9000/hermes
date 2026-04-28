import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFleetState } from '../../../hooks/useFleetState';

export function useNavigationTool(ros, scene, camera, floorPlane, activeTool, setActiveTool) {
    const goalMarkerRef = useRef(null);
    const poseMarkerRef = useRef(null);
    const dragStartRef = useRef(null);
    const isDraggingRef = useRef(false);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    const currentYawRef = useRef(0);

    // GOAL now dispatched via RMF API instead of roslib topic
    const { createTask } = useFleetState();

    const TOPIC_INIT = '/initialpose';

    useEffect(() => {
        if (!scene) return;

        const goalArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.5, 0xffff00, 0.4, 0.3);
        goalArrow.visible = false; scene.add(goalArrow); goalMarkerRef.current = goalArrow;

        const poseArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.5, 0x9d00ff, 0.4, 0.3);
        poseArrow.visible = false; scene.add(poseArrow); poseMarkerRef.current = poseArrow;

        return () => {
            if (goalArrow) scene.remove(goalArrow);
            if (poseArrow) scene.remove(poseArrow);
        };
    }, [scene]);

    function getQuaternionFromYaw(yaw) {
        const half = yaw * 0.5;
        return { x: 0.0, y: 0.0, z: Math.sin(half), w: Math.cos(half) };
    }

    const handlePointerDown = (event, mount) => {
        if (!activeTool || !floorPlane || !camera) return;

        event.target.setPointerCapture(event.pointerId);
        isDraggingRef.current = true;

        const rect = mount.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObject(floorPlane);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            dragStartRef.current = { x: point.x, y: point.y };
            currentYawRef.current = 0;

            const marker = activeTool === 'GOAL' ? goalMarkerRef.current : poseMarkerRef.current;
            if (marker) {
                marker.position.set(point.x, point.y, 0.2);
                marker.setDirection(new THREE.Vector3(1, 0, 0));
                marker.setLength(1.5, 0.4, 0.3);
                marker.visible = true;
            }
        }
    };

    const handlePointerMove = (event, mount) => {
        if (!isDraggingRef.current || !dragStartRef.current || !activeTool) return;

        const rect = mount.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObject(floorPlane);

        if (intersects.length > 0) {
            const currPoint = intersects[0].point;
            const startPoint = dragStartRef.current;
            const dx = currPoint.x - startPoint.x;
            const dy = currPoint.y - startPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const marker = activeTool === 'GOAL' ? goalMarkerRef.current : poseMarkerRef.current;
            if (marker) {
                marker.position.set(startPoint.x, startPoint.y, 0.2);
                if (distance > 0.05) {
                    const yaw = Math.atan2(dy, dx);
                    currentYawRef.current = yaw;
                    const dir = new THREE.Vector3(dx, dy, 0).normalize();
                    marker.setDirection(dir);
                    const visualLength = Math.max(1.5, Math.min(distance * 1.2, 6.0));
                    marker.setLength(visualLength, 0.4, 0.3);
                }
            }
        }
    };

    const handlePointerUp = (event, controls) => {
        if (!isDraggingRef.current || !dragStartRef.current || !activeTool) return;

        event.target.releasePointerCapture(event.pointerId);
        isDraggingRef.current = false;

        const marker = activeTool === 'GOAL' ? goalMarkerRef.current : poseMarkerRef.current;
        if (!marker) return;

        const pos = { x: dragStartRef.current.x, y: dragStartRef.current.y };
        const rotation = currentYawRef.current;
        const orientation = getQuaternionFromYaw(rotation);

        if (activeTool === 'GOAL') {
            // Dispatch navigation task via RMF API (replaces roslib topic publish)
            createTask({
                category: 'navigation',
                start: { x: 0, y: 0 },  // simplified: let RMF assign from robot's current position
                goal:  { x: pos.x, y: pos.y, yaw: rotation },
            }).catch(err => console.error('[useNavigationTool] createTask failed:', err));

        } else if (activeTool === 'POSE') {
            // Initial pose still sent via rosbridge (/initialpose) — AMCL re-localisation
            if (ros && window.ROSLIB) {
                const stamp = { sec: 0, nanosec: 0 };
                const cov = [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0.0685, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.0685];
                const initTopic = new window.ROSLIB.Topic({ ros, name: TOPIC_INIT, messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped' });
                initTopic.publish({
                    header: { frame_id: 'map', stamp },
                    pose: { pose: { position: { x: pos.x, y: pos.y, z: 0 }, orientation }, covariance: cov }
                });
            }
        }

        if (setActiveTool) setActiveTool(null);
        dragStartRef.current = null;
        setTimeout(() => { if (marker) marker.visible = false; }, 3000);

        if (controls) {
            controls.enabled = true;
        }
    };

    return { handlePointerDown, handlePointerMove, handlePointerUp };
}
