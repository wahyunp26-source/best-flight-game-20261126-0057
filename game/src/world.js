// Zephyr Rings — the Azure Isles: sky dome, sun, ocean, islands, clouds,
// rock spires and the glowing ring course. Everything is procedural and
// seeded, so the world is the same on every visit.

import * as THREE from '../vendor/three.module.min.js';
import { makeRng, range } from './random.js';
import { CONFIG } from './config.js';

const SKY_TOP = new THREE.Color(0x2b6cd4);
const SKY_HORIZON = new THREE.Color(0xcfeef7);
const SUN_DIR = new THREE.Vector3(-0.45, 0.62, -0.64).normalize();

export class World {
  constructor(scene, seed = CONFIG.worldSeed) {
    this.rng = makeRng(seed);
    this.islands = [];    // {x, z, radius, peak}
    this.spires = [];     // {x, z, radius, height} — crash obstacles
    this.clouds = [];
    this.rings = [];      // filled by buildCourse()
    scene.fog = new THREE.Fog(0xcfe4f2, 800, 6800);

    this.buildLights(scene);
    this.buildSky(scene);
    this.buildOcean(scene);
    this.buildIslands(scene);
    this.buildMountains(scene);
    this.buildClouds(scene);
    this.buildCourse(scene);
  }

  // ---------------------------------------------------------------- lights
  buildLights(scene) {
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x2e6b8a, 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe3b3, 2.0);
    sun.position.copy(SUN_DIR).multiplyScalar(900);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fd0ff, 0.35);
    fill.position.set(300, 200, 500);
    scene.add(fill);
  }

  // ------------------------------------------------------------------- sky
  buildSky(scene) {
    const geo = new THREE.SphereGeometry(6500, 32, 18);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: SKY_TOP },
        horizon: { value: SKY_HORIZON },
        sunDir: { value: SUN_DIR },
        sunCol: { value: new THREE.Color(0xffe9bb) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.08, 1.0);
          vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
          float sunAmt = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 220.0);
          float halo = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0);
          col += sunCol * (sunAmt * 1.25 + halo * 0.22);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    scene.add(this.sky);

    // A soft sun billboard for the hero glare in screenshots.
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,246,214,1)');
    grad.addColorStop(0.25, 'rgba(255,232,170,0.85)');
    grad.addColorStop(1, 'rgba(255,232,170,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    spr.position.copy(SUN_DIR).multiplyScalar(5800);
    spr.scale.setScalar(1500);
    scene.add(spr);
  }

  // ----------------------------------------------------------------- ocean
  buildOcean(scene) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1c6f9e'; g.fillRect(0, 0, 256, 256);
    const rng = makeRng(99);
    for (let i = 0; i < 900; i++) {
      const a = 0.03 + rng() * 0.07;
      g.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(4,50,80,${a})`;
      g.beginPath();
      g.ellipse(rng() * 256, rng() * 256, 4 + rng() * 22, 1 + rng() * 3, rng() * 0.6 - 0.3, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(60, 60);
    this.oceanTex = tex;
    const mat = new THREE.MeshPhongMaterial({
      map: tex, color: 0x9fd4ee, shininess: 55, specular: 0x7fb2d9,
    });
    const ocean = new THREE.Mesh(new THREE.CircleGeometry(CONFIG.oceanSize / 2, 48), mat);
    ocean.rotation.x = -Math.PI / 2;
    scene.add(ocean);
  }

  // --------------------------------------------------------------- islands
  islandMesh(x, z, radius, peak) {
    const group = new THREE.Group();
    // Sand skirt.
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.12, radius * 1.3, 4, 28),
      new THREE.MeshStandardMaterial({ color: 0xe8d194, roughness: 1, flatShading: true }),
    );
    sand.position.y = 0.6;
    group.add(sand);
    // Grass dome — a squashed sphere reads as a soft green hill.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 18),
      new THREE.MeshStandardMaterial({ color: 0x4da653, roughness: 1, flatShading: true }),
    );
    dome.scale.y = peak / radius;
    dome.position.y = 1.2;
    group.add(dome);
    // A rocky cap on the taller isles.
    if (peak > 26) {
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.3, peak * 0.42, 7),
        new THREE.MeshStandardMaterial({ color: 0x8d99a6, roughness: 1, flatShading: true }),
      );
      cap.position.y = peak * 0.94;
      group.add(cap);
    }
    group.position.set(x, 0, z);
    return group;
  }

  tree(x, z, y, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * s, 0.8 * s, 3.4 * s, 6),
      new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1, flatShading: true }),
    );
    trunk.position.y = 1.7 * s;
    g.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.6 * s, 7.5 * s, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 1, flatShading: true }),
    );
    crown.position.y = 6.4 * s;
    g.add(crown);
    g.position.set(x, y, z);
    return g;
  }

  buildIslands(scene) {
    const rng = this.rng;
    // A loose arc of isles the course weaves through, plus far outliers.
    const spots = [];
    for (let i = 0; i < 15; i++) {
      const ang = (i / 15) * Math.PI * 2 + range(rng, -0.2, 0.2);
      const dist = 500 + rng() * 1250;
      spots.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, r: range(rng, 130, 300), p: range(rng, 16, 44) });
    }
    spots.push({ x: 0, z: 250, r: 210, p: 20 });       // home isle, near spawn
    spots.push({ x: -350, z: -1150, r: 340, p: 52 });   // the big one up north
    for (const s of spots) {
      this.islands.push({ x: s.x, z: s.z, radius: s.r, peak: s.p });
      scene.add(this.islandMesh(s.x, s.z, s.r, s.p));
      // Trees sprinkled on the dome, kept off the very top.
      const n = Math.floor(s.r / 16);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = s.r * (0.25 + rng() * 0.62);
        const tx = s.x + Math.cos(a) * d, tz = s.z + Math.sin(a) * d;
        scene.add(this.tree(tx, tz, this.heightAt(tx, tz) - 0.3, range(rng, 0.8, 1.5)));
      }
    }

    // Lighthouse on the home isle — a landmark for screenshots.
    const lh = new THREE.Group();
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 5.6, 26, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.8, flatShading: true }),
    );
    tower.position.y = 13;
    lh.add(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(4.7, 5.1, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8434f, roughness: 0.8, flatShading: true }),
    );
    band.position.y = 15;
    lh.add(band);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe98a }),
    );
    lamp.position.y = 28.5;
    lh.add(lamp);
    const lhX = 60, lhZ = 330;
    lh.position.set(lhX, this.heightAt(lhX, lhZ) - 0.5, lhZ);
    scene.add(lh);

    // Rock spires — the obstacles. Tall, pale, unmissable.
    const spireAt = (x, z, h) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(h * 0.16, h, 6),
        new THREE.MeshStandardMaterial({ color: 0xccd8e0, roughness: 1, flatShading: true }),
      );
      m.position.set(x, h / 2 - 2, z);
      scene.add(m);
      this.spires.push({ x, z, radius: h * 0.17, height: h });
    };
    spireAt(210, -420, 120);
    spireAt(-520, -260, 150);
    spireAt(430, 130, 105);
    spireAt(-160, 780, 135);
    spireAt(880, -680, 165);
    spireAt(-980, 420, 140);
  }

  // ------------------------------------------------------------- mountains
  buildMountains(scene) {
    const rng = makeRng(1234);
    const mat = new THREE.MeshBasicMaterial({ color: 0x5f87ad, fog: true });
    const snow = new THREE.MeshBasicMaterial({ color: 0xe8f3fa, fog: true });
    for (let i = 0; i < 11; i++) {
      const ang = (i / 11) * Math.PI * 2 + range(rng, -0.15, 0.15);
      const dist = range(rng, 3600, 4400);
      const h = range(rng, 500, 950);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.85, h, 5), mat);
      cone.position.set(Math.cos(ang) * dist, h / 2 - 30, Math.sin(ang) * dist);
      cone.rotation.y = rng() * Math.PI;
      scene.add(cone);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.3, h * 0.34, 5), snow);
      cap.position.set(cone.position.x, h - h * 0.17 - 28, cone.position.z);
      cap.rotation.y = cone.rotation.y;
      scene.add(cap);
    }
  }

  // ---------------------------------------------------------------- clouds
  buildClouds(scene) {
    const rng = makeRng(555);
    // Flat, bright, unlit puffs — lit standard material made them read as
    // dark floating rocks; flat white is the classic low-poly cloud.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf6fbff, transparent: true, opacity: 0.92, fog: true,
    });
    for (let i = 0; i < 34; i++) {
      const cluster = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 4);
      for (let j = 0; j < puffs; j++) {
        const r = range(rng, 14, 34);
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        s.position.set(range(rng, -34, 34), range(rng, -7, 7), range(rng, -18, 18));
        s.scale.y = 0.55;
        cluster.add(s);
      }
      const ang = rng() * Math.PI * 2, dist = range(rng, 200, 2600);
      cluster.position.set(Math.cos(ang) * dist, range(rng, 230, 420), Math.sin(ang) * dist);
      cluster.userData.drift = range(rng, 1.2, 3.2);
      this.clouds.push(cluster);
      scene.add(cluster);
    }
  }

  // ---------------------------------------------------------------- course
  // The ring course: a winding path of gates over the isles. Each ring knows
  // its centre, its facing (tangent) and its state for the HUD/scoring.
  buildCourse(scene) {
    const rng = makeRng(CONFIG.worldSeed * 31 + 4);
    const pts = [];
    let pos = new THREE.Vector3(0, 105, 520);
    let heading = 0; // compass-style: forward = (sin h, 0, -cos h); 0 = toward -Z
    let alt = 105;
    for (let i = 0; i < CONFIG.ringCount; i++) {
      pts.push(pos.clone());
      heading += range(rng, -0.55, 0.55);
      const leg = range(rng, 270, 380);
      alt = THREE.MathUtils.clamp(alt + range(rng, -45, 45), CONFIG.courseAltMin, CONFIG.courseAltMax);
      pos = pos.clone().add(new THREE.Vector3(Math.sin(heading) * leg, 0, -Math.cos(heading) * leg));
      pos.y = alt;
      // Keep the course over the archipelago, not out at sea.
      pos.x = THREE.MathUtils.clamp(pos.x, -1500, 1500);
      pos.z = THREE.MathUtils.clamp(pos.z, -1500, 1500);
    }
    // Tangents from neighbours, so each ring faces along the path.
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const tangent = next.clone().sub(prev).normalize();
      const ring = this.makeRing(i, pts[i], tangent);
      this.rings.push(ring);
      scene.add(ring.group);
    }
    this.startPos = pts[0].clone().add(new THREE.Vector3(0, 0, 190));
    this.startHeading = Math.atan2(
      pts[0].x - this.startPos.x, -(pts[0].z - this.startPos.z),
    );
  }

  makeRing(index, center, tangent) {
    const group = new THREE.Group();
    const R = CONFIG.ringRadius;
    const torusGeo = new THREE.TorusGeometry(R, 1.05, 12, 44);
    const haloGeo = new THREE.TorusGeometry(R, 2.6, 10, 44);
    const main = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: 0x37c8e8 }));
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
      color: 0x37c8e8, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    group.add(main); group.add(halo);
    // Four small marker lights around the rim read beautifully at speed.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xbdf3ff }),
      );
      dot.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      group.add(dot);
    }
    group.position.copy(center);
    group.lookAt(center.clone().add(tangent));
    return {
      index, center: center.clone(), tangent: tangent.clone(),
      group, main, halo, state: 'upcoming', // upcoming | next | passed | missed
    };
  }

  setRingState(ring, state, t = 0) {
    ring.state = state;
    const colors = {
      next: 0xffc62e, passed: 0x3fe07a, missed: 0xff5340, upcoming: 0x37c8e8,
    };
    ring.main.material.color.setHex(colors[state]);
    ring.halo.material.color.setHex(colors[state]);
  }

  // Terrain height: the dome profile of the tallest isle under a point.
  heightAt(x, z) {
    let h = 0;
    for (const isl of this.islands) {
      const dx = x - isl.x, dz = z - isl.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < isl.radius) {
        const dome = Math.sqrt(Math.max(0, 1 - (d / isl.radius) ** 2)) * isl.peak + 1.2;
        if (dome > h) h = dome;
      }
    }
    return h;
  }

  update(dt, t) {
    this.oceanTex.offset.x = t * 0.004;
    this.oceanTex.offset.y = t * 0.0027;
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 3000) c.position.x = -3000;
    }
    for (const ring of this.rings) {
      if (ring.state === 'next') {
        const s = 1 + Math.sin(t * 5.2) * 0.045;
        ring.group.scale.setScalar(s);
        ring.halo.material.opacity = 0.3 + Math.sin(t * 5.2) * 0.12;
      } else {
        ring.group.scale.setScalar(1);
        ring.halo.material.opacity = ring.state === 'upcoming' ? 0.13 : 0.2;
      }
    }
  }
}
