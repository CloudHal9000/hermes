

export class SimpleTfGraph {
  constructor(ros) {
    this.graph = {};

    this.subTf = new window.ROSLIB.Topic({
      ros: ros,
      name: "/tf",
      messageType: "tf2_msgs/TFMessage"
    });

    this.subTfStatic = new window.ROSLIB.Topic({
      ros: ros,
      name: "/tf_static",
      messageType: "tf2_msgs/TFMessage"
    });

    this.cb = (msg) => this._onTf(msg);
    this.subTf.subscribe(this.cb);
    this.subTfStatic.subscribe(this.cb);
  }

  destroy() {
    this.subTf.unsubscribe(this.cb);
    this.subTfStatic.unsubscribe(this.cb);
  }

  _onTf(msg) {
    if (!msg || !msg.transforms) return;
    msg.transforms.forEach((tf) => {
      const parent = tf.header.frame_id;
      const child = tf.child_frame_id;
      const t = tf.transform.translation;
      const q = tf.transform.rotation;

      const inv = SimpleTfGraph._invertTransform(t, q);
      this._addEdge(parent, child, t, q);
      this._addEdge(child, parent, inv.t, inv.q);
    });
  }

  _addEdge(from, to, t, q) {
    if (!this.graph[from]) {
      this.graph[from] = [];
    }

    const existingIndex = this.graph[from].findIndex(e => e.to === to);
    if (existingIndex >= 0) {
      this.graph[from][existingIndex] = { to, t, q };
    } else {
      this.graph[from].push({ to: to, t: t, q: q });
    }
  }

  lookupTransform(source, target, maxDepth = 15) {
    if (source === target) {
      return { t: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } };
    }

    const visited = new Set();
    const queue = [];

    queue.push({
      frame: source,
      depth: 0,
      t: { x: 0, y: 0, z: 0 },
      q: { x: 0, y: 0, z: 0, w: 1 }
    });
    visited.add(source);

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.frame === target) {
        return { t: cur.t, q: cur.q };
      }

      if (cur.depth >= maxDepth) continue;

      const edges = this.graph[cur.frame] || [];
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if (visited.has(e.to)) continue;
        visited.add(e.to);

        const composed = SimpleTfGraph._compose(cur.t, cur.q, e.t, e.q);
        queue.push({
          frame: e.to,
          depth: cur.depth + 1,
          t: composed.t,
          q: composed.q
        });

        if (queue.length > 100) break;
      }
    }
    return null;
  }

  static _quatMultiply(a, b) {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    };
  }

  static _quatConjugate(q) {
    return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  }

  static _rotateVector(v, q) {
    const qv = { x: v.x, y: v.y, z: v.z, w: 0 };
    const qInv = SimpleTfGraph._quatConjugate(q);
    const t = SimpleTfGraph._quatMultiply(
      SimpleTfGraph._quatMultiply(q, qv),
      qInv
    );
    return { x: t.x, y: t.y, z: t.z };
  }

  static _invertTransform(t, q) {
    const qInv = SimpleTfGraph._quatConjugate(q);
    const minusT = { x: -t.x, y: -t.y, z: -t.z };
    const tInv = SimpleTfGraph._rotateVector(minusT, qInv);
    return { t: tInv, q: qInv };
  }

  static _compose(t1, q1, t2, q2) {
    const q = SimpleTfGraph._quatMultiply(q1, q2);
    const t1Rot = SimpleTfGraph._rotateVector(t2, q1);
    const t = {
      x: t1Rot.x + t1.x,
      y: t1Rot.y + t1.y,
      z: t1Rot.z + t1.z
    };
    return { t: t, q: q };
  }
}
