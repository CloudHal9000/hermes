import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

export function NavigationControl({ ros, isRoslibReady, showFootprint, setShowFootprint, viewMode, setViewMode }) {
  const [poseInput, setPoseInput] = useState({ x: '0', y: '0', yaw: '0' });
  const initPoseTopicRef = useRef(null);

  useEffect(() => {
    if (ros && isRoslibReady && window.ROSLIB) {
      initPoseTopicRef.current = new window.ROSLIB.Topic({
        ros,
        name: '/initialpose',
        messageType: "geometry_msgs/msg/PoseWithCovarianceStamped"
      });
    }
  }, [ros, isRoslibReady]);

  function getQuaternionFromYaw(yawDeg) {
    const yaw = yawDeg * Math.PI / 180.0;
    return { z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) };
  }

  function sendInitialPose(x, y, yawDeg) {
    if (!initPoseTopicRef.current) {
      console.error("Tópico de Pose Inicial não está pronto.");
      return false;
    }
    const q = getQuaternionFromYaw(yawDeg);
    const cov = [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0685];
    const msg = new window.ROSLIB.Message({
      header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
      pose: {
        pose: {
          position: { x: parseFloat(x), y: parseFloat(y), z: 0.0 },
          orientation: { x: 0.0, y: 0.0, z: q.z, w: q.w }
        },
        covariance: cov
      }
    });
    initPoseTopicRef.current.publish(msg);
    console.log("✅ Initial Pose definida via React:", { x, y, yawDeg });
    return true;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPoseInput(prev => ({ ...prev, [name]: value }));
  };

  const handleSetPose = () => {
    if (!isRoslibReady || !window.ROSLIB) {
      alert("ERRO: ROSLIB não está pronto ou não foi encontrado.");
      return;
    }
    const x = parseFloat(poseInput.x);
    const y = parseFloat(poseInput.y);
    const yaw = parseFloat(poseInput.yaw);
    if (!isFinite(x) || !isFinite(y) || !isFinite(yaw)) {
      return alert("Inputs de Init Pose inválidos");
    }
    sendInitialPose(x, y, yaw);
    alert('✅ Pose inicial enviada com sucesso!');
  };

  const handleGlobalLoc = () => {
    console.log("Global Localization não implementado.");
  };

  const handleOrigin = () => {
    setPoseInput({ x: '0', y: '0', yaw: '0' });
    if (isRoslibReady && window.ROSLIB) {
      sendInitialPose(0, 0, 0);
    }
  };

  return (
    <div style={{
        width: '100%', opacity: 0.9,
        background: 'rgba(19, 21, 31, 0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '30px'
    }}>

      <div style={{ fontSize: '0.9rem', color: '#ccc', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
         📍 NAVIGATION
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          LOCALIZATION (AMCL)
        </div>

        <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={handleOrigin} style={{ flex: 1, background: 'rgba(0, 210, 106, 0.15)', border: '1px solid #00d26a', color: '#00d26a', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>🏠 ORIGIN</button>
            <button onClick={handleGlobalLoc} style={{ flex: 1, background: 'rgba(249, 217, 118, 0.15)', border: '1px solid #f9d976', color: '#f9d976', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>🌍 LOST</button>
        </div>

        <div style={{ display: 'flex', gap: '5px' }}>
          <input type="number" name="x" placeholder="X" value={poseInput.x} onChange={handleInputChange} style={{ flex:1, width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '4px', textAlign: 'center', fontSize: '0.7rem' }} />
          <input type="number" name="y" placeholder="Y" value={poseInput.y} onChange={handleInputChange} style={{ flex:1, width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '4px', textAlign: 'center', fontSize: '0.7rem' }} />
          <input type="number" name="yaw" placeholder="Deg" value={poseInput.yaw} onChange={handleInputChange} style={{ flex:1, width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '4px', textAlign: 'center', fontSize: '0.7rem' }} />
          <button onClick={handleSetPose} style={{ flex: 0.8, background: '#444', border: '1px solid #666', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>SET</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
          MAP LAYERS
        </div>
        <button onClick={() => setShowFootprint(!showFootprint)} style={{ background: showFootprint ? 'rgba(0, 210, 106, 0.2)' : 'rgba(255,255,255,0.05)', border: showFootprint ? '1px solid #00d26a' : '1px solid rgba(255,255,255,0.1)', color: showFootprint ? '#fff' : '#aaa', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
          {showFootprint ? '🟦 FOOTPRINT VISIBLE' : '⬜ FOOTPRINT HIDDEN'}
        </button>
        <div style={{ display: 'flex', gap: '5px' }}>
            {['2D', '3D', 'FREE'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{ flex: 1, background: viewMode === mode ? '#00d26a' : 'rgba(255,255,255,0.05)', color: viewMode === mode ? '#000' : '#aaa', border: 'none', borderRadius: '4px', padding: '6px 0', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>{mode}</button>
            ))}
        </div>
      </div>
    </div>
  );
}

NavigationControl.propTypes = {
  ros: PropTypes.object,
  isRoslibReady: PropTypes.bool.isRequired,
  showFootprint: PropTypes.bool,
  setShowFootprint: PropTypes.func,
  viewMode: PropTypes.string,
  setViewMode: PropTypes.func
};
