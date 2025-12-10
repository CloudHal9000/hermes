import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import URDFLoader from 'urdf-loader';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { SimpleTfGraph } from '../utils/SimpleTfGraph';

// Função auxiliar matemática (Fora do componente para ser leve)
function getQuaternionFromYaw(yaw) {
  const half = yaw * 0.5;
  return {
    x: 0.0,
    y: 0.0,
    z: Math.sin(half),
    w: Math.cos(half)
  };
}

export function Map3D({ ros }) {
  const mountRef = useRef(null);
  const tfGraphRef = useRef(null);
  const robotRef = useRef(null);
  const pathLineRef = useRef(null);
  
  // --- COSTMAP REFS ---
  const costmapMeshRef = useRef(null);
  const [showCostmap, setShowCostmap] = useState(false);

  // --- NAV TOOLS ---
  const [activeTool, setActiveTool] = useState(null);
  const [currentMode, setCurrentMode] = useState('UNKNOWN');
  
  // Guardar a posição atual do robô para calcular a rotação da meta
  const robotPoseRef = useRef({ x: 0, y: 0, theta: 0 });

  const goalMarkerRef = useRef(null);
  const poseMarkerRef = useRef(null);
  const floorPlaneRef = useRef(null);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);

  const TOPIC_GOAL = '/ui/navigate_to_pose';
  const TOPIC_INIT = '/initialpose';

  useEffect(() => {
    if (!ros) return;
    const modeListener = new ROSLIB.Topic({
      ros: ros,
      name: '/robot/mode_str',
      messageType: 'std_msgs/String'
    });
    modeListener.subscribe((msg) => {
      const mode = msg.data.toUpperCase().trim();
      setCurrentMode(mode);
      if (mode !== 'AUTONOMOUS' && mode !== 'AUTO') setActiveTool(null);
    });
    return () => modeListener.unsubscribe();
  }, [ros]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ros) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    
    const tfGraph = new SimpleTfGraph(ros);
    tfGraphRef.current = tfGraph;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);
    
    const scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x0f111a);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000); 
    camera.position.set(3, -3, 4); 
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement); 
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    dirLight.position.set(5, -10, 15); 
    scene.add(dirLight);

    const grid = new THREE.GridHelper(60, 60, 0x00d26a, 0x2a3b4c); 
    grid.rotation.x = Math.PI / 2; 
    scene.add(grid);

    const planeGeo = new THREE.PlaneGeometry(100, 100);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    const floorPlane = new THREE.Mesh(planeGeo, planeMat);
    scene.add(floorPlane);
    floorPlaneRef.current = floorPlane;

    const goalArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 0.8, 0xffff00, 0.3, 0.2);
    goalArrow.visible = false; scene.add(goalArrow); goalMarkerRef.current = goalArrow;

    const poseArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 0.8, 0x9d00ff, 0.3, 0.2);
    poseArrow.visible = false; scene.add(poseArrow); poseMarkerRef.current = poseArrow;

    const robotGroup = new THREE.Group(); scene.add(robotGroup);
    const loader = new URDFLoader(); 
    loader.packages = { 'freebotics_description': './freebotics_description' };
    loader.load('./urdf/robot.urdf', (robot) => {
        robot.position.z = 0.23; 
        robot.traverse(c => { c.castShadow = true; c.receiveShadow = true; });
        robotRef.current = robot;
        robotGroup.add(robot);
    });

    const updateLidar = (msg, geo) => {
        const tf = tfGraphRef.current?.lookupTransform('base_link', msg.header.frame_id);
        if (!tf) return;
        const pts = []; let ang = msg.angle_min;
        for (let i=0; i<msg.ranges.length; i++) {
            const r = msg.ranges[i];
            if (r > msg.range_min && r < 20) {
                const lx = r * Math.cos(ang), ly = r * Math.sin(ang);
                const v = SimpleTfGraph._rotateVector({x:lx, y:ly, z:0}, tf.q);
                pts.push(v.x + tf.t.x, v.y + tf.t.y, v.z + tf.t.z + 0.1);
            }
            ang += msg.angle_increment;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    };

    const frontGeo = new THREE.BufferGeometry(); robotGroup.add(new THREE.Points(frontGeo, new THREE.PointsMaterial({ size: 0.03, color: 0xff0000 })));
    const rearGeo = new THREE.BufferGeometry(); robotGroup.add(new THREE.Points(rearGeo, new THREE.PointsMaterial({ size: 0.03, color: 0x00ffff })));
    
    const pathMat = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const pathGeo = new THREE.BufferGeometry();
    const pathLine = new THREE.Line(pathGeo, pathMat); pathLine.position.z = 0.05; scene.add(pathLine); pathLineRef.current = pathLine;

    const odomSub = new ROSLIB.Topic({ ros, name: '/hoverboard_base_controller/odom', messageType: 'nav_msgs/Odometry' });
    
    odomSub.subscribe(msg => {
        const p = msg.pose.pose.position;
        const q = msg.pose.pose.orientation;
        
        // Atualiza grupo visual
        robotGroup.position.set(p.x, p.y, 0);
        const siny = 2.0 * (q.w * q.z + q.x * q.y);
        const cosy = 1.0 - 2.0 * (q.y * q.y + q.z * q.z);
        const yaw = Math.atan2(siny, cosy);
        robotGroup.rotation.z = yaw;

        // --- ATUALIZA REF DE POSIÇÃO PARA NAVEGAÇÃO ---
        robotPoseRef.current = { x: p.x, y: p.y, theta: yaw };
    });
    
    const fScan = new ROSLIB.Topic({ ros, name: '/lidar/front', messageType: 'sensor_msgs/LaserScan' }); fScan.subscribe(m => updateLidar(m, frontGeo));
    const rScan = new ROSLIB.Topic({ ros, name: '/lidar/rear', messageType: 'sensor_msgs/LaserScan' }); rScan.subscribe(m => updateLidar(m, rearGeo));
    
    const pathSub = new ROSLIB.Topic({ ros, name: '/plan', messageType: 'nav_msgs/Path' });
    pathSub.subscribe(msg => {
        if(!pathLineRef.current) return;
        const points = msg.poses.map(p => new THREE.Vector3(p.pose.position.x, p.pose.position.y, 0));
        pathLineRef.current.geometry.setFromPoints(points);
    });

    const mapListener = new ROSLIB.Topic({ ros, name: '/map', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
    // (Map listener code mantido, omitido para brevidade...)

    const costmapSub = new ROSLIB.Topic({
        ros: ros,
        name: '/local_costmap/costmap/costmap',
        messageType: 'nav_msgs/OccupancyGrid',
        compression: 'cbor'
    });

    costmapSub.subscribe((msg) => {
        if (!costmapMeshRef.current || !costmapMeshRef.current.visible) return;
        const w = msg.info.width; const h = msg.info.height; const res = msg.info.resolution; const origin = msg.info.origin;
        const data = new Uint8Array(4 * w * h);
        for (let i = 0; i < w * h; i++) {
            const val = msg.data[i]; const s = i * 4;
            if (val === 0 || val === -1) { data[s] = 0; data[s+1] = 0; data[s+2] = 0; data[s+3] = 0; } 
            else { 
                const intensity = val / 100.0;
                data[s] = 255; data[s+1] = 255 * (1 - intensity); data[s+2] = val > 98 ? 255 : 0; data[s+3] = 180; 
            }
        }
        const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); texture.needsUpdate = true; texture.magFilter = THREE.NearestFilter; texture.flipY = false;
        if (costmapMeshRef.current.material.map) costmapMeshRef.current.material.map.dispose();
        costmapMeshRef.current.material.map = texture; costmapMeshRef.current.material.needsUpdate = true;
        costmapMeshRef.current.position.set(origin.position.x + w*res/2, origin.position.y + h*res/2, 0.02);
        costmapMeshRef.current.scale.set(w * res, h * res, 1);
    });

    const cmGeo = new THREE.PlaneGeometry(1, 1); const cmMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const cmMesh = new THREE.Mesh(cmGeo, cmMat); cmMesh.visible = false; scene.add(cmMesh); costmapMeshRef.current = cmMesh;

    const animate = () => { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();

    return () => {
        odomSub.unsubscribe(); fScan.unsubscribe(); rScan.unsubscribe(); pathSub.unsubscribe(); costmapSub.unsubscribe(); mapListener.unsubscribe();
        if(tfGraphRef.current) tfGraphRef.current.destroy();
        if(mount) mount.removeChild(renderer.domElement);
        renderer.dispose();
    };
  }, [ros]);

  // Efeitos visuais
  useEffect(() => { if (costmapMeshRef.current) costmapMeshRef.current.visible = showCostmap; }, [showCostmap]);
  useEffect(() => { 
      if (mountRef.current) mountRef.current.style.cursor = activeTool ? 'crosshair' : 'default';
      if (controlsRef.current) controlsRef.current.enabled = !activeTool;
  }, [activeTool]);

  const handleMapClick = (event) => {
    if (!activeTool || !floorPlaneRef.current || !cameraRef.current || !ros) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObject(floorPlaneRef.current);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        if (activeTool === 'GOAL') {
            // --- CÁLCULO INTELIGENTE DA ROTAÇÃO ---
            // 1. Pega onde o robô está
            const robotPos = robotPoseRef.current;
            // 2. Calcula vetor direção (Destino - Origem)
            const dx = point.x - robotPos.x;
            const dy = point.y - robotPos.y;
            // 3. Calcula o ângulo em radianos
            const yaw = Math.atan2(dy, dx);
            // 4. Converte para Quaternion
            const orientation = getQuaternionFromYaw(yaw);

            // Atualiza seta visual com a rotação calculada
            if (goalMarkerRef.current) { 
                goalMarkerRef.current.position.set(point.x, point.y, 0.2); 
                goalMarkerRef.current.setRotationFromEuler(new THREE.Euler(0, 0, yaw));
                goalMarkerRef.current.visible = true; 
            }
            
            const goalTopic = new ROSLIB.Topic({ ros, name: TOPIC_GOAL, messageType: 'geometry_msgs/PoseStamped' });
            goalTopic.publish({ 
                header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } }, 
                pose: { 
                    position: { x: point.x, y: point.y, z: 0 }, 
                    // Envia a orientação correta (alinhada com o caminho)
                    orientation: orientation 
                } 
            });
        }
        
        if (activeTool === 'POSE') {
            if (poseMarkerRef.current) { poseMarkerRef.current.position.set(point.x, point.y, 0.2); poseMarkerRef.current.visible = true; }
            const initTopic = new ROSLIB.Topic({ ros, name: TOPIC_INIT, messageType: 'geometry_msgs/PoseWithCovarianceStamped' });
            const cov = [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.068];
            // Para Initial Pose, geralmente assumimos rotação 0 ou a atual, aqui deixo 0 (w=1) 
            // pois o usuário geralmente ajusta a posição e o AMCL corrige a rotação
            initTopic.publish({ header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } }, pose: { pose: { position: { x: point.x, y: point.y, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }, covariance: cov } });
        }
        setActiveTool(null);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {(currentMode === 'AUTO' || currentMode === 'AUTONOMOUS') && (
            <aside style={{ 
                position: 'absolute', top: '250px', left: '20px', width: '280px', zIndex: 10,
                background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '15px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)', pointerEvents: 'auto',
                display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>CONTROLE NAV2</div>
                <button onClick={() => setActiveTool(activeTool === 'GOAL' ? null : 'GOAL')} style={{ background: activeTool === 'GOAL' ? '#ff4b5c' : 'rgba(0, 210, 106, 0.1)', color: activeTool === 'GOAL' ? '#fff' : '#00d26a', border: '1px solid #00d26a', borderRadius: '8px', padding: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{activeTool === 'GOAL' ? '❌ CANCELAR' : '🎯 DEFINIR META'}</button>
                <button onClick={() => setActiveTool(activeTool === 'POSE' ? null : 'POSE')} style={{ background: activeTool === 'POSE' ? '#ff4b5c' : 'rgba(157, 0, 255, 0.1)', color: activeTool === 'POSE' ? '#fff' : '#9d00ff', border: '1px solid #9d00ff', borderRadius: '8px', padding: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{activeTool === 'POSE' ? '❌ CANCELAR' : '📍 DEFINIR POSIÇÃO'}</button>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', width: '100%' }} />
                <button onClick={() => setShowCostmap(!showCostmap)} style={{ background: showCostmap ? 'rgba(255, 165, 0, 0.2)' : 'transparent', color: showCostmap ? '#ffa500' : '#888', border: showCostmap ? '1px solid #ffa500' : '1px solid #444', borderRadius: '8px', padding: '8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{showCostmap ? '🔥 ESCONDER COSTMAP' : '👁️ VER COSTMAP'}</button>
            </aside>
        )}
        <div ref={mountRef} onClick={handleMapClick} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

Map3D.propTypes = { ros: PropTypes.object };