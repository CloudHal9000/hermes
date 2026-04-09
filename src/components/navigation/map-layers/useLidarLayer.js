import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimpleTfGraph } from '../../../utils/SimpleTfGraph';

export function useLidarLayer(ros, parentGroup, tfGraph) {
    const frontPointsRef = useRef(null);
    const rearPointsRef = useRef(null);

    const BASE_FRAME = 'base_footprint';

    useEffect(() => {
        if (!ros || !parentGroup) return;

        // Front Lidar
        const frontGeo = new THREE.BufferGeometry();
        const frontPoints = new THREE.Points(frontGeo, new THREE.PointsMaterial({ size: 0.05, color: 0xff0000 }));
        parentGroup.add(frontPoints);
        frontPointsRef.current = frontPoints;

        // Rear Lidar
        const rearGeo = new THREE.BufferGeometry();
        const rearPoints = new THREE.Points(rearGeo, new THREE.PointsMaterial({ size: 0.05, color: 0x00ffff }));
        parentGroup.add(rearPoints);
        rearPointsRef.current = rearPoints;

        // Helper function
        const updateLidar = (msg, geo) => {
            if (!tfGraph) return;

            const pts = [];
            let ang = msg.angle_min;
            for (let i = 0; i < msg.ranges.length; i++) {
                const r = msg.ranges[i];
                if (r > msg.range_min && r < 20) {
                    const lx = r * Math.cos(ang);
                    const ly = r * Math.sin(ang);
                    pts.push(lx, ly, 0);
                }
                ang += msg.angle_increment;
            }
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        };

        const fScan = new window.ROSLIB.Topic({ ros, name: '/lidar/front_aligned', messageType: 'sensor_msgs/msg/LaserScan' });
        fScan.subscribe(m => updateLidar(m, frontGeo));

        const rScan = new window.ROSLIB.Topic({ ros, name: '/lidar/rear_aligned', messageType: 'sensor_msgs/msg/LaserScan' });
        rScan.subscribe(m => updateLidar(m, rearGeo));

        return () => {
            fScan.unsubscribe();
            rScan.unsubscribe();
            if (parentGroup) {
                parentGroup.remove(frontPoints);
                parentGroup.remove(rearPoints);
            }
            frontGeo.dispose();
            rearGeo.dispose();
        };
    }, [ros, parentGroup, tfGraph]);
}