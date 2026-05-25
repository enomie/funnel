import type { EnvironmentRainShapeId } from '../arena/environment-rain-catalog';

export const FUNNEL_DIMENSIONS = {
  width: 50,
  length: 300,
  height: 50
} as const;

/** Tunnel length split into equal caps + center (default: 3 × 100 m). */
export const FUNNEL_ZONE_COUNT = 3 as const;
export const FUNNEL_ZONE_LENGTH_M = FUNNEL_DIMENSIONS.length / FUNNEL_ZONE_COUNT;

/** World Z extents for zone `0` = north (alpha), `1` = neutral, `2` = south (beta). */
export function funnelZoneExtentZ(zoneIndex: number): { minZ: number; maxZ: number } {
  const half = FUNNEL_DIMENSIONS.length * 0.5;
  const minZ = -half + zoneIndex * FUNNEL_ZONE_LENGTH_M;
  return { minZ, maxZ: minZ + FUNNEL_ZONE_LENGTH_M };
}

export const PLAYER_CONFIG = {
  radius: 0.35,
  halfHeight: 0.525,
  /** Total Rapier capsule height while crouched (cylinder + both hemispheres). */
  crouchCapsuleHeightM: 1,
  /** Lateral spawn anchor — X; Z from `playerFactionSpawnPosition` / `playerMatchStartDropPosition`. */
  spawn: {
    x: 0,
    y: 1.75
  },
  walkSpeed: 7,
  sprintSpeed: 11,
  crouchSpeed: 2.5,
  /**
   * Visual locomotion stride — measured Mixamo hip path × this value.
   * Higher = longer apparent steps / slower leg cadence at the same world speed.
   * Lower = shorter steps / faster leg cadence (may look frantic or slide if too low).
   */
  locomotionStrideScale: 2.5,
  /** Eye pivot above capsule center while crouched — see `humanoid-eye-height.ts`. */
  crouchCameraHeight: 0.25,
  /** Collapsed death pose on crouch capsule. */
  deathCameraHeight: 0.18,
  airAcceleration: 18,
  /** Legacy — jump uses apex heights in `src/player/player-jump.ts`. */
  jumpVelocity: 24,
  mouseSensitivity: 0.0013,
  /** Third-person boom length (m) — line-of-sight pull-in only if view to player is blocked. */
  thirdPersonDistance: 5.5,
  cameraHeight: 0.49,
  cameraSide: 0.5,
  maxHealth: 100,
  maxShield: 100,
  /** Ms without damage before health regen starts. */
  healthRegenDelayMs: 3000,
  /** Health points restored per second while regen is active. */
  healthRegenPerSecond: 25
} as const;

/** Global weapon damage floor — applied once in `apply-impact.ts` for all hit types. */
export const COMBAT_DAMAGE_CONFIG = {
  /** Direct hit, splash edge, shrapnel/splitter — never below this fraction of max health. */
  minHealthFraction: 0.3
} as const;

export const PICKUP_FIELD_CONFIG = {
  shieldCount: 6,
  healthCount: 6,
  /** Collection radius around pickup center (m). */
  collectRadiusM: 1.35,
  /** kg/m³ — lighter than rain debris so pickups tumble as items. */
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

/** Capsule center Y when feet stand on arena floor (collider top at y = 0). */
export const PLAYER_GROUNDED_CENTER_Y =
  PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius;

export const DEBUG_CONFIG: {
  readonly showProjectileRays: boolean;
  readonly showCapsuleColliders: boolean;
  readonly profileFrameMarks: boolean;
} = {
  /** Projectile ray-step trail VFX (Rapier casts always run). */
  showProjectileRays: false,
  /** Rapier humanoid capsule wireframe — reads active collider halfHeight/radius each frame. */
  showCapsuleColliders: false,
  /** `performance.mark` / `measure` slices in the animation loop (dev profiling). */
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
  /** m/s² — one gravity for player, crates, builds (was mTPS -196.2 ≈ 20× Earth). */
  gravity: { x: 0, y: -32, z: 0 }
} as const;

/** Team match scoring — first to `pointsToWin` wins. */
export const MATCH_CONFIG = {
  pointsToWin: 1000,
  /** HUD badge cap (`999 Points`); internal score may exceed until win is recorded. */
  pointsDisplayMax: 999,
  pointsPerCrossFactionKill: 1,
  /** Per living fighter standing in enemy home zone, each full second. */
  pointsPerPresenceSecond: 1
} as const;

export const ENVIRONMENT_CONFIG: {
  readonly rainEnabled: boolean;
  /** T-pose faction mannequins at team spawn bulkhead (see `team-spawn-mascots.ts`). */
  readonly teamSpawnMascotsEnabled: boolean;
  /** Pieces per geometry when `rainEnabled` — `0` skips that shape (see docs/environment-dynamic.md). */
  readonly rainCounts: Record<EnvironmentRainShapeId, number>;
} = {
  /** Tetris rain — procedural geometry drops during countdown. */
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
