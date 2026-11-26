// Zephyr Rings — main: renderer, state machine (title → playing → results),
// gate detection, crashes, camera work, screenshot staging and the debug
// hooks the headless self-test drives.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { World } from './world.js';
import { Plane } from './plane.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { SoundFX } from './audio.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || CONFIG.worldSeed;
const shotMode = params.get('shot');

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.baseFov, 16 / 9, 0.5, 14000);

const world = new World(scene, seed);
const plane = new Plane(scene);
const input = new Input(canvas);
const hud = new Hud();
const sfx = new SoundFX();

const state = {
  phase: 'title', // title | playing | finished
  score: 0, combo: 0, bestCombo: 0,
  passed: 0, missed: 0, perfects: 0, crashes: 0,
  timeLeft: CONFIG.startTime, timeBonus: 0,
  totalRings: world.rings.length,
};

let nextIdx = 0;          // index of the ring to thread next
let prevSide = null;      // last sign of the plane's offset along the ring tangent
let elapsed = 0;
let camPos = new THREE.Vector3(0, 140, 900);
let titleAngle = 0;

plane.reset(world.startPos, world.startHeading);
markNextRing();

function markNextRing() {
  world.rings.forEach((r, i) => {
    if (i === nextIdx) world.setRingState(r, 'next');
    else if (r.state === 'next') world.setRingState(r, 'upcoming');
  });
  prevSide = null;
}

function nextRing() { return world.rings[nextIdx] || null; }

// ------------------------------------------------------------------ scoring
function resolveRing(ring, kind, radial) {
  if (kind === 'pass') {
    const perfect = radial < CONFIG.perfectRadius;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const mult = Math.min(state.combo, CONFIG.comboCap);
    const pts = (perfect ? CONFIG.perfectPoints : CONFIG.passPoints) * mult;
    state.score += pts;
    state.passed += 1;
    if (perfect) state.perfects += 1;
    world.setRingState(ring, 'passed');
    hud.flash(perfect ? `PERFECT<small>+${pts} · COMBO ×${mult}</small>` : `+${pts}<small>COMBO ×${mult}</small>`);
    sfx.gate(perfect);
  } else {
    state.combo = 0;
    state.missed += 1;
    world.setRingState(ring, 'missed');
    hud.flash(`MISS<small>COMBO LOST</small>`);
    sfx.miss();
  }
  nextIdx += 1;
  if (nextIdx >= world.rings.length) finishRun(state.timeLeft > 0);
  else markNextRing();
}

function checkGateCrossing() {
  const ring = nextRing();
  if (!ring) return;
  const rel = plane.pos.clone().sub(ring.center);
  const side = Math.sign(rel.dot(ring.tangent)) || 1;
  if (prevSide !== null && side !== prevSide) {
    const radial = rel.clone().addScaledVector(ring.tangent, -rel.dot(ring.tangent)).length();
    resolveRing(ring, radial < CONFIG.ringRadius ? 'pass' : 'miss', radial);
  }
  prevSide = side;
}

function crash() {
  state.crashes += 1;
  state.combo = 0;
  state.timeLeft = Math.max(0, state.timeLeft - CONFIG.crashTimePenalty);
  hud.crashFlash();
  hud.flash(`CRASH<small>−${CONFIG.crashTimePenalty}s · COMBO LOST</small>`);
  sfx.crash();
  // Respawn just behind the last resolved ring (or at the start line).
  const anchor = nextIdx > 0 ? world.rings[nextIdx - 1] : null;
  const pos = anchor
    ? anchor.center.clone().addScaledVector(anchor.tangent, -80).add(new THREE.Vector3(0, 8, 0))
    : world.startPos.clone();
  pos.y = Math.max(pos.y, world.heightAt(pos.x, pos.z) + 30);
  const heading = anchor
    ? Math.atan2(anchor.tangent.x, -anchor.tangent.z)
    : world.startHeading;
  plane.reset(pos, heading);
  prevSide = null;
}

function checkCrash() {
  const ground = world.heightAt(plane.pos.x, plane.pos.z);
  if (plane.pos.y < ground + 2.4) return crash();
  for (const s of world.spires) {
    const dx = plane.pos.x - s.x, dz = plane.pos.z - s.z;
    if (dx * dx + dz * dz < (s.radius + 2) ** 2 && plane.pos.y < s.height) return crash();
  }
  // Soft world bounds: turn the plane back toward the isles.
  if (Math.abs(plane.pos.x) > 3300 || Math.abs(plane.pos.z) > 3300) {
    plane.heading += Math.PI;
    plane.pos.x = THREE.MathUtils.clamp(plane.pos.x, -3200, 3200);
    plane.pos.z = THREE.MathUtils.clamp(plane.pos.z, -3200, 3200);
  }
  if (plane.pos.y > 430) plane.pos.y = 430;
  if (plane.pos.y < 4) plane.pos.y = 4;
}

function gradeFor(score) {
  if (score >= 6500) return 'S';
  if (score >= 4800) return 'A';
  if (score >= 3200) return 'B';
  if (score >= 1800) return 'C';
  return 'D';
}

function finishRun(completed) {
  if (state.phase === 'finished') return;
  state.phase = 'finished';
  state.timeBonus = completed ? Math.ceil(state.timeLeft) * CONFIG.timeBonusPerSecond : 0;
  state.score += state.timeBonus;
  hud.showResults(state, gradeFor(state.score), completed ? 'RUN COMPLETE' : 'TIME UP');
  hud.showHud(false);
  sfx.engine(0, false);
  if (completed) sfx.fanfare();
}

