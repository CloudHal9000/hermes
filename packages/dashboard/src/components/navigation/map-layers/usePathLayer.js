import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function usePathLayer(ros, scene) {
    const pathLineRef = useRef(null);

    useEffect(() => {
        if (!scene || !ros) return;

        const pathMat = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        const pathGeo = new THREE.BufferGeometry();
        const pathLine = new THREE.Line(pathGeo, pathMat);
        pathLine.position.z = 0.02;
        scene.add(pathLine);
        pathLineRef.current = pathLine;

        const pathSub = new window.ROSLIB.Topic({ ros, name: '/plan', messageType: 'nav_msgs/Path' });
        pathSub.subscribe(msg => {
            if (!pathLineRef.current) return;
            const points = msg.poses.map(p => new THREE.Vector3(p.pose.position.x, p.pose.position.y, 0));
            pathLineRef.current.geometry.setFromPoints(points);
        });

        return () => {
            pathSub.unsubscribe();
            if (pathLineRef.current) {
                scene.remove(pathLineRef.current);
                pathLineRef.current.geometry.dispose();
                pathLineRef.current.material.dispose();
            }
        };
    }, [ros, scene]);
}
