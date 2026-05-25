import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { PLAYER_CONFIG } from '../config/game-config';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import { stanceHalfHeight } from '../player/player-stance';
import { BOT_STAND_HEADROOM_M } from './bot-route-clearance';

/** Short sweep — jump timing (m). */
export const JUMP_CAST_MAX_M = 1.05;
/** Re-arm vault after the path is this clear (m). */
export const JUMP_ARM_CLEAR_M = 1.02;
/** Jump only inside this band — just before contact, after autostep (~0.55 m). */
export const JUMP_WINDOW_MIN_M = 0.52;
export const JUMP_WINDOW_MAX_M = 0.92;

/** Steer fan when forward path is tight (rad) — includes wide peel for slanted debris. */
export const STEER_FAN_ANGLES_RAD: readonly number[] = [
  (-68 * Math.PI) / 180,
  (-48 * Math.PI) / 180,
  (-28 * Math.PI) / 180,
  (-12 * Math.PI) / 180,
  (12 * Math.PI) / 180,
  (28 * Math.PI) / 180,
  (48 * Math.PI) / 180,
  (68 * Math.PI) / 180
];

/** Longer sweep for route steering (m). */
export const STEER_CAST_MAX_M = 1.55;

/** Preferred gap between capsule shell and obstacles while walking (m). */
export const BOT_OBSTACLE_STANDOFF_M = 0.5;
/** Center clearance matching shell standoff — steer/nav share this threshold. */
export const BOT_OBSTACLE_STANDOFF_CENTER_M = BOT_OBSTACLE_STANDOFF_M + PLAYER_CONFIG.radius;

const VAULT_LANDING_SAMPLE_M = 1.15;
const GROUND_FIND_TOP_PAD_M = 2.5;
const GROUND_FIND_DOWN_M = 5;
const GROUND_RAY_PAD_M = 0.08;
const OVERHEAD_RAY_MAX_M = 12;
/** Nearly flat floor — CC / autostep handles, not steer/jump. */
const HORIZONTAL_FLOOR_NORMAL_Y = 0.82;

const CAPSULE_HALF = stanceHalfHeight(false);
const CAPSULE_RADIUS = PLAYER_CONFIG.radius;
const CAPSULE_BOTTOM_OFFSET = CAPSULE_HALF + CAPSULE_RADIUS;

const _identityRot: RAPIER.Rotation = { w: 1, x: 0, y: 0, z: 0 };

let _capsuleShape: RAPIER.Capsule | null = null;
let _probeRay: RAPIER.Ray | null = null;

export interface BodyCastAheadResult {
  readonly clearanceM: number;
  readonly hasHit: boolean;
  /** World normal on the hit collider (XZ useful for peel). */
  readonly hitNormalX: number;
  readonly hitNormalY: number;
  readonly hitNormalZ: number;
  /** Capsule path is tight and not a flat floor — steer/jump should react. */
  readonly pathBlocked: boolean;
  /** Solid hit in the jump window (includes slanted crate faces). */
  readonly vaultObstacle: boolean;
}

function capsuleShape(): RAPIER.Capsule {
  if (_capsuleShape === null) {
    _capsuleShape = new RAPIER.Capsule(CAPSULE_HALF, CAPSULE_RADIUS);
  }

  return _capsuleShape;
}

function probeRay(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number
): RAPIER.Ray {
  if (_probeRay === null) {
    _probeRay = new RAPIER.Ray(
      { x: originX, y: originY, z: originZ },
      { x: dirX, y: dirY, z: dirZ }
    );
    return _probeRay;
  }

  _probeRay.origin.x = originX;
  _probeRay.origin.y = originY;
  _probeRay.origin.z = originZ;
  _probeRay.dir.x = dirX;
  _probeRay.dir.y = dirY;
  _probeRay.dir.z = dirZ;
  return _probeRay;
}

function isHorizontalFloorHit(hit: RAPIER.ColliderShapeCastHit): boolean {
  return hit.normal2.y > HORIZONTAL_FLOOR_NORMAL_Y;
}

function isVaultObstacleHit(
  hit: RAPIER.ColliderShapeCastHit,
  clearanceM: number
): boolean {
  if (clearanceM < JUMP_WINDOW_MIN_M || clearanceM > JUMP_WINDOW_MAX_M) {
    return false;
  }

  return !isHorizontalFloorHit(hit);
}

/** 0–1 clearance comfort for steer/nav scoring (0 = at/below standoff, 1 = max probe). */
export function botClearanceComfortT(clearanceM: number, maxM: number): number {
  if (clearanceM >= maxM) {
    return 1;
  }

  if (clearanceM <= BOT_OBSTACLE_STANDOFF_CENTER_M) {
    return 0;
  }

  return (clearanceM - BOT_OBSTACLE_STANDOFF_CENTER_M) / (maxM - BOT_OBSTACLE_STANDOFF_CENTER_M);
}

