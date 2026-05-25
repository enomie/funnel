// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-route-clearance.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { PLAYER_CONFIG } from '../config/game-config';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';

const FOOT_BELOW_CENTER_M = PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius;


export const BOT_STAND_HEADROOM_M =
  PLAYER_CONFIG.halfHeight * 2 + PLAYER_CONFIG.radius * 2 + 0.12;

const OVERHEAD_RAY_MAX_M = 30;
const OVERHEAD_FLOOR_PAD_M = 0.08;


const ROUTE_SAMPLE_DISTANCES_M: readonly number[] = [0.55, 1.25, 2.5, 4.5, 7];


const NECK_DOWN_STEP_M = 0.32;

const _routeHeadroomsScratch: number[] = [];

export interface RouteHeadroomProfile {
  readonly minHeadroomM: number;
  readonly neckDownDropM: number;
  
  readonly isNeckDownTrap: boolean;
}

export interface HeadroomProbeContext {
  readonly world: World;
  readonly excludeBody: RigidBody;
  readonly botX: number;
  readonly botY: number;
  readonly botZ: number;
}

export function probeRouteHeadroom(
  ctx: HeadroomProbeContext,
  dirX: number,
  dirZ: number
): RouteHeadroomProfile {
  const footY = ctx.botY - FOOT_BELOW_CENTER_M;
  _routeHeadroomsScratch.length = ROUTE_SAMPLE_DISTANCES_M.length;
  for (let index = 0; index < ROUTE_SAMPLE_DISTANCES_M.length; index += 1) {
    const distance = ROUTE_SAMPLE_DISTANCES_M[index];
    _routeHeadroomsScratch[index] = headroomAtM(
      ctx.world,
      ctx.excludeBody,
      footY,
      ctx.botX + dirX * distance,
      ctx.botZ + dirZ * distance
    );
  }

  let minHeadroomM = OVERHEAD_RAY_MAX_M;
  let neckDownDropM = 0;

  for (let index = 0; index < _routeHeadroomsScratch.length; index += 1) {
    const headroom = _routeHeadroomsScratch[index];
    minHeadroomM = Math.min(minHeadroomM, headroom);
  }

  for (let index = 1; index < _routeHeadroomsScratch.length; index += 1) {
    const drop = _routeHeadroomsScratch[index - 1] - _routeHeadroomsScratch[index];
    if (drop > neckDownDropM) {
      neckDownDropM = drop;
    }
  }

  const first = _routeHeadroomsScratch[0] ?? minHeadroomM;
  const isNeckDownTrap =
    first >= BOT_STAND_HEADROOM_M &&
    minHeadroomM < BOT_STAND_HEADROOM_M &&
    neckDownDropM >= NECK_DOWN_STEP_M;

  return { minHeadroomM, neckDownDropM, isNeckDownTrap };
}


export function scoreRouteHeadroomPenalty(profile: RouteHeadroomProfile): number {
  let penalty = 0;

  if (profile.minHeadroomM < BOT_STAND_HEADROOM_M) {
    penalty += (BOT_STAND_HEADROOM_M - profile.minHeadroomM) * 0.9;
  }

  if (profile.isNeckDownTrap) {
    penalty += 2.1;
  } else if (profile.neckDownDropM >= NECK_DOWN_STEP_M) {
    penalty += profile.neckDownDropM * 0.65;
  }

  return penalty;
}


export function headroomBlocksVault(
  ctx: HeadroomProbeContext,
  dirX: number,
  dirZ: number
): boolean {
  const profile = probeRouteHeadroom(ctx, dirX, dirZ);
  return profile.isNeckDownTrap || profile.minHeadroomM < BOT_STAND_HEADROOM_M;
}

let _headroomRay: RAPIER.Ray | null = null;

function headroomRay(originX: number, originY: number, originZ: number): RAPIER.Ray {
  if (_headroomRay === null) {
    _headroomRay = new RAPIER.Ray({ x: originX, y: originY, z: originZ }, { x: 0, y: 1, z: 0 });
    return _headroomRay;
  }

  _headroomRay.origin.x = originX;
  _headroomRay.origin.y = originY;
  _headroomRay.origin.z = originZ;
  return _headroomRay;
}

function headroomAtM(
  world: World,
  excludeBody: RigidBody,
  footY: number,
  x: number,
  z: number
): number {
  const ray = headroomRay(x, footY + OVERHEAD_FLOOR_PAD_M, z);
  const hit = world.castRay(
    ray,
    OVERHEAD_RAY_MAX_M,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    excludeBody
  );

  return hit === null ? OVERHEAD_RAY_MAX_M : hit.timeOfImpact;
}
