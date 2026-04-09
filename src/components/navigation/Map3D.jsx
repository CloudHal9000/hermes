import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useMapScene } from './map-layers/useMapScene';
import { useTfGraph } from './map-layers/useTfGraph';
import { useRobotModel } from './map-layers/useRobotModel';
import { useLidarLayer } from './map-layers/useLidarLayer';
import { useCostmapLayer } from './map-layers/useCostmapLayer';
import { usePathLayer } from './map-layers/usePathLayer';
import { useNavigationTool } from './map-layers/useNavigationTool';
import { AMCLHelper } from '../../utils/amclHelper';

export default function Map3D({ ros, showFootprint, viewMode, activeTool, setActiveTool }) {
    // 0. Container Ref (Callback Ref pattern to ensure existence)
    const [mountNode, setMountNode] = useState(null);
    const mountRefCallback = useCallback((node) => {
        if (node !== null) {
            setMountNode(node);
        }
    }, []);
    
    // 1. Scene Setup
    const { scene, camera, renderer, controls, floorPlane, isReady } = useMapScene(mountNode, viewMode);

    // 2. TF Graph (Centralized Transform System)
    const tfGraph = useTfGraph(ros);

    // 3. Robot Model (Visuals + Footprint)
    const { update: updateRobot, robotGroup } = useRobotModel(ros, scene, tfGraph, showFootprint);

    // 4. Sensors & Data Layers
    useLidarLayer(ros, robotGroup, tfGraph);
    useCostmapLayer(ros, scene);
    usePathLayer(ros, scene);

    // 5. Tools (Navigation / AMCL)
    const { handlePointerDown, handlePointerMove, handlePointerUp } = useNavigationTool(
        ros, scene, camera, floorPlane, activeTool, setActiveTool
    );

    // Legacy: AMCL Helper initialization
    useEffect(() => {
        if (ros) {
            new AMCLHelper(ros); 
        }
    }, [ros]);

    // Mode Listener
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
            if (updateRobot) updateRobot();
            
            renderer.render(scene, camera);
        };
        animate();

        return () => cancelAnimationFrame(animationId);
    }, [isReady, renderer, scene, camera, controls, updateRobot]);

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
    ros: PropTypes.object,
    showFootprint: PropTypes.bool,
    viewMode: PropTypes.string,
    activeTool: PropTypes.string,
    setActiveTool: PropTypes.func
};
