export class AMCLHelper {
  constructor(ros) {
    if (!ros) {
      throw new Error("AMCLHelper requer uma instância de 'ros'.");
    }
    this.ros = ros;
  }

  setInitialPose(x, y, yawDeg) {
    if (!this.ros.isConnected) {
      console.error('🚫 ROS desconectado.');
      return false;
    }

    const posX = parseFloat(x);
    const posY = parseFloat(y);
    const yaw = parseFloat(yawDeg);

    if (isNaN(posX) || isNaN(posY) || isNaN(yaw)) {
      console.error('❌ Valores inválidos para Pose:', { x, y, yawDeg });
      return false;
    }

    const yawRad = yaw * (Math.PI / 180);
    const qz = Math.sin(yawRad / 2);
    const qw = Math.cos(yawRad / 2);

    const topic = new window.window.ROSLIB.Topic({
      ros: this.ros,
      name: '/initialpose',
      messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped'
    });

    const msg = new window.window.ROSLIB.Message({
      header: {
        frame_id: 'map',
        stamp: { sec: 0, nanosec: 0 }
      },
      pose: {
        pose: {
          position: { x: posX, y: posY, z: 0.0 },
          orientation: { x: 0.0, y: 0.0, z: qz, w: qw }
        },
        covariance: [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0685]
      }
    });

    console.log('🚀 Enviando POSE INICIAL para /initialpose:', msg);
    topic.publish(msg);
    return true;
  }

  setGoal(x, y, yawDeg) {
    if (!this.ros.isConnected) { return false; }
    const posX = parseFloat(x);
    const posY = parseFloat(y);
    const yaw = parseFloat(yawDeg);
    if (isNaN(posX) || isNaN(posY) || isNaN(yaw)) { return false; }
    const yawRad = yaw * (Math.PI / 180);
    const qz = Math.sin(yawRad / 2);
    const qw = Math.cos(yawRad / 2);
    const topic = new window.window.ROSLIB.Topic({ ros: this.ros, name: '/goal_pose', messageType: 'geometry_msgs/msg/PoseStamped' });
    const msg = new window.window.ROSLIB.Message({
      header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
      pose: { position: { x: posX, y: posY, z: 0.0 }, orientation: { x: 0.0, y: 0.0, z: qz, w: qw } }
    });
    console.log('🚀 Enviando GOAL para /goal_pose:', msg);
    topic.publish(msg);
    return true;
  }

  reinitializeGlobalLocalization() {
    if (!this.ros.isConnected) { return; }
    const service = new window.window.ROSLIB.Service({ ros: this.ros, name: '/reinitialize_global_localization', serviceType: 'std_srvs/srv/Empty' });
    const request = new window.window.ROSLIB.ServiceRequest({});
    console.log('🔄 Chamando serviço de Global Localization...');
    service.callService(request, (result) => console.log('✅ Resposta do serviço OK.', result), (err) => console.error('❌ Erro no serviço:', err));
  }
}
