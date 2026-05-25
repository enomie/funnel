import { PHYSICS_CONFIG, PLAYER_CONFIG } from '../config/game-config';
import { fillPlanarVelocityFromInput, type MovementKeys } from './player-movement-speed';

/**
 * Single world gravity (m/s²). Jump speeds are derived from target apex height:
 * vy = √(2 · g · h) — Rapier integrates a natural parabola (steep at launch, flatter later).
 */
const GRAVITY = Math.abs(PHYSICS_CONFIG.gravity.y);

/** Desired apex above takeoff (meters). */
const APEX_HEIGHT_IDLE = 1.55;
const APEX_HEIGHT_WALK = 2.1;
const APEX_HEIGHT_RUN = 2.85;
const APEX_HEIGHT_BACKWARD = 1.85;

/** Stand hop — retain sliding carry; forward arc uses view yaw (see jump sketch). */
const HORIZONTAL_RETAIN_IDLE = 0.92;

/** Planar speed at apex for stand jump — thrust ramps with height during ascent. */
const IDLE_JUMP_FORWARD_MPS = PLAYER_CONFIG.walkSpeed;

/** Takeoff planar fraction — launch is mostly vertical; forward thrust ramps with height. */
export const JUMP_TAKEOFF_PLANAR_SCALE = 0.06;

function idleForwardPlanarFromYaw(yaw: number): { x: number; z: number } {
  return {
    x: Math.sin(yaw) * IDLE_JUMP_FORWARD_MPS,
    z: Math.cos(yaw) * IDLE_JUMP_FORWARD_MPS
  };
}

export type JumpStyle = 'idle' | 'walk' | 'run' | 'backward';

export interface JumpImpulseRequest {
  movement: MovementKeys;
  yaw: number;
  sprint: boolean;
  crouch: boolean;
  linvel: { x: number; y: number; z: number };
}

export interface JumpImpulseResult {
  x: number;
  y: number;
  z: number;
  style: JumpStyle;
  /** Idle-only — planar target reached by height-gated ascent thrust. */
  airThrustWishX: number;
  airThrustWishZ: number;
}

/** Ascent-only thrust — forward target scales with height gained (see sketch: steep up, then bend forward). */
export interface JumpAirThrustState {
  takeoffY: number;
  apexHeightM: number;
  wishX: number;
  wishZ: number;
}

export function upwardVelocityForApex(heightMeters: number): number {
  return Math.sqrt(2 * GRAVITY * heightMeters);
}

export function createJumpAirThrustState(
  takeoffY: number,
  takeoffVy: number,
  wishX: number,
  wishZ: number
): JumpAirThrustState | null {
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen < 0.001) {
    return null;
  }

  return {
    takeoffY,
    apexHeightM: jumpApexHeight(takeoffVy),
    wishX,
    wishZ
  };
}

/** Ramp planar speed toward wish while rising — coast on descent. */
export function applyJumpAirThrust(
  state: JumpAirThrustState,
  bodyY: number,
  vy: number,
  vx: number,
  vz: number,
  dt: number
): { x: number; z: number } {
  if (vy <= 0 || dt <= 0) {
    return { x: vx, z: vz };
  }

  const gained = bodyY - state.takeoffY;
  const ratio =
    state.apexHeightM > 0.001 ? Math.min(1, Math.max(0, gained / state.apexHeightM)) : 1;
  const weight = ratio * ratio;
  const targetX = state.wishX * weight;
  const targetZ = state.wishZ * weight;

  const maxDelta = PLAYER_CONFIG.airAcceleration * dt;
  let dx = targetX - vx;
  let dz = targetZ - vz;
  const deltaLen = Math.hypot(dx, dz);
  if (deltaLen > maxDelta && deltaLen > 0.0001) {
    const scale = maxDelta / deltaLen;
    dx *= scale;
    dz *= scale;
  }

  return { x: vx + dx, z: vz + dz };
}

/**
 * Takeoff impulse: walk/run/backward keep full planar inertia; idle launches mostly
 * vertical then thrusts forward along view yaw as height builds (jump sketch).
 */
export function computeJumpImpulse(request: JumpImpulseRequest): JumpImpulseResult {
  const { movement, yaw, sprint, crouch, linvel } = request;
  const wish = fillPlanarVelocityFromInput(movement, { sprint, crouch }, yaw);

  const moving = movement.forward || movement.back || movement.left || movement.right;
  const backward = movement.back && !movement.forward;

  let style: JumpStyle = 'idle';
  let up = upwardVelocityForApex(APEX_HEIGHT_IDLE);

  if (backward) {
    style = 'backward';
    up = upwardVelocityForApex(APEX_HEIGHT_BACKWARD);
  } else if (moving) {
    if (sprint && !crouch && movement.forward) {
      style = 'run';
      up = upwardVelocityForApex(APEX_HEIGHT_RUN);
    } else {
      style = 'walk';
      up = upwardVelocityForApex(APEX_HEIGHT_WALK);
    }
  }

  let x = linvel.x;
  let z = linvel.z;
  let airThrustWishX = 0;
  let airThrustWishZ = 0;

  const wishLen = Math.hypot(wish.x, wish.z);
  if (wishLen > 0.001) {
    x = wish.x;
    z = wish.z;
  } else if (style === 'idle') {
    const forward = idleForwardPlanarFromYaw(yaw);
    airThrustWishX = forward.x + linvel.x * HORIZONTAL_RETAIN_IDLE;
    airThrustWishZ = forward.z + linvel.z * HORIZONTAL_RETAIN_IDLE;
    x = airThrustWishX * JUMP_TAKEOFF_PLANAR_SCALE;
    z = airThrustWishZ * JUMP_TAKEOFF_PLANAR_SCALE;
  }

  return {
    x,
    y: up,
    z,
    style,
    airThrustWishX,
    airThrustWishZ
  };
}

export function jumpApexHeight(verticalVelocity: number): number {
  return (verticalVelocity * verticalVelocity) / (2 * GRAVITY);
}
