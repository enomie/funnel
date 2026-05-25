import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  NEUTRAL_PODIUM_BASE_HALF_M,
  NEUTRAL_PODIUM_DETOUR_PAD_M
} from '../arena/neutral-podium';
import {
  nearestSpawnShieldGapX,
  teamSpawnPocketExtentZ,
  teamSpawnShieldRowZ
} from '../arena/spawn-shield-cubes';
import { FUNNEL_DIMENSIONS, PLAYER_CONFIG } from '../config/game-config';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import type { FactionTeam } from '../combat/teams';
import {
  botClearanceComfortT,
  BOT_OBSTACLE_STANDOFF_CENTER_M
} from './bot-body-probe';
import {
  probeRouteHeadroom,
  scoreRouteHeadroomPenalty,
  type HeadroomProbeContext
} from './bot-route-clearance';

let _navProbeRay: RAPIER.Ray | null = null;

function navProbeRay(originX: number, originY: number, originZ: number, dirX: number, dirZ: number): RAPIER.Ray {
  if (_navProbeRay === null) {
    _navProbeRay = new RAPIER.Ray({ x: originX, y: originY, z: originZ }, { x: dirX, y: 0, z: dirZ });
    return _navProbeRay;
  }

  _navProbeRay.origin.x = originX;
  _navProbeRay.origin.y = originY;
  _navProbeRay.origin.z = originZ;
  _navProbeRay.dir.x = dirX;
  _navProbeRay.dir.y = 0;
  _navProbeRay.dir.z = dirZ;
  return _navProbeRay;
}

/** Longest forward probe when picking a move direction. */
const NAV_PROBE_MAX_M = 12;
/** Half-angle of the probe fan toward the goal (rad). */
const NAV_FAN_HALF_RAD = Math.PI * 0.42;
/** Probe count across the fan — odd so straight-ahead is sampled. */
const NAV_PROBE_COUNT = 11;
/** Full-circle samples when escaping dead ends. */
const NAV_ESCAPE_PROBE_COUNT = 16;
/** How far ahead the steered sub-goal sits along the chosen bearing. */
const NAV_STEER_LOOKAHEAD_M = 7;
/** Enter widen fan after this many stuck physics steps. */
export const NAV_STUCK_WIDEN_FRAMES = 5;
/** Start lateral peel — scher increasingly off the goal bearing. */
export const NAV_STUCK_PEEL_FRAMES = 12;
/** Full 360° clearance escape + reverse. */
export const NAV_STUCK_ESCAPE_FRAMES = 28;
/** Extra fan width during widen (rad). */
const NAV_STUCK_EXTRA_FAN_RAD = Math.PI * 0.35;
/** Peel angle at peel start / just before escape (rad). */
const NAV_PEEL_ANGLE_MIN_RAD = (22 * Math.PI) / 180;
const NAV_PEEL_ANGLE_MAX_RAD = (82 * Math.PI) / 180;
/** Margin from shell side walls when scoring lateral clearance. */
const NAV_WALL_MARGIN_M = PLAYER_CONFIG.radius + 0.45;
/** Penalize rapid bearing changes (reduces visual flicker). */
const NAV_TURN_HYSTERESIS = 0.22;

/** Probe heights from capsule center — includes head band for sloped / overhead hits. */
const NAV_PROBE_Y_OFFSETS: readonly number[] = [
  -(PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius) + 0.35,
  -(PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius) + 0.72,
  0.08,
  0.35,
  PLAYER_CONFIG.halfHeight + 0.08
];

interface MutableHeadroomProbeContext {
  world: World;
  excludeBody: RigidBody;
  botX: number;
  botY: number;
  botZ: number;
}

const _headroomCtxScratch: MutableHeadroomProbeContext = {
  world: null as unknown as World,
  excludeBody: null as unknown as RigidBody,
  botX: 0,
  botY: 0,
  botZ: 0
};

export interface BotNavigationInput {
  readonly world: World;
  readonly excludeBody: RigidBody;
  readonly botX: number;
  readonly botY: number;
  readonly botZ: number;
  readonly faction: FactionTeam;
  readonly goalX: number;
  readonly goalZ: number;
  readonly stuckFrames: number;
  readonly priorMoveYaw?: number;
  /** +1 = peel left, −1 = peel right — committed for the peel phase. */
  readonly peelSign?: 1 | -1;
}

export type NavStuckPhase = 'seek' | 'widen' | 'peel' | 'escape';

