import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export function useMapScene(containerElement, viewMode) {
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const floorPlaneRef = useRef(null);
    
    // We use a state to signal when the scene is fully initialized
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const mount = containerElement;
        if (!mount) return;

        // 1. Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f111a);
        sceneRef.current = scene;

        // 2. Camera
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(-10, -10, 10);
        camera.up.set(0, 0, 1);
        cameraRef.current = camera;

        // 3. Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // 4. Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;

        // 5. Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, -10, 15);
        scene.add(dirLight);

        // 6. Grid
        const grid = new THREE.GridHelper(60, 60, 0x00d26a, 0x2a3b4c);
        grid.rotation.x = Math.PI / 2;
        scene.add(grid);

        // 7. Invisible Floor Plane (for Raycasting)
        const planeGeo = new THREE.PlaneGeometry(500, 500);
        const planeMat = new THREE.MeshBasicMaterial({ visible: false });
        const floorPlane = new THREE.Mesh(planeGeo, planeMat);
        scene.add(floorPlane);
        floorPlaneRef.current = floorPlane;

        // 8. Handle Resize
        const handleResize = () => {
            if (!mount) return;
            const newWidth = mount.clientWidth;
            const newHeight = mount.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        };
        window.addEventListener('resize', handleResize);

        setIsReady(true);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (mount) mount.removeChild(renderer.domElement);
            renderer.dispose();
            // We can also dispose geometries/materials here if needed
        };
    }, [containerElement]);

    // Update view mode logic
    useEffect(() => {
        if (!cameraRef.current || !controlsRef.current) return;
        const camera = cameraRef.current;
        const controls = controlsRef.current;

        controls.reset();
        if (viewMode === '2D') {
            camera.position.set(0, 0, 50);
            camera.up.set(0, 1, 0);
            camera.lookAt(0, 0, 0);
            controls.enableRotate = false;
            controls.enablePan = true;
        } else if (viewMode === '3D') {
            camera.position.set(-10, -10, 10);
            camera.up.set(0, 0, 1);
            camera.lookAt(0, 0, 0);
            controls.enableRotate = false; // Fixed angle 3D
            controls.enablePan = true;
        } else if (viewMode === 'FREE') {
            camera.up.set(0, 0, 1);
            controls.enableRotate = true;
            controls.enablePan = true;
        }
        controls.update();
    }, [viewMode, isReady]);

    return {
        scene: sceneRef.current,
        camera: cameraRef.current,
        renderer: rendererRef.current,
        controls: controlsRef.current,
        floorPlane: floorPlaneRef.current,
        isReady
    };
}
