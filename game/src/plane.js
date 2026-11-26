// Zephyr Rings — the aircraft: a stylised seaplane built from primitives,
// an arcade flight model (bank to turn, pitch to climb), a fading wingtip
// trail and a soft blob shadow so altitude reads at a glance.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

const PAINT = 0xf6f1e3;   // warm cream
const ACCENT = 0xd8434f;  // rally red
const DARK = 0x22303c;

export class Plane {
  constructor(scene) {
    this.group = new THREE.Group();
    this.buildModel();
    scene.add(this.group);

    // Flight state. Heading is compass-style: 0 faces -Z (north), and the
    // forward vector is (cos p * sin h, sin p, -cos p * cos h).
    this.pos = new THREE.Vector3(0, 105, 710);
    this.heading = 0;
    this.pitch = 0;
    this.bank = 0;
    this.speed = CONFIG.cruiseSpeed;

    this.buildTrail(scene);
    this.buildShadow(scene);
  }

  buildModel() {
    const mat = (color, opts = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, flatShading: true, ...opts });

    // Fuselage — a stretched sphere, nose toward -Z.
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.55, 14, 12), mat(PAINT));
    body.scale.set(1, 1, 3.1);
    this.group.add(body);

    // Red engine cowling + spinner + propeller at the nose.
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.42, 1.5, 14), mat(ACCENT));
    cowl.rotation.x = Math.PI / 2;
    cowl.position.z = -4.35;
    this.group.add(cowl);
    this.prop = new THREE.Group();
    const bladeMat = mat(DARK, { roughness: 0.4 });
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.9, 0.16), bladeMat);
      blade.rotation.z = i * Math.PI / 2 + 0.5;
      this.prop.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(0xf2c230, { metalness: 0.5, roughness: 0.3 }));
    this.prop.add(hub);
    this.prop.position.z = -5.25;
    this.group.add(this.prop);

    // Canopy.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 12, 10),
      mat(0x1d3a4d, { roughness: 0.12, metalness: 0.35 }),
    );
    canopy.scale.set(0.92, 0.78, 1.7);
    canopy.position.set(0, 1.05, -0.7);
    this.group.add(canopy);

    // Main wing with red tips.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.32, 2.7), mat(PAINT));
    wing.position.set(0, 0.55, -0.6);
    this.group.add(wing);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 2.7), mat(ACCENT));
      tip.position.set(s * 7.6, 0.55, -0.6);
      this.group.add(tip);
    }

    // Tail feathers.
    const hstab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.26, 1.7), mat(ACCENT));
    hstab.position.set(0, 0.5, 4.35);
    this.group.add(hstab);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.6, 1.9), mat(ACCENT));
    fin.position.set(0, 1.55, 4.35);
    this.group.add(fin);

    // Seaplane floats on struts — she belongs over the isles.
    for (const s of [-1, 1]) {
      const float = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 3.6, 4, 8), mat(ACCENT));
      float.rotation.x = Math.PI / 2;
      float.position.set(s * 2.1, -2.3, -0.3);
      this.group.add(float);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), mat(DARK));
      strut.position.set(s * 2.1, -1.4, -0.9);
      strut.rotation.z = s * 0.35;
      this.group.add(strut);
      const strut2 = strut.clone();
      strut2.position.z = 0.5;
      this.group.add(strut2);
    }
  }

  buildTrail(scene) {
    this.trailMax = 260;
    this.trailPos = new Float32Array(this.trailMax * 3);
    this.trailCol = new Float32Array(this.trailMax * 3);
    this.trailAge = new Float32Array(this.trailMax).fill(1e9);
    this.trailHead = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3));
    // A soft round puff sprite — without it, points render as hard squares.
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({
      size: 2.9, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.trail = new THREE.Points(geo, mat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);
  }

  buildShadow(scene) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(6,30,44,0.5)');
    grad.addColorStop(1, 'rgba(6,30,44,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 17),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }

  reset(pos, heading) {
    this.pos.copy(pos);
    this.heading = heading;
    this.pitch = 0;
    this.bank = 0;
    this.speed = CONFIG.cruiseSpeed;
    this.trailAge.fill(1e9);
  }

  forward() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(
      cp * Math.sin(this.heading), Math.sin(this.pitch), -cp * Math.cos(this.heading),
    );
  }

  // input: { pitch: -1..1 (positive = climb), roll: -1..1 (positive = right), boost, brake }
  update(dt, input) {
    // Bank toward the stick, pitch toward the stick — both smoothed.
    const targetBank = input.roll * CONFIG.maxBank;
    this.bank += (targetBank - this.bank) * Math.min(1, CONFIG.bankLerp * dt);
    const targetPitch = input.pitch * CONFIG.maxPitch;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, 3.4 * dt);

    // Banking turns the aircraft; a touch of pitch bleeds into the turn.
    this.heading += Math.sin(this.bank) * CONFIG.turnPerBank * dt;

    // Speed chases its target.
    const target = input.boost ? CONFIG.boostSpeed : input.brake ? CONFIG.brakeSpeed : CONFIG.cruiseSpeed;
    this.speed += (target - this.speed) * Math.min(1, CONFIG.speedLerp * dt);

    this.pos.addScaledVector(this.forward(), this.speed * dt);

    // Pose the model.
    this.group.position.copy(this.pos);
    this.group.quaternion.setFromEuler(new THREE.Euler(this.pitch, -this.heading, -this.bank, 'YXZ'));
    this.prop.rotation.z -= dt * (14 + this.speed * 0.35);

    this.updateTrail(dt);
  }

  updateTrail(dt) {
    // Emit from both wingtips.
    const tips = [
      new THREE.Vector3(-7.6, 0.55, -0.6),
      new THREE.Vector3(7.6, 0.55, -0.6),
    ];
    for (const tip of tips) {
      const p = tip.clone().applyQuaternion(this.group.quaternion).add(this.pos);
      const i = this.trailHead;
      this.trailPos[i * 3] = p.x; this.trailPos[i * 3 + 1] = p.y; this.trailPos[i * 3 + 2] = p.z;
      this.trailAge[i] = 0;
      this.trailHead = (this.trailHead + 1) % this.trailMax;
    }
    const life = 0.5;
    for (let i = 0; i < this.trailMax; i++) {
      this.trailAge[i] += dt;
      const f = Math.max(0, 1 - this.trailAge[i] / life);
      const b = f * f * 0.42;
      this.trailCol[i * 3] = b * 0.75;
      this.trailCol[i * 3 + 1] = b * 0.92;
      this.trailCol[i * 3 + 2] = b;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }

  updateShadow(groundH) {
    this.shadow.position.set(this.pos.x, groundH + 0.5, this.pos.z);
    const alt = this.pos.y - groundH;
    this.shadow.material.opacity = THREE.MathUtils.clamp(1.15 - alt / 170, 0, 0.85);
    const s = 1 + alt / 130;
    this.shadow.scale.setScalar(s);
  }

  // Display helpers for the HUD.
  speedKnots() { return Math.round(this.speed * 1.94); }
  altitudeFeet() { return Math.max(0, Math.round(this.pos.y * 3.28)); }
  headingDeg() {
    const d = Math.round(THREE.MathUtils.radToDeg(this.heading)) % 360;
    return (d + 360) % 360;
  }
}
