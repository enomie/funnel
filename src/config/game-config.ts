// Path: /Users/johann/MyBrew/funnel-real/src/config/game-config.ts

import type { EnvironmentRainShapeId } from '../arena/environment-rain-catalog';

export const FUNNEL_DIMENSIONS = {
  width: 50,
  length: 300,
  height: 50
} as const;


export const FUNNEL_ZONE_COUNT = 3 as const;
export const FUNNEL_ZONE_LENGTH_M = FUNNEL_DIMENSIONS.length / FUNNEL_ZONE_COUNT;


export function funnelZoneExtentZ(zoneIndex: number): { minZ: number; maxZ: number } {
  const half = FUNNEL_DIMENSIONS.length * 0.5;
  const minZ = -half + zoneIndex * FUNNEL_ZONE_LENGTH_M;
  return { minZ, maxZ: minZ + FUNNEL_ZONE_LENGTH_M };
}

export const PLAYER_CONFIG = {
  radius: 0.35,
  halfHeight: 0.525,
  
  crouchCapsuleHeightM: 1,
  
  spawn: {
    x: 0,
    y: 1.75
  },
  walkSpeed: 7,
  sprintSpeed: 11,
  crouchSpeed: 2.5,
  
  locomotionStrideScale: 2.5,
  
  crouchCameraHeight: 0.25,
  
  deathCameraHeight: 0.18,
  airAcceleration: 18,
  
  jumpVelocity: 24,
  mouseSensitivity: 0.0013,
  
  thirdPersonDistance: 5.5,
  cameraHeight: 0.49,
  cameraSide: 0.5,
  maxHealth: 100,
  maxShield: 100,
  
  healthRegenDelayMs: 3000,
  
  healthRegenPerSecond: 25
} as const;


export const COMBAT_DAMAGE_CONFIG = {
  
  minHealthFraction: 0.3
} as const;

export const PICKUP_FIELD_CONFIG = {
  shieldCount: 6,
  healthCount: 6,
  
  collectRadiusM: 1.35,
  
  density: 220,
  shield: {
    color: 0x58d6ff,
    emissiveIntensity: 1.35,
    grantAmount: 50,
    radius: 0.42
  },
  health: {
    color: 0x58ffb0,
    emissiveIntensity: 1.25,
    grantAmount: 25,
    size: [1, 0.5, 1] as const
  }
} as const;


export const PLAYER_GROUNDED_CENTER_Y =
  PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius;

export const DEBUG_CONFIG: {
  readonly showProjectileRays: boolean;
  readonly showCapsuleColliders: boolean;
  readonly profileFrameMarks: boolean;
} = {
  
  showProjectileRays: false,
  
  showCapsuleColliders: false,
  
  profileFrameMarks: false
};

export const WEAPON_CONFIG = {
  fireIntervalMs: 95,
  range: 180,
  damage: 34,
  tracerDurationMs: 55
} as const;

export const PHYSICS_CONFIG = {
  fixedStep: 0.01,
  maxSubSteps: 6,
  
  gravity: { x: 0, y: -32, z: 0 }
} as const;


export const MATCH_CONFIG = {
  pointsToWin: 1000,
  
  pointsDisplayMax: 999,
  pointsPerCrossFactionKill: 1,
  
  pointsPerPresenceSecond: 1
} as const;

export const ENVIRONMENT_CONFIG: {
  readonly rainEnabled: boolean;
  
  readonly teamSpawnMascotsEnabled: boolean;
  
  readonly rainCounts: Record<EnvironmentRainShapeId, number>;
} = {
  
  rainEnabled: true,
  teamSpawnMascotsEnabled: true,
  rainCounts: {
    'cube-5': 2,
    'cube-3': 2,
    'cube-2': 2,
    'slab-20x5x1': 0,
    'ramp-5x5x10': 2,
    'pillar-2x10': 2,
    'pillar-1x5': 0,
    'pillar-2x20': 0
  }
};
