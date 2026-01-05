import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import URDFLoader from 'urdf-loader';
import * as ROSLIB from 'roslib';
import PropTypes from 'prop-types';
import { SimpleTfGraph } from '../utils/SimpleTfGraph';
import { AMCLHelper } from '../utils/amclHelper';

function getQuaternionFromYaw(yaw) {
  const half = yaw * 0.5;
  return { x: 0.0, y: 0.0, z: Math.sin(half), w: Math.cos(half) };
}

export function Map3D({ ros, showFootprint, viewMode, activeTool, setActiveTool }) {
  const mountRef = useRef(null);
  
  const tfGraphRef = useRef(null);
  const robotGroupRef = useRef(null);
  const amclHelperRef = useRef(null);
  const amclParticlesRef = useRef(null);
  
  const localCostmapRef = useRef(null);
  const globalCostmapRef = useRef(null);
  const footprintRef = useRef(null);
  const pathLineRef = useRef(null);
  
  const dragStartRef = useRef(null);
  const isDraggingRef = useRef(false);
  
  const goalMarkerRef = useRef(null);
  const poseMarkerRef = useRef(null);
  const floorPlaneRef = useRef(null);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const mapMeshRef = useRef(null);
  const goalTopicRef = useRef(null);
  const initTopicRef = useRef(null);

  const WORLD_FRAME = 'map';
  const BASE_FRAME = 'base_footprint';
  const TOPIC_GOAL = '/ui/navigate_to_pose';
  const TOPIC_INIT = '/initialpose';

  useEffect(() => {
    if (ros) {
        amclHelperRef.current = new AMCLHelper(ros);
    }
  }, [ros]);

  useEffect(() => {
    if (!ros) return;
    const modeListener = new ROSLIB.Topic({ ros, name: '/robot/mode_str', messageType: 'std_msgs/String' });
    modeListener.subscribe((msg) => {
      const mode = msg.data.toUpperCase().trim();
      if (mode !== 'AUTONOMOUS' && mode !== 'AUTO') {
          if (setActiveTool) setActiveTool(null);
      }
    });
    return () => modeListener.unsubscribe();
  }, [ros, setActiveTool]);

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
    camera.position.set(-10, -10, 10);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement); 
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    dirLight.position.set(5, -10, 15); 
    scene.add(dirLight);

    const grid = new THREE.GridHelper(60, 60, 0x00d26a, 0x2a3b4c); 
    grid.rotation.x = Math.PI / 2; 
    scene.add(grid);

    const planeGeo = new THREE.PlaneGeometry(500, 500);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    const floorPlane = new THREE.Mesh(planeGeo, planeMat);
    scene.add(floorPlane);
    floorPlaneRef.current = floorPlane;

    const goalArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 1.5, 0xffff00, 0.4, 0.3);
    goalArrow.visible = false; scene.add(goalArrow); goalMarkerRef.current = goalArrow;

    const poseArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 1.5, 0x9d00ff, 0.4, 0.3);
    poseArrow.visible = false; scene.add(poseArrow); poseMarkerRef.current = poseArrow;
    
    const particlesGeo = new THREE.BufferGeometry();
    const particlesMat = new THREE.PointsMaterial({ size: 0.1, color: 0x00ff00, transparent: true, opacity: 0.6 });
    const particlesCloud = new THREE.Points(particlesGeo, particlesMat);
    particlesCloud.visible = false;
    scene.add(particlesCloud);
    amclParticlesRef.current = particlesCloud;

    const robotGroup = new THREE.Group(); 
    scene.add(robotGroup);
    robotGroupRef.current = robotGroup;

    // --- GRUPO DE ROTAÇÃO VISUAL (Corrige o 180º) ---
    const visualRotationGroup = new THREE.Group();
    visualRotationGroup.rotation.z = Math.PI; 
    robotGroup.add(visualRotationGroup);

    // Carrega o Modelo Visual
    const loader = new URDFLoader(); 
    loader.packages = { 'freebotics_description': './freebotics_description' };
    loader.load('./urdf/robot.urdf', (robot) => {
        // Aplica a rotação de 180 graus diretamente no modelo carregado
        robot.rotation.z = Math.PI;
        robot.position.z = 0.23;
        robot.traverse(c => { c.castShadow = true; c.receiveShadow = true; });
        visualRotationGroup.add(robot); 
    });

    // --- CORREÇÃO DO FOOTPRINT ---
    const fpGeo = new THREE.BufferGeometry();
    const fpMat = new THREE.LineBasicMaterial({ 
        color: 0x33ff33, 
        linewidth: 3,
        transparent: true,
        opacity: 0.9
    });
    const fpLine = new THREE.LineLoop(fpGeo, fpMat);
    fpLine.position.z = 0.08;
    fpLine.visible = showFootprint;
    robotGroup.add(fpLine); // Adicionado como filho do robotGroup
    footprintRef.current = fpLine;

    // --- LIDARS ---
    const frontGeo = new THREE.BufferGeometry(); 
    const rearGeo = new THREE.BufferGeometry(); 
    const frontPoints = new THREE.Points(frontGeo, new THREE.PointsMaterial({ size: 0.05, color: 0xff0000 }));
    const rearPoints = new THREE.Points(rearGeo, new THREE.PointsMaterial({ size: 0.05, color: 0x00ffff }));
    robotGroup.add(frontPoints);
    robotGroup.add(rearPoints);

    const pathMat = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const pathGeo = new THREE.BufferGeometry();
    const pathLine = new THREE.Line(pathGeo, pathMat); pathLine.position.z = 0.02; scene.add(pathLine); pathLineRef.current = pathLine;

    const updateCostmapMesh = (msg, meshRef, colorType) => {
        if (!meshRef.current) return;
        const w = msg.info.width; const h = msg.info.height; const res = msg.info.resolution; const origin = msg.info.origin;
        const data = new Uint8Array(4 * w * h);
        for (let i = 0; i < w * h; i++) {
            const val = msg.data[i]; const s = i * 4;
            if (val <= 0) { data[s]=0; data[s+1]=0; data[s+2]=0; data[s+3]=0; }
            else { 
                const intensity = val / 100.0;
                data[s+3] = 180; 
                if (colorType === 'LOCAL') { data[s]=255; data[s+1]=255*(1-intensity); data[s+2]=0; }
                else { data[s]=50*intensity; data[s+1]=255*(1-intensity); data[s+2]=255; }
            }
        }
        const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); texture.needsUpdate = true; texture.magFilter = THREE.NearestFilter; texture.flipY = false;
        if (meshRef.current.material.map) meshRef.current.material.map.dispose();
        meshRef.current.material.map = texture; meshRef.current.material.needsUpdate = true;
        meshRef.current.position.set(origin.position.x + w*res/2, origin.position.y + h*res/2, colorType === 'LOCAL' ? 0.02 : 0.01);
        meshRef.current.scale.set(w * res, h * res, 1);
        meshRef.current.visible = true; 
    };

    const cmGeo = new THREE.PlaneGeometry(1, 1); 
    const localCmMesh = new THREE.Mesh(cmGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    localCmMesh.visible = false; scene.add(localCmMesh); localCostmapRef.current = localCmMesh;
      if (localCostmapRef.current) localCostmapRef.current.visible = true;
    const globalCmMesh = new THREE.Mesh(cmGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    globalCmMesh.visible = false; scene.add(globalCmMesh); globalCostmapRef.current = globalCmMesh;
      if (globalCostmapRef.current) globalCostmapRef.current.visible = true;

    const localCmSub = new ROSLIB.Topic({ ros, name: '/local_costmap/costmap', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
    localCmSub.subscribe((msg) => { if(localCostmapRef.current && localCostmapRef.current.visible) updateCostmapMesh(msg, localCostmapRef, 'LOCAL'); });

    const globalCmSub = new ROSLIB.Topic({ ros, name: '/global_costmap/costmap', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
    globalCmSub.subscribe((msg) => { if(globalCostmapRef.current && globalCostmapRef.current.visible) updateCostmapMesh(msg, globalCostmapRef, 'GLOBAL'); });

    // --- CORREÇÃO DO LISTENER DO FOOTPRINT ---
    const fpSub = new ROSLIB.Topic({ ros, name: '/local_costmap/published_footprint', messageType: 'geometry_msgs/PolygonStamped' });
    fpSub.subscribe((msg) => {
        if (!footprintRef.current) return;
        const points = msg.polygon.points.map(p => new THREE.Vector3(p.x, p.y, 0));
        footprintRef.current.geometry.setFromPoints(points);
    });

    const odomSub = new ROSLIB.Topic({ ros, name: '/hoverboard_base_controller/odom', messageType: 'nav_msgs/Odometry' });
    odomSub.subscribe(() => {});

    const updateLidar = (msg, geo) => {
        const tf = tfGraphRef.current?.lookupTransform(BASE_FRAME, msg.header.frame_id);
        const transform = tf || { t: {x:0,y:0,z:0}, q: {x:0,y:0,z:0,w:1} };
        const pts = []; 
        let ang = msg.angle_min;
        for (let i=0; i<msg.ranges.length; i++) {
            const r = msg.ranges[i];
            if (r > msg.range_min && r < 20) {
                const lx = r * Math.cos(ang);
                const ly = r * Math.sin(ang);
                const v = SimpleTfGraph._rotateVector({x:lx, y:ly, z:0}, transform.q);
                pts.push(v.x + transform.t.x, v.y + transform.t.y, v.z + transform.t.z);
            }
            ang += msg.angle_increment;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    };

    const fScan = new ROSLIB.Topic({ ros, name: '/lidar/front', messageType: 'sensor_msgs/msg/LaserScan' }); fScan.subscribe(m => updateLidar(m, frontGeo));
    const rScan = new ROSLIB.Topic({ ros, name: '/lidar/rear', messageType: 'sensor_msgs/msg/LaserScan' }); rScan.subscribe(m => updateLidar(m, rearGeo));

    const pathSub = new ROSLIB.Topic({ ros, name: '/plan', messageType: 'nav_msgs/Path' });
    pathSub.subscribe(msg => {
        if (!pathLineRef.current) return;
        const points = msg.poses.map(p => new THREE.Vector3(p.pose.position.x, p.pose.position.y, 0));
        pathLineRef.current.geometry.setFromPoints(points);
    });
    
    const amclPoseSub = new ROSLIB.Topic({ ros, name: '/amcl_pose', messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped' });
    amclPoseSub.subscribe(() => {});
    
    const particleCloudSub = new ROSLIB.Topic({ ros, name: '/particlecloud', messageType: 'geometry_msgs/PoseArray' });
    particleCloudSub.subscribe(msg => {
        if (!amclParticlesRef.current) return;
        const positions = [];
        msg.poses.forEach(pose => { positions.push(pose.position.x, pose.position.y, 0.1); });
        amclParticlesRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        amclParticlesRef.current.visible = showFootprint;
    });

    goalTopicRef.current = new ROSLIB.Topic({ ros, name: TOPIC_GOAL, messageType: 'geometry_msgs/msg/PoseStamped' });
    initTopicRef.current = new ROSLIB.Topic({ ros, name: TOPIC_INIT, messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped' });

    const mapListener = new ROSLIB.Topic({ ros, name: '/map', messageType: 'nav_msgs/OccupancyGrid', compression: 'cbor' });
    mapListener.subscribe((msg) => {
        const w = msg.info.width; const h = msg.info.height; const res = msg.info.resolution; const origin = msg.info.origin;
        const data = new Uint8Array(4 * w * h);
        for (let i = 0; i < w * h; i++) {
            const val = msg.data[i]; const s = i * 4;
            if (val === -1) { data[s]=0; data[s+1]=0; data[s+2]=0; data[s+3]=0; }
            else if (val >= 100) { data[s]=200; data[s+1]=200; data[s+2]=255; data[s+3]=255; }
            else { data[s]=30; data[s+1]=40; data[s+2]=50; data[s+3]=200; }
        }
        const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); texture.needsUpdate = true; texture.magFilter = THREE.NearestFilter; texture.flipY = false;
        const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(w*res, h*res), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        mapMesh.position.set(origin.position.x + w*res/2, origin.position.y + h*res/2, -0.05);
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
    
    const animate = () => { 
        requestAnimationFrame(animate); 
        controls.update(); 
        if (tfGraphRef.current && robotGroupRef.current) {
            const tf = tfGraphRef.current.lookupTransform(WORLD_FRAME, BASE_FRAME);
            if (tf) {
                robotGroupRef.current.position.set(tf.t.x, tf.t.y, 0); 
                robotGroupRef.current.quaternion.set(tf.q.x, tf.q.y, tf.q.z, tf.q.w);
            }
        }
        renderer.render(scene, camera); 
    };
    animate();

    return () => {
        localCmSub.unsubscribe(); globalCmSub.unsubscribe(); fpSub.unsubscribe();
        fScan.unsubscribe(); rScan.unsubscribe(); pathSub.unsubscribe(); mapListener.unsubscribe();
        amclPoseSub.unsubscribe(); particleCloudSub.unsubscribe(); odomSub.unsubscribe();
        if (mapMeshRef.current) {
            scene.remove(mapMeshRef.current);
            mapMeshRef.current.geometry.dispose();
            if (mapMeshRef.current.material.map) mapMeshRef.current.material.map.dispose();
            mapMeshRef.current.material.dispose();
        }
        if(mount) mount.removeChild(renderer.domElement);
        renderer.dispose();
    };
  }, [ros, showFootprint]);

  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    controlsRef.current.reset();
    if (viewMode === '2D') {
        cameraRef.current.position.set(0, 0, 50); cameraRef.current.up.set(0, 1, 0); cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.enableRotate = false; controlsRef.current.enablePan = true;
    } else if (viewMode === '3D') {
        cameraRef.current.position.set(-10, -10, 10); cameraRef.current.up.set(0, 0, 1); cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.enableRotate = false; controlsRef.current.enablePan = true;
    } else if (viewMode === 'FREE') {
        cameraRef.current.up.set(0, 0, 1); controlsRef.current.enableRotate = true; controlsRef.current.enablePan = true;
    }
    controlsRef.current.update();
  }, [viewMode]);

  useEffect(() => { 
    if (footprintRef.current) {
      footprintRef.current.visible = showFootprint;
      }
  }, [showFootprint]);

  const handlePointerDown = (event) => {
    if (!activeTool || !floorPlaneRef.current || !cameraRef.current) return;
    if (controlsRef.current) controlsRef.current.enabled = false;
    event.target.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    const rect = mountRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObject(floorPlaneRef.current);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        dragStartRef.current = { x: point.x, y: point.y };
        const marker = activeTool === 'GOAL' ? goalMarkerRef.current : poseMarkerRef.current;
        if (marker) { 
            marker.position.set(point.x, point.y, 0.2);
            marker.setRotationFromEuler(new THREE.Euler(0, 0, 0)); 
            marker.visible = true; 
        }
    }
  };

  const handlePointerMove = (event) => {
    if (!isDraggingRef.current || !dragStartRef.current || !activeTool) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObject(floorPlaneRef.current);
    if (intersects.length > 0) {
        const currPoint = intersects[0].point;
        const startPoint = dragStartRef.current;
        const dx = currPoint.x - startPoint.x; 
        const dy = currPoint.y - startPoint.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        const marker = activeTool === 'GOAL' ? goalMarkerRef.current : poseMarkerRef.current;
        if (marker) {
            marker.position.set(currPoint.x, currPoint.y, 0.2);
            
            if (distance > 0.2) {
                const yaw = Math.atan2(dy, dx);
                marker.setRotationFromEuler(new THREE.Euler(0, 0, yaw));
            }
        }
    }
  };

  const handlePointerUp = (event) => {
    if (!isDraggingRef.current || !dragStartRef.current || !activeTool) return;
    event.target.releasePointerCapture(event.pointerId);
    isDraggingRef.current = false;
    const marker = activeTool === 'GOAL' ? goalMarkerRef.current : poseMarkerRef.current;
    if (!marker) return;
    const rotation = marker.rotation.z; 
    const orientation = getQuaternionFromYaw(rotation);
    const pos = { x: marker.position.x, y: marker.position.y };

    console.log(`🎯 ${activeTool === 'GOAL' ? 'GOAL' : 'POSE'} enviado para:`, pos, `Yaw: ${(rotation * 180 / Math.PI).toFixed(1)}°`);

    const stamp = { sec: 0, nanosec: 0 };

    if (activeTool === 'GOAL' && goalTopicRef.current) {
        goalTopicRef.current.publish({ header: { frame_id: 'map', stamp: stamp }, pose: { position: { x: pos.x, y: pos.y, z: 0 }, orientation: orientation } });
    }
    if (activeTool === 'POSE' && initTopicRef.current) {
        const cov = [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0.0685, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.0685];
        const msg = {
            header: { frame_id: 'map', stamp: stamp },
            pose: { pose: { position: { x: pos.x, y: pos.y, z: 0 }, orientation: orientation }, covariance: cov }
        };
        initTopicRef.current.publish(msg);
    }
    
    if (setActiveTool) setActiveTool(null); 
    dragStartRef.current = null;
    setTimeout(() => {
        if (marker) marker.visible = false;
    }, 3000);
    if (controlsRef.current) {
        controlsRef.current.enabled = true;
        if (viewMode !== 'FREE') controlsRef.current.enableRotate = false;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={mountRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
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