export function resolveNavStuckPhase(stuckFrames: number): NavStuckPhase {
  if (stuckFrames >= NAV_STUCK_ESCAPE_FRAMES) {
    return 'escape';
  }

  if (stuckFrames >= NAV_STUCK_PEEL_FRAMES) {
    return 'peel';
  }

  if (stuckFrames >= NAV_STUCK_WIDEN_FRAMES) {
    return 'widen';
  }

  return 'seek';
}

export function resolvePeelSign(input: BotNavigationInput): 1 | -1 {
  const dx = input.goalX - input.botX;
  const dz = input.goalZ - input.botZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.05) {
    return 1;
  }

  const goalYaw = Math.atan2(dx, dz);
  const leftX = Math.sin(goalYaw + Math.PI * 0.5);
  const leftZ = Math.cos(goalYaw + Math.PI * 0.5);
  const rightX = Math.sin(goalYaw - Math.PI * 0.5);
  const rightZ = Math.cos(goalYaw - Math.PI * 0.5);
  const leftClear = probeClearanceM(input, leftX, leftZ, NAV_PROBE_MAX_M);
  const rightClear = probeClearanceM(input, rightX, rightZ, NAV_PROBE_MAX_M);
  const headroomCtx = headroomContextFrom(input);
  const leftHead = probeRouteHeadroom(headroomCtx, leftX, leftZ).minHeadroomM;
  const rightHead = probeRouteHeadroom(headroomCtx, rightX, rightZ).minHeadroomM;

  const leftScore = leftClear + leftHead * 0.85;
  const rightScore = rightClear + rightHead * 0.85;

  return leftScore >= rightScore ? 1 : -1;
}

export interface BotNavigationGoal {
  readonly x: number;
  readonly z: number;
}

export interface BotNavigationResult extends BotNavigationGoal {
  readonly moveYaw: number;
}

export type MutableBotNavigationResult = {
  x: number;
  z: number;
  moveYaw: number;
};

type MutableDirPick = {
  dirX: number;
  dirZ: number;
  yaw: number;
};

const _navResultScratch: MutableBotNavigationResult = { x: 0, z: 0, moveYaw: 0 };
const _dirPickScratch: MutableDirPick = { dirX: 0, dirZ: 0, yaw: 0 };
const _waypointScratch = { x: 0, z: 0 };

export function fillBotNavigationGoal(
  input: BotNavigationInput,
  out: MutableBotNavigationResult = _navResultScratch
): BotNavigationResult {
  let goalX = input.goalX;
  let goalZ = input.goalZ;

  if (fillSpawnPocketWaypoint(input.faction, input.botX, input.botZ, _waypointScratch)) {
    goalX = _waypointScratch.x;
    goalZ = _waypointScratch.z;
  }

  if (fillNeutralPodiumDetour(input.botX, input.botZ, goalX, goalZ, _waypointScratch)) {
    goalX = _waypointScratch.x;
    goalZ = _waypointScratch.z;
  }

  const dx = goalX - input.botX;
  const dz = goalZ - input.botZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.05) {
    out.x = goalX;
    out.z = goalZ;
    out.moveYaw = input.priorMoveYaw ?? Math.atan2(dx, dz);
    return out;
  }

  const goalDirX = dx / distance;
  const goalDirZ = dz / distance;
  const goalYaw = Math.atan2(goalDirX, goalDirZ);
  const phase = resolveNavStuckPhase(input.stuckFrames);
  const probeDistance = Math.min(
    NAV_PROBE_MAX_M,
    Math.max(BOT_OBSTACLE_STANDOFF_CENTER_M + 0.5, distance)
  );

  const pick =
    phase === 'escape'
      ? fillEscapeDirection(input, goalDirX, goalDirZ, probeDistance, _dirPickScratch)
      : phase === 'peel' && input.peelSign !== undefined
        ? fillPeelDirection(
            input,
            goalDirX,
            goalDirZ,
            goalYaw,
            probeDistance,
            input.peelSign,
            _dirPickScratch
          )
        : fillGoalDirection(input, goalDirX, goalDirZ, goalYaw, probeDistance, phase, _dirPickScratch);

  const lookaheadScale = phase === 'escape' ? 1.35 : phase === 'peel' ? 1.2 : 1;
  const lookahead = Math.min(distance, NAV_STEER_LOOKAHEAD_M * lookaheadScale);
  out.x = input.botX + pick.dirX * lookahead;
  out.z = input.botZ + pick.dirZ * lookahead;
  out.moveYaw = pick.yaw;
  return out;
}

/** @deprecated Use `fillBotNavigationGoal`. */
export function resolveBotNavigationGoal(input: BotNavigationInput): BotNavigationResult {
  return fillBotNavigationGoal(input, { x: 0, z: 0, moveYaw: 0 });
}

function fillGoalDirection(
  input: BotNavigationInput,
  goalDirX: number,
  goalDirZ: number,
  goalYaw: number,
  probeDistance: number,
  phase: NavStuckPhase,
  out: MutableDirPick
): MutableDirPick {
  const goalClearance = probeClearanceM(input, goalDirX, goalDirZ, probeDistance);
  const blockedAhead =
    input.stuckFrames >= NAV_STUCK_WIDEN_FRAMES &&
    goalClearance < BOT_OBSTACLE_STANDOFF_CENTER_M;
  const effectivePhase: NavStuckPhase =
    blockedAhead && phase === 'seek' ? 'widen' : phase;
  const blockT = blockedAhead
    ? Math.min(
        1,
        (BOT_OBSTACLE_STANDOFF_CENTER_M - goalClearance) / BOT_OBSTACLE_STANDOFF_CENTER_M
      )
    : 0;

  const fanHalf =
    NAV_FAN_HALF_RAD +
    (effectivePhase === 'widen' ? NAV_STUCK_EXTRA_FAN_RAD + blockT * 0.28 : 0);
  const widenT =
    effectivePhase === 'widen'
      ? Math.min(
          1,
          (input.stuckFrames - NAV_STUCK_WIDEN_FRAMES) /
            Math.max(1, NAV_STUCK_PEEL_FRAMES - NAV_STUCK_WIDEN_FRAMES)
        )
      : 0;
  const clearanceWeight = 0.12 + widenT * 0.38 + blockT * 0.52;
  const alignmentWeight = Math.max(0.04, 0.88 - widenT * 0.52 - blockT * 0.72);

  let bestScore = -Infinity;
  let bestDirX = goalDirX;
  let bestDirZ = goalDirZ;

  for (let index = 0; index < NAV_PROBE_COUNT; index += 1) {
    const t = index / (NAV_PROBE_COUNT - 1);
    const angle = goalYaw + (t * 2 - 1) * fanHalf;
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    const score = scoreDirection(
      input,
      dirX,
      dirZ,
      probeDistance,
      goalDirX,
      goalDirZ,
      clearanceWeight,
      alignmentWeight
    );

    if (score > bestScore) {
      bestScore = score;
      bestDirX = dirX;
      bestDirZ = dirZ;
    }
  }

  out.dirX = bestDirX;
  out.dirZ = bestDirZ;
  out.yaw = Math.atan2(bestDirX, bestDirZ);
  return out;
}

function fillPeelDirection(
  input: BotNavigationInput,
  goalDirX: number,
  goalDirZ: number,
  goalYaw: number,
  probeDistance: number,
  peelSign: 1 | -1,
  out: MutableDirPick
): MutableDirPick {
  const peelT = Math.min(
    1,
    (input.stuckFrames - NAV_STUCK_PEEL_FRAMES) /
      Math.max(1, NAV_STUCK_ESCAPE_FRAMES - NAV_STUCK_PEEL_FRAMES)
  );
  const peelAngle =
    NAV_PEEL_ANGLE_MIN_RAD + (NAV_PEEL_ANGLE_MAX_RAD - NAV_PEEL_ANGLE_MIN_RAD) * peelT;
  const centerYaw = goalYaw + peelSign * peelAngle;
  const fanHalf = NAV_FAN_HALF_RAD * (0.45 + peelT * 0.2);
  const clearanceWeight = 0.58 + peelT * 0.32;
  const alignmentWeight = Math.max(0.04, 0.42 - peelT * 0.38);

  let bestScore = -Infinity;
  let bestDirX = Math.sin(centerYaw);
  let bestDirZ = Math.cos(centerYaw);

  for (let index = 0; index < NAV_PROBE_COUNT; index += 1) {
    const t = index / (NAV_PROBE_COUNT - 1);
    const angle = centerYaw + (t * 2 - 1) * fanHalf;
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    const score = scoreDirection(
      input,
      dirX,
      dirZ,
      probeDistance,
      goalDirX,
      goalDirZ,
      clearanceWeight,
      alignmentWeight
    );

    if (score > bestScore) {
      bestScore = score;
      bestDirX = dirX;
      bestDirZ = dirZ;
    }
  }

  out.dirX = bestDirX;
  out.dirZ = bestDirZ;
  out.yaw = Math.atan2(bestDirX, bestDirZ);
  return out;
}

function fillEscapeDirection(
  input: BotNavigationInput,
  goalDirX: number,
  goalDirZ: number,
  probeDistance: number,
  out: MutableDirPick
): MutableDirPick {
  let bestScore = -Infinity;
  let bestDirX = goalDirX;
  let bestDirZ = goalDirZ;

  for (let index = 0; index < NAV_ESCAPE_PROBE_COUNT; index += 1) {
    const angle = (index / NAV_ESCAPE_PROBE_COUNT) * Math.PI * 2;
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    const score = scoreDirection(input, dirX, dirZ, probeDistance, goalDirX, goalDirZ, 0.82, 0.18);

    if (score > bestScore) {
      bestScore = score;
      bestDirX = dirX;
      bestDirZ = dirZ;
    }
  }

  if (input.priorMoveYaw !== undefined) {
    const reverseX = -Math.sin(input.priorMoveYaw);
    const reverseZ = -Math.cos(input.priorMoveYaw);
    const reverseScore = scoreDirection(
      input,
      reverseX,
      reverseZ,
      probeDistance,
      goalDirX,
      goalDirZ,
      0.9,
      0.1
    );
    if (reverseScore > bestScore) {
      bestDirX = reverseX;
      bestDirZ = reverseZ;
    }
  }

  out.dirX = bestDirX;
  out.dirZ = bestDirZ;
  out.yaw = Math.atan2(bestDirX, bestDirZ);
  return out;
}

function scoreDirection(
  input: BotNavigationInput,
  dirX: number,
  dirZ: number,
  probeDistance: number,
  goalDirX: number,
  goalDirZ: number,
  clearanceWeight: number,
  alignmentWeight: number
): number {
  const clearance = probeClearanceM(input, dirX, dirZ, probeDistance);
  const alignment = dirX * goalDirX + dirZ * goalDirZ;
  const wallPenalty = wallProximityPenalty(input.botX, dirX);
  const turnPenalty = turnHysteresisPenalty(
    input.priorMoveYaw,
    dirX,
    dirZ,
    input.stuckFrames,
    clearance
  );
  const headroomPenalty = scoreRouteHeadroomPenalty(
    probeRouteHeadroom(headroomContextFrom(input), dirX, dirZ)
  );

  return (
    botClearanceComfortT(clearance, NAV_PROBE_MAX_M) *
      (clearanceWeight + alignmentWeight * Math.max(alignment, 0)) -
    wallPenalty -
    turnPenalty -
    headroomPenalty
  );
}

function headroomContextFrom(input: BotNavigationInput): HeadroomProbeContext {
  _headroomCtxScratch.world = input.world;
  _headroomCtxScratch.excludeBody = input.excludeBody;
  _headroomCtxScratch.botX = input.botX;
  _headroomCtxScratch.botY = input.botY;
  _headroomCtxScratch.botZ = input.botZ;
  return _headroomCtxScratch;
}

function turnHysteresisPenalty(
  priorMoveYaw: number | undefined,
  dirX: number,
  dirZ: number,
  stuckFrames: number,
  dirClearance: number
): number {
  if (priorMoveYaw === undefined) {
    return 0;
  }

  const priorX = Math.sin(priorMoveYaw);
  const priorZ = Math.cos(priorMoveYaw);
  const alignment = dirX * priorX + dirZ * priorZ;

  if (stuckFrames >= NAV_STUCK_WIDEN_FRAMES || dirClearance < BOT_OBSTACLE_STANDOFF_CENTER_M) {
    return Math.max(0, alignment) * NAV_TURN_HYSTERESIS * 0.2;
  }

  return (1 - Math.max(alignment, 0)) * NAV_TURN_HYSTERESIS;
}

function fillSpawnPocketWaypoint(
  faction: FactionTeam,
  botX: number,
  botZ: number,
  out: { x: number; z: number }
): boolean {
  const pocket = teamSpawnPocketExtentZ(faction);
  if (botZ < pocket.minZ - 0.5 || botZ > pocket.maxZ + 0.5) {
    return false;
  }

  const towardNeutral = faction === 'alpha' ? 1 : -1;
  const rearZ = teamSpawnShieldRowZ(faction, 'rear');
  const frontZ = teamSpawnShieldRowZ(faction, 'front');
  const pastFrontRow = towardNeutral > 0 ? botZ > frontZ + 2.5 : botZ < frontZ - 2.5;
  if (pastFrontRow) {
    return false;
  }

  const beforeRearRow = towardNeutral > 0 ? botZ < rearZ - 1 : botZ > rearZ + 1;
  if (beforeRearRow) {
    out.x = nearestSpawnShieldGapX('rear', botX);
    out.z = rearZ + towardNeutral * 2.5;
    return true;
  }

  out.x = nearestSpawnShieldGapX('front', botX);
  out.z = frontZ + towardNeutral * 2.5;
  return true;
}

function fillNeutralPodiumDetour(
  botX: number,
  botZ: number,
  goalX: number,
  goalZ: number,
  out: { x: number; z: number }
): boolean {
  const half = NEUTRAL_PODIUM_BASE_HALF_M + NEUTRAL_PODIUM_DETOUR_PAD_M;
  const minX = -half;
  const maxX = half;
  const minZ = -half;
  const maxZ = half;

  if (pointInRect(botX, botZ, minX, minZ, maxX, maxZ)) {
    return false;
  }

  if (pointInRect(goalX, goalZ, minX, minZ, maxX, maxZ)) {
    return false;
  }

  if (!segmentIntersectsRect(botX, botZ, goalX, goalZ, minX, minZ, maxX, maxZ)) {
    return false;
  }

  const routeHalf = NEUTRAL_PODIUM_BASE_HALF_M + NEUTRAL_PODIUM_DETOUR_PAD_M;
  const corners: readonly (readonly [number, number])[] = [
    [-routeHalf, -routeHalf],
    [routeHalf, -routeHalf],
    [-routeHalf, routeHalf],
    [routeHalf, routeHalf]
  ];

  let bestX = routeHalf;
  let bestZ = -routeHalf;
  let bestDist = Infinity;

  for (const [cornerX, cornerZ] of corners) {
    const dist =
      Math.hypot(cornerX - botX, cornerZ - botZ) +
      Math.hypot(goalX - cornerX, goalZ - cornerZ);
    if (dist < bestDist) {
      bestDist = dist;
      bestX = cornerX;
      bestZ = cornerZ;
    }
  }

  out.x = bestX;
  out.z = bestZ;
  return true;
}

function probeClearanceM(
  input: BotNavigationInput,
  dirX: number,
  dirZ: number,
  maxDistance: number
): number {
  let minClearance = maxDistance;

  for (const yOffset of NAV_PROBE_Y_OFFSETS) {
    const ray = navProbeRay(input.botX, input.botY + yOffset, input.botZ, dirX, dirZ);
    const hit = input.world.castRay(
      ray,
      maxDistance,
      true,
      undefined,
      ACTOR_RAY_QUERY_GROUPS,
      undefined,
      input.excludeBody
    );

    const clearance = hit === null ? maxDistance : hit.timeOfImpact;
    minClearance = Math.min(minClearance, clearance);
  }

  return minClearance;
}

function wallProximityPenalty(botX: number, dirX: number): number {
  const halfW = FUNNEL_DIMENSIONS.width * 0.5 - NAV_WALL_MARGIN_M;
  const margin = halfW - Math.abs(botX);
  if (margin >= 2.5) {
    return 0;
  }

  const towardWall = botX > 0 ? dirX > 0 : dirX < 0;
  if (!towardWall) {
    return 0;
  }

  return (2.5 - Math.max(margin, 0)) * 0.18;
}

function pointInRect(
  x: number,
  z: number,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
): boolean {
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function segmentIntersectsRect(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
): boolean {
  if (pointInRect(x0, z0, minX, minZ, maxX, maxZ) || pointInRect(x1, z1, minX, minZ, maxX, maxZ)) {
    return true;
  }

  return (
    segmentsIntersect(x0, z0, x1, z1, minX, minZ, maxX, minZ) ||
    segmentsIntersect(x0, z0, x1, z1, minX, maxZ, maxX, maxZ) ||
    segmentsIntersect(x0, z0, x1, z1, minX, minZ, minX, maxZ) ||
    segmentsIntersect(x0, z0, x1, z1, maxX, minZ, maxX, maxZ)
  );
}

function segmentsIntersect(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number
): boolean {
  const denominator = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(denominator) <= 1e-9) {
    return false;
  }

  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / denominator;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / denominator;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
