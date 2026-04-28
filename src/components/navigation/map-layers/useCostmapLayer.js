import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function useCostmapLayer(ros, scene) {
    const localCostmapRef = useRef(null);
    const globalCostmapRef = useRef(null);
    // PERF: reutiliza DataTexture para evitar ~1.18MB/s de pressão no GC
    // Ref: docs/performance-benchmark-report.md — Quick Win 1
    const localTextureRef = useRef(null);
    const globalTextureRef = useRef(null);

    useEffect(() => {
        if (!scene || !ros) return;

        const cmGeo = new THREE.PlaneGeometry(1, 1);
        
        // Local Costmap Mesh
        const localCmMesh = new THREE.Mesh(cmGeo, new THREE.MeshBasicMaterial({ 
            transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false 
        }));
        localCmMesh.visible = false;
        scene.add(localCmMesh);
        localCostmapRef.current = localCmMesh;

        // Global Costmap Mesh
        const globalCmMesh = new THREE.Mesh(cmGeo, new THREE.MeshBasicMaterial({ 
            transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false 
        }));
        globalCmMesh.visible = false;
        scene.add(globalCmMesh);
        globalCostmapRef.current = globalCmMesh;

        // Map (Static) Mesh
        const mapMeshRef = { current: null };

        const updateCostmapMesh = (msg, meshRef, textureRef, colorType) => {
            if (!meshRef.current) return;
            const w = msg.info.width; const h = msg.info.height; const res = msg.info.resolution; const origin = msg.info.origin;

            // Reutilizar textura existente se as dimensões não mudaram,
            // evitando alocação de Uint8Array e GPU re-upload desnecessários.
            let texture = textureRef.current;
            let data;
            if (!texture || texture.image.width !== w || texture.image.height !== h) {
                data = new Uint8Array(4 * w * h);
                if (texture) texture.dispose();
                texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
                texture.magFilter = THREE.NearestFilter;
                texture.flipY = false;
                textureRef.current = texture;
                if (meshRef.current.material.map) meshRef.current.material.map.dispose();
                meshRef.current.material.map = texture;
                meshRef.current.material.needsUpdate = true;
            } else {
                data = texture.image.data;
            }

            for (let i = 0; i < w * h; i++) {
                const val = msg.data[i]; const s = i * 4;
                if (val <= 0) { data[s] = 0; data[s + 1] = 0; data[s + 2] = 0; data[s + 3] = 0; }
                else {
                    const intensity = val / 100.0;
                    data[s + 3] = 180;
                    if (colorType === 'LOCAL') { data[s] = 255; data[s + 1] = 255 * (1 - intensity); data[s + 2] = 0; }
                    else { data[s] = 50 * intensity; data[s + 1] = 255 * (1 - intensity); data[s + 2] = 255; }
                }
            }

            texture.needsUpdate = true;
            meshRef.current.position.set(origin.position.x + w * res / 2, origin.position.y + h * res / 2, colorType === 'LOCAL' ? 0.02 : 0.01);
            meshRef.current.scale.set(w * res, h * res, 1);
            meshRef.current.visible = true;
        };

        const localCmSub = new window.ROSLIB.Topic({ ros, name: '/local_costmap/costmap', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
        localCmSub.subscribe((msg) => { if (localCostmapRef.current) updateCostmapMesh(msg, localCostmapRef, localTextureRef, 'LOCAL'); });

        const globalCmSub = new window.ROSLIB.Topic({ ros, name: '/global_costmap/costmap', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
        globalCmSub.subscribe((msg) => { if (globalCostmapRef.current) updateCostmapMesh(msg, globalCostmapRef, globalTextureRef, 'GLOBAL'); });

        const mapListener = new window.ROSLIB.Topic({ ros, name: '/map', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
        mapListener.subscribe((msg) => {
            const w = msg.info.width; const h = msg.info.height; const res = msg.info.resolution; const origin = msg.info.origin;
            const data = new Uint8Array(4 * w * h);
            for (let i = 0; i < w * h; i++) {
                const val = msg.data[i]; const s = i * 4;
                if (val === -1) { data[s] = 0; data[s + 1] = 0; data[s + 2] = 0; data[s + 3] = 0; }
                else if (val >= 100) { data[s] = 200; data[s + 1] = 200; data[s + 2] = 255; data[s + 3] = 255; }
                else { data[s] = 30; data[s + 1] = 40; data[s + 2] = 50; data[s + 3] = 200; }
            }
            const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); 
            texture.needsUpdate = true; texture.magFilter = THREE.NearestFilter; texture.flipY = false;
            
            const mapMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(w * res, h * res), 
                new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })
            );
            mapMesh.position.set(origin.position.x + w * res / 2, origin.position.y + h * res / 2, -0.05);
            mapMesh.quaternion.set(origin.orientation.x, origin.orientation.y, origin.orientation.z, origin.orientation.w);
            
            if (mapMeshRef.current) {
                scene.remove(mapMeshRef.current);
                mapMeshRef.current.geometry.dispose();
                if (mapMeshRef.current.material.map) mapMeshRef.current.material.map.dispose();
                mapMeshRef.current.material.dispose();
            }
            scene.add(mapMesh);
            mapMeshRef.current = mapMesh;
        });

        return () => {
            localCmSub.unsubscribe();
            globalCmSub.unsubscribe();
            mapListener.unsubscribe();
            
            if (localCmMesh) { scene.remove(localCmMesh); localCmMesh.geometry.dispose(); localCmMesh.material.dispose(); }
            if (globalCmMesh) { scene.remove(globalCmMesh); globalCmMesh.geometry.dispose(); globalCmMesh.material.dispose(); }
            if (mapMeshRef.current) { scene.remove(mapMeshRef.current); mapMeshRef.current.geometry.dispose(); mapMeshRef.current.material.dispose(); }
            if (localTextureRef.current) { localTextureRef.current.dispose(); localTextureRef.current = null; }
            if (globalTextureRef.current) { globalTextureRef.current.dispose(); globalTextureRef.current = null; }
        };
    }, [ros, scene]);
}