/** Walk path blocked — vault band stays open so bots may close to jump. */
export function botWalkPathBlocked(
  clearanceM: number,
  floorLike: boolean,
  vaultObstacle: boolean
): boolean {
  if (floorLike || vaultObstacle) {
    return false;
  }

  return clearanceM < BOT_OBSTACLE_STANDOFF_CENTER_M;
}

function buildCastResult(
  hit: RAPIER.ColliderShapeCastHit | null,
  maxDistance: number
): BodyCastAheadResult {
  if (hit === null) {
    return {
      clearanceM: maxDistance,
      hasHit: false,
      hitNormalX: 0,
      hitNormalY: 0,
      hitNormalZ: 0,
      pathBlocked: false,
      vaultObstacle: false
    };
  }

  const clearanceM = hit.time_of_impact;
  const floorLike = isHorizontalFloorHit(hit);
  const vaultObstacle = isVaultObstacleHit(hit, clearanceM);
  const pathBlocked = botWalkPathBlocked(clearanceM, floorLike, vaultObstacle);

  return {
    clearanceM,
    hasHit: true,
    hitNormalX: hit.normal2.x,
    hitNormalY: hit.normal2.y,
    hitNormalZ: hit.normal2.z,
    pathBlocked,
    vaultObstacle
  };
}

/** Standing capsule swept along XZ — handles tilted rain debris (not horizontal slices). */
export function probeBodyCastAhead(
  world: World,
  excludeBody: RigidBody,
  centerX: number,
  centerY: number,
  centerZ: number,
  dirX: number,
  dirZ: number,
  maxDistance = JUMP_CAST_MAX_M
): BodyCastAheadResult {
  const hit = world.castShape(
    { x: centerX, y: centerY, z: centerZ },
    _identityRot,
    { x: dirX, y: 0, z: dirZ },
    capsuleShape(),
    0.01,
    maxDistance,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    excludeBody
  );

  return buildCastResult(hit, maxDistance);
}

/** Slide bearings along a slanted face (XZ tangent to hit normal). Writes into `out`; returns count. */
export function peelYawsInto(
  out: number[],
  offset: number,
  hitNormalX: number,
  hitNormalZ: number,
  goalDirX: number,
  goalDirZ: number
): number {
  const planarLen = Math.hypot(hitNormalX, hitNormalZ);
  if (planarLen < 0.12) {
    return 0;
  }

  const nx = hitNormalX / planarLen;
  const nz = hitNormalZ / planarLen;
  const leftX = -nz;
  const leftZ = nx;
  const rightX = nz;
  const rightZ = -nx;
  const leftAlign = leftX * goalDirX + leftZ * goalDirZ;
  const rightAlign = rightX * goalDirX + rightZ * goalDirZ;

  if (leftAlign >= rightAlign) {
    out[offset] = Math.atan2(leftX, leftZ);
    out[offset + 1] = Math.atan2(rightX, rightZ);
  } else {
    out[offset] = Math.atan2(rightX, rightZ);
    out[offset + 1] = Math.atan2(leftX, leftZ);
  }

  return 2;
}

/**
 * Down-ray finds local floor, then up-ray measures standing headroom —
 * works on uneven crate piles (not flat footY from capsule center).
 */
export function probeLocalStandingHeadroomM(
  world: World,
  excludeBody: RigidBody,
  sampleX: number,
  sampleZ: number,
  referenceCenterY: number
): number {
  const rayTopY = referenceCenterY + CAPSULE_BOTTOM_OFFSET + GROUND_FIND_TOP_PAD_M;
  const downRay = probeRay(sampleX, rayTopY, sampleZ, 0, -1, 0);
  const downHit = world.castRay(
    downRay,
    GROUND_FIND_DOWN_M + GROUND_FIND_TOP_PAD_M,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    excludeBody
  );

  const fallbackFootY = referenceCenterY - CAPSULE_BOTTOM_OFFSET;
  const footY =
    downHit === null ? fallbackFootY : rayTopY - downHit.timeOfImpact + GROUND_RAY_PAD_M;

  const upRay = probeRay(sampleX, footY, sampleZ, 0, 1, 0);
  const upHit = world.castRay(
    upRay,
    OVERHEAD_RAY_MAX_M,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    excludeBody
  );

  return upHit === null ? OVERHEAD_RAY_MAX_M : upHit.timeOfImpact;
}

export function probeForwardVaultHeadroomM(
  world: World,
  excludeBody: RigidBody,
  centerX: number,
  centerY: number,
  centerZ: number,
  dirX: number,
  dirZ: number,
  sampleDistanceM = VAULT_LANDING_SAMPLE_M
): number {
  return probeLocalStandingHeadroomM(
    world,
    excludeBody,
    centerX + dirX * sampleDistanceM,
    centerZ + dirZ * sampleDistanceM,
    centerY
  );
}

export function vaultLandingHeadroomClear(
  world: World,
  excludeBody: RigidBody,
  centerX: number,
  centerY: number,
  centerZ: number,
  dirX: number,
  dirZ: number
): boolean {
  return (
    probeForwardVaultHeadroomM(world, excludeBody, centerX, centerY, centerZ, dirX, dirZ) >=
    BOT_STAND_HEADROOM_M
  );
}