function startRun() {
  Object.assign(state, {
    phase: 'playing', score: 0, combo: 0, bestCombo: 0,
    passed: 0, missed: 0, perfects: 0, crashes: 0,
    timeLeft: CONFIG.startTime, timeBonus: 0,
  });
  nextIdx = 0;
  world.rings.forEach((r) => world.setRingState(r, 'upcoming'));
  plane.reset(world.startPos, world.startHeading);
  markNextRing();
  hud.showStart(false);
  hud.showEnd(false);
  hud.showHud(true);
  sfx.init();
}

// --------------------------------------------------------------- autopilot
// Used on the title screen and to stage screenshots: steer at a target.
function autopilotInput(target) {
  const to = target.clone().sub(plane.pos);
  const desired = Math.atan2(to.x, -to.z);
  let err = desired - plane.heading;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  const roll = THREE.MathUtils.clamp(err * 1.5, -0.85, 0.85);
  const desiredPitch = THREE.MathUtils.clamp(
    Math.atan2(to.y, Math.hypot(to.x, to.z)) * 1.7, -0.5, 0.6);
  const pitch = THREE.MathUtils.clamp((desiredPitch - plane.pitch) * 2.4, -1, 1);
  return { pitch, roll, boost: false, brake: false };
}

// -------------------------------------------------------- screenshot staging
function stageShot() {
  if (!shotMode || shotMode === 'start') return;
  hud.showStart(false);
  hud.showHud(true);
  state.phase = 'playing';
  const stageAt = (ringIdx, back, combo, score, timeLeft) => {
    for (let i = 0; i < ringIdx; i++) { world.setRingState(world.rings[i], 'passed'); state.passed += 1; }
    nextIdx = ringIdx;
    markNextRing();
    const ring = world.rings[ringIdx];
    const pos = ring.center.clone().addScaledVector(ring.tangent, -back).add(new THREE.Vector3(0, 3, 0));
    plane.reset(pos, Math.atan2(ring.tangent.x, -ring.tangent.z));
    state.combo = combo; state.bestCombo = combo; state.score = score; state.timeLeft = timeLeft;
    // Settle the chase camera behind the plane before the shot is taken.
    const back3 = new THREE.Vector3(0, CONFIG.camUp, CONFIG.camBack)
      .applyQuaternion(plane.group.quaternion).add(plane.pos);
    camPos.copy(back3);
  };
  if (shotMode === 'cover') stageAt(2, 150, 3, 1250, 118);
  else if (shotMode === 'play') stageAt(6, 62, 5, 3400, 86);
  else if (shotMode === 'end') {
    Object.assign(state, {
      passed: 15, missed: 3, perfects: 6, bestCombo: 7, crashes: 1,
      score: 5910, timeLeft: 16, // finishRun adds ceil(16) * 15 = +240 → 6150
    });
    finishRun(true);
  }
}

// -------------------------------------------------------------------- loop
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  let inp;
  if (state.phase === 'playing' && !shotMode) {
    inp = input.read(performance.now());
  } else if (state.phase === 'playing' && shotMode) {
    const ring = nextRing();
    inp = ring ? autopilotInput(ring.center) : { pitch: 0, roll: 0, boost: false, brake: false };
  } else {
    // Title / results: a lazy circle over the home isle.
    titleAngle += dt * 0.07;
    const target = new THREE.Vector3(
      Math.cos(titleAngle) * 430, 128 + Math.sin(elapsed * 0.4) * 10, 250 + Math.sin(titleAngle) * 430);
    inp = autopilotInput(target);
  }

  plane.update(dt, inp);
  plane.updateShadow(world.heightAt(plane.pos.x, plane.pos.z));
  world.update(dt, elapsed);
  world.sky.position.copy(camera.position);

  if (state.phase === 'playing') {
    if (!shotMode) {
      state.timeLeft -= dt;
      checkGateCrossing();
      checkCrash();
      if (state.timeLeft <= 0) { state.timeLeft = 0; finishRun(false); }
    }
    hud.update(state, plane, nextRing());
    const norm = (plane.speed - CONFIG.brakeSpeed) / (CONFIG.boostSpeed - CONFIG.brakeSpeed);
    sfx.engine(THREE.MathUtils.clamp(norm, 0, 1), true);
  }

  // Chase camera.
  const behind = new THREE.Vector3(0, CONFIG.camUp, CONFIG.camBack)
    .applyQuaternion(plane.group.quaternion).add(plane.pos);
  camPos.lerp(behind, 1 - Math.exp(-CONFIG.camLerp * dt));
  camera.position.copy(camPos);
  const ahead = plane.pos.clone().addScaledVector(plane.forward(), 34).add(new THREE.Vector3(0, 2.5, 0));
  camera.lookAt(ahead);
  const targetFov = inp.boost ? CONFIG.boostFov : CONFIG.baseFov;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, 5 * dt);
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// -------------------------------------------------------------------- wiring
document.getElementById('start-btn').addEventListener('click', startRun);
document.getElementById('again-btn').addEventListener('click', startRun);
input.onKey = (code) => {
  if (code === 'KeyM') { sfx.init(); sfx.setMuted(!sfx.muted); }
  if (code === 'Enter' && state.phase !== 'playing') startRun();
};
canvas.addEventListener('pointerdown', () => sfx.init(), { once: true });

stageShot();
frame();

// Debug hooks for the headless self-test (harmless in normal play).
window.ZEPHYR = {
  state: () => ({ ...state, nextIdx, planePos: plane.pos.toArray() }),
  start: startRun,
  setTimeLeft: (s) => { state.timeLeft = s; },
  teleportBeforeRing: (back = 40) => {
    const ring = nextRing();
    if (!ring) return false;
    const pos = ring.center.clone().addScaledVector(ring.tangent, -back);
    plane.reset(pos, Math.atan2(ring.tangent.x, -ring.tangent.z));
    prevSide = null;
    return true;
  },
};
