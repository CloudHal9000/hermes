import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import URDFLoader from 'urdf-loader';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { SimpleTfGraph } from '../utils/SimpleTfGraph';

export function Map3D({ ros }) {
  const mountRef = useRef(null);
  const mapMeshRef = useRef(null);
  const robotRef = useRef(null);
  const tfGraphRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ros) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (width === 0 || height === 0) return;

    // --- 1. SETUP DO TF ---
    const tfGraph = new SimpleTfGraph(ros);
    tfGraphRef.current = tfGraph;

    // --- 2. CENA THREE.JS ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f111a);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(3, -3, 4); 
    camera.up.set(0, 0, 1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, -10, 15);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const grid = new THREE.GridHelper(60, 60, 0x00d26a, 0x2a3b4c);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    // GRUPO MUNDO (Odometria move este grupo)
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // --- 3. CARREGAR URDF (VISUAL DO ROBÔ) ---
    const loader = new URDFLoader();
    loader.packages = { 'freebotics_description': './freebotics_description' };

    loader.load('./urdf/robot.urdf', (robot) => {
        // Ajuste de Altura (Rodas no chão)
        robot.position.z = 0.23; 
        
        // --- CORREÇÃO DE ROTAÇÃO (AQUI!) ---
        // 1. Mantém em pé (eixo X)
        //robot.rotation.x = -Math.PI / 2; 
        
        // 2. Gira 180 graus (eixo Z) para olhar para frente
        // Isso gira apenas a malha, não os sensores (que são irmãos, não filhos)
        // robot.rotation.z = Math.PI;

        robot.traverse(c => {
            c.castShadow = true;
            c.receiveShadow = true;
        });

        robotRef.current = robot;
        robotGroup.add(robot); // Adiciona ao grupo, ao lado dos sensores
    });

    // --- 4. LIDARES (USANDO TF) ---
    
    // Função que usa o SimpleTfGraph para calcular a posição exata
    const updateLidarWithTF = (msg, geometry) => {
        const tf = tfGraphRef.current;
        if (!tf) return;

        // Pede ao TF: "Onde está o sensor no frame do robô?"
        const transform = tf.lookupTransform('base_link', msg.header.frame_id);
        
        if (!transform) return;

        const positions = [];
        let angle = msg.angle_min;
        
        for (let i = 0; i < msg.ranges.length; i++) {
            const r = msg.ranges[i];
            if (r > msg.range_min && r < msg.range_max && r < 20) {
                // 1. Polar -> Cartesiano Local
                const lx = r * Math.cos(angle);
                const ly = r * Math.sin(angle);
                const lz = 0.0;

                // 2. Rotação do TF
                const v = { x: lx, y: ly, z: lz };
                const vRot = SimpleTfGraph._rotateVector(v, transform.q);

                // 3. Translação do TF
                const finalX = vRot.x + transform.t.x;
                const finalY = vRot.y + transform.t.y;
                const finalZ = vRot.z + transform.t.z;

                positions.push(finalX, finalY, finalZ + 0.1); 
            }
            angle += msg.angle_increment;
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeBoundingSphere();
    };

    // Geometrias dos Sensores
    const frontGeo = new THREE.BufferGeometry();
    const frontMat = new THREE.PointsMaterial({ size: 0.03, color: 0xff0000 });
    const frontPoints = new THREE.Points(frontGeo, frontMat);
    robotGroup.add(frontPoints);

    const rearGeo = new THREE.BufferGeometry();
    const rearMat = new THREE.PointsMaterial({ size: 0.03, color: 0x00ffff });
    const rearPoints = new THREE.Points(rearGeo, rearMat);
    robotGroup.add(rearPoints);

    // --- LISTENERS ---
    
    const odomListener = new ROSLIB.Topic({
        ros: ros,
        name: '/hoverboard_base_controller/odom',
        messageType: 'nav_msgs/Odometry'
    });
    odomListener.subscribe((msg) => {
        const p = msg.pose.pose.position;
        const q = msg.pose.pose.orientation;
        robotGroup.position.set(p.x, p.y, 0);
        const siny = 2.0 * (q.w * q.z + q.x * q.y);
        const cosy = 1.0 - 2.0 * (q.y * q.y + q.z * q.z);
        robotGroup.rotation.z = Math.atan2(siny, cosy);
    });

    const frontLidarListener = new ROSLIB.Topic({
        ros: ros,
        name: '/lidar/front',
        messageType: 'sensor_msgs/LaserScan'
    });
    frontLidarListener.subscribe((msg) => updateLidarWithTF(msg, frontGeo));

    const rearLidarListener = new ROSLIB.Topic({
        ros: ros,
        name: '/lidar/rear',
        messageType: 'sensor_msgs/LaserScan'
    });
    rearLidarListener.subscribe((msg) => updateLidarWithTF(msg, rearGeo));

    const mapListener = new ROSLIB.Topic({
        ros: ros,
        name: '/map',
        messageType: 'nav_msgs/OccupancyGrid',
        compression: 'cbor'
    });
    mapListener.subscribe((msg) => {
        if (mapMeshRef.current) {
            scene.remove(mapMeshRef.current);
            mapMeshRef.current.geometry.dispose();
            mapMeshRef.current.material.dispose();
        }
        const w = msg.info.width;
        const h = msg.info.height;
        const res = msg.info.resolution;
        const origin = msg.info.origin;

        const data = new Uint8Array(4 * w * h);
        for (let i = 0; i < w * h; i++) {
            const val = msg.data[i];
            const s = i * 4;
            if (val === -1) { data[s]=0; data[s+1]=0; data[s+2]=0; data[s+3]=0; }
            else if (val >= 100) { data[s]=0; data[s+1]=255; data[s+2]=255; data[s+3]=255; }
            else { data[s]=30; data[s+1]=40; data[s+2]=50; data[s+3]=200; }
        }
        const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.magFilter = THREE.NearestFilter;
        texture.flipY = false;

        const mapMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w * res, h * res),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        mapMesh.position.set(origin.position.x + w*res/2, origin.position.y + h*res/2, -0.05);
        mapMeshRef.current = mapMesh;
        scene.add(mapMesh);
    });

    // --- LOOP E RESIZE ---
    const handleResize = () => {
        if (!mount) return;
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    let animationId;
    const animate = () => {
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    };
    animate();

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationId);
        odomListener.unsubscribe();
        frontLidarListener.unsubscribe();
        rearLidarListener.unsubscribe();
        mapListener.unsubscribe();
        
        if (tfGraphRef.current) tfGraphRef.current.destroy(); // Limpa o TF

        if (mount && renderer.domElement) mount.removeChild(renderer.domElement);
        renderer.dispose();
    };
  }, [ros]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%', height: '100%', display: 'flex' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

Map3D.propTypes = { ros: PropTypes.object };