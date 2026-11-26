// Zephyr Rings — tuning constants for the whole game.
// One place for every number that shapes how a run feels.

export const CONFIG = {
  // Course
  ringCount: 18,          // glowing rings to thread
  ringRadius: 15,         // fly-through radius of a ring (world units)
  perfectRadius: 6.5,     // crossing inside this radius counts as PERFECT
  startTime: 150,         // seconds on the clock at engine start

  // Scoring
  passPoints: 100,
  perfectPoints: 150,
  comboCap: 8,            // combo multiplier never exceeds ×8
  timeBonusPerSecond: 15, // per second left when the last ring resolves
  crashTimePenalty: 5,    // seconds lost per crash

  // Flight model (arcade)
  cruiseSpeed: 58,        // units / second
  boostSpeed: 92,
  brakeSpeed: 34,
  speedLerp: 1.6,         // how fast speed chases its target (per second)
  pitchRate: 1.15,        // rad / s at full stick
  maxPitch: 0.85,         // rad
  maxBank: 1.05,          // rad of roll at full stick
  bankLerp: 5.5,          // roll smoothing
  turnPerBank: 1.25,      // yaw rate = sin(bank) * this

  // World
  worldSeed: 7,
  oceanSize: 14000,
  courseAltMin: 70,
  courseAltMax: 175,

  // Camera
  camBack: 17.5,
  camUp: 6.2,
  camLerp: 4.2,
  baseFov: 62,
  boostFov: 76,
};
