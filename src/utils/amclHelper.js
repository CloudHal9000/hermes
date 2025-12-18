import * as ROSLIB from 'roslib';

export class AMCLHelper {
  constructor(ros) {
    this.ros = ros;
  }

  setInitialPose(x, y, yawDeg) {
    if (!this.ros) {
      console.error('🚫 ROS não definido no AMCLHelper.');
      return false;
    }
    
    if (!this.ros.isConnected) {
      console.warn('⚠️ ROS desconectado. Tentando enviar mesmo assim...');
    }

    // 1. CONVERSÃO FORÇADA PARA NÚMERO (Resolve problema de inputs string)
    const posX = parseFloat(x);
    const posY = parseFloat(y);
    const yaw = parseFloat(yawDeg);

    if (isNaN(posX) || isNaN(posY) || isNaN(yaw)) {
      console.error('❌ Valores inválidos para Pose:', { x, y, yawDeg });
      return false;
    }

    // 2. MATEMÁTICA
    const yawRad = yaw * (Math.PI / 180);
    const qz = Math.sin(yawRad / 2);
    const qw = Math.cos(yawRad / 2);

    // 3. TÓPICO (Verifique se seu robô usa namespace!)
    // Padrão ROS 2: /initialpose
    // Se tiver namespace: /nome_robo/initialpose
    const topicName = '/initialpose'; 

    const topic = new ROSLIB.Topic({
      ros: this.ros,
      name: topicName,
      messageType: 'geometry_msgs/PoseWithCovarianceStamped'
    });

    // 4. TIMESTAMP (ROS 2 precisa de tempo atual)
    const now = new Date();
    const secs = Math.floor(now.getTime() / 1000);
    const nsecs = Math.floor((now.getTime() % 1000) * 1000000);

    const msg = new ROSLIB.Message({
      header: {
        frame_id: 'map',
        stamp: { sec: secs, nanosec: nsecs }
      },
      pose: {
        pose: {
          position: { x: posX, y: posY, z: 0.0 },
          orientation: { x: 0.0, y: 0.0, z: qz, w: qw }
        },
        covariance: [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0685]
      }
    });

    console.log(`🚀 ENVIANDO POSE MANUAL para ${topicName}:`, { 
      x: posX, y: posY, yaw: yaw, 
      rosConnected: this.ros.isConnected 
    });

    topic.publish(msg);
    return true;
  }

  reinitializeGlobalLocalization() {
    if (!this.ros) return;
    const service = new ROSLIB.Service({
      ros: this.ros,
      name: '/reinitialize_global_localization',
      serviceType: 'std_srvs/srv/Empty'
    });
    console.log('🔄 Chamando Global Localization...');
    service.callService(new ROSLIB.ServiceRequest({}), 
      () => console.log('✅ Global Localization OK'),
      (err) => console.error('❌ Erro Global Localization', err)
    );
  }
}