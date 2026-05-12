import { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useMapScene } from './map-layers/useMapScene';
import { useMultiRobotModel } from './map-layers/useMultiRobotModel';
import { useRMFPoses } from './map-layers/useRMFPoses';
import { useFleetState } from '../../hooks/useFleetState';
import { useLidarLayer } from './map-layers/useLidarLayer';
import { useCostmapLayer } from './map-layers/useCostmapLayer';
import { usePathLayer } from './map-layers/usePathLayer';
import { useNavigationTool } from './map-layers/useNavigationTool';
import { AMCLHelper } from '../../utils/amclHelper';

// ros is still passed for rosbridge sensor data (costmaps, LiDAR) — LEGACY until Phase 4
export default function Map3D({ ros, showFootprint, viewMode, activeTool, setActiveTool }) {
    // 0. Container
    const [mountNode, setMountNode] = useState(null);
    const mountRefCallback = useCallback((node) => {
        if (node !== null) setMountNode(node);
    }, []);

    // 1. Scene Setup
    const { scene, camera, renderer, controls, floorPlane, isReady } = useMapScene(mountNode, viewMode);

    // 2. RMF Fleet State — robots[] and their poses (RMF API, not TF graph)
    const { robots } = useFleetState();
    const rmfPoses    = useRMFPoses();

    // 3. Multi-robot Models (URDF groups positioned by RMF poses)
    const { update: updateRobots, robotGroup } = useMultiRobotModel(robots, rmfPoses, scene, showFootprint);

    // 4. Sensors & Data Layers
    // ros still required here: costmaps and LiDAR stream via rosbridge (:9090)
    useLidarLayer(ros, robotGroup);        // tfGraph removed — group positioned by RMF
    useCostmapLayer(ros, scene);
    usePathLayer(ros, scene);

    // 5. Tools (Navigation / AMCL)
    // ros kept for POSE tool (/initialpose via rosbridge); GOAL uses createTask via RMF
    const { handlePointerDown, handlePointerMove, handlePointerUp } = useNavigationTool(
        ros, scene, camera, floorPlane, activeTool, setActiveTool
    );

    // PERF: cleanup do AMCLHelper para evitar subscription leak no unmount
    // Ref: docs/performance-benchmark-report.md — Quick Win 2
    const amclHelperRef = useRef(null);
    useEffect(() => {
        if (!ros) return;
        amclHelperRef.current = new AMCLHelper(ros);
        return () => {
            if (amclHelperRef.current) {
                amclHelperRef.current.destroy();
                amclHelperRef.current = null;
            }
        };
    }, [ros]);

    // Mode Listener (rosbridge — robot reports AUTONOMOUS/MANUAL via mode_str)
    useEffect(() => {
        if (!ros) return;
        const modeListener = new window.ROSLIB.Topic({ ros, name: '/robot/mode_str', messageType: 'std_msgs/String' });
        modeListener.subscribe((msg) => {
            const mode = msg.data.toUpperCase().trim();
            if (mode !== 'AUTONOMOUS' && mode !== 'AUTO') {
                if (setActiveTool) setActiveTool(null);
            }
        });
        return () => modeListener.unsubscribe();
    }, [ros, setActiveTool]);

    // Animation Loop
    useEffect(() => {
        if (!isReady || !renderer || !scene || !camera) return;

        let animationId;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            if (controls) controls.update();
            if (updateRobots) updateRobots();   // syncs all robot groups with RMF poses
            renderer.render(scene, camera);
        };
        animate();

        return () => cancelAnimationFrame(animationId);
    }, [isReady, renderer, scene, camera, controls, updateRobots]);

    // Input Handlers
    const onPointerDown = (e) => {
        if (controls && activeTool) controls.enabled = false;
        if (mountNode) handlePointerDown(e, mountNode);
    };
    const onPointerMove = (e) => {
        if (mountNode) handlePointerMove(e, mountNode);
    };
    const onPointerUp = (e) => {
        handlePointerUp(e, controls);
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div
                ref={mountRefCallback}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
            />
        </div>
    );
}

Map3D.propTypes = {
    ros:          PropTypes.object,   // rosbridge connection — sensors only (LEGACY until Phase 4)
    showFootprint: PropTypes.bool,
    viewMode:     PropTypes.string,
    activeTool:   PropTypes.string,
    setActiveTool: PropTypes.func
};
