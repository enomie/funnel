export const FUNNEL_DIMENSIONS = {
  width: 50,
  length: 300,
  height: 50
} as const;

export const PLAYER_CONFIG = {
  radius: 0.35,
  halfHeight: 0.525,
  spawn: { x: 0, y: 1.75, z: 128 },
  walkSpeed: 5,
  sprintSpeed: 8,
  crouchSpeed: 2.5,
  airAcceleration: 18,
  jumpVelocity: 24,
  maxFallSpeed: -10,
  mouseSensitivity: 0.0013,
  cameraDistance: 1.6,
  cameraHeight: 0.6,
  cameraSide: 0.5,
  maxHealth: 100
} as const;

export const BUILD_CONFIG = {
  grid: 5,
  storyHeight: 4,
  wallThickness: 0.22,
  maxHealth: 150,
  buildReach: 9
} as const;

export const WEAPON_CONFIG = {
  fireIntervalMs: 95,
  range: 180,
  damage: 34,
  tracerDurationMs: 55
} as const;

export const PHYSICS_CONFIG = {
  fixedStep: 0.01,
  maxSubSteps: 6,
  gravity: { x: 0, y: -196.2, z: 0 }
} as const;
