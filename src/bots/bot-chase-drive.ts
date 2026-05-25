// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-chase-drive.ts

import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { PLAYER_CONFIG } from '../config/game-config';
import type { BotBrainIntent } from './bot-brain';
import type { FactionTeam } from '../combat/teams';
import type { MovementKeys } from '../player/player-movement-speed';
import { planarSpeedFromInput } from '../player/player-movement-speed';
import type { BotNavigationCache } from './bot-navigation-cache';
import type { BotRouteSteerCache } from './bot-route-steer';


const CHASE_STOP_RADIUS_M = 2.8;


function resolveChaseFaceYaw(intent: BotBrainIntent, movementFaceYaw: number): number {
  if (intent.state === 'hunt') {
    return intent.aimYaw;
  }

  if (intent.state === 'push' && intent.wantsFire) {
    return intent.aimYaw;
  }

  return movementFaceYaw;
}

const IDLE_MOVEMENT: MovementKeys = {
  forward: false,
  back: false,
  left: false,
  right: false
};

export { IDLE_MOVEMENT };

export interface BotDriveCommand {
  readonly faceYaw: number;
  readonly moveYaw: number;
  readonly planarVelocity: { x: number; z: number };
  readonly sprint: boolean;
  readonly moving: boolean;
  readonly movement: MovementKeys;
  readonly chaseGoalX: number;
  readonly chaseGoalZ: number;
  
  readonly routeDetour: boolean;
}

export type MutableBotDriveCommand = {
  faceYaw: number;
  moveYaw: number;
  planarVelocity: { x: number; z: number };
  sprint: boolean;
  moving: boolean;
  movement: MovementKeys;
  chaseGoalX: number;
  chaseGoalZ: number;
  routeDetour: boolean;
};

function fillIdleDrive(out: MutableBotDriveCommand, faceYaw: number, moveYaw: number, chaseGoalX: number, chaseGoalZ: number, routeDetour: boolean): void {
  out.faceYaw = faceYaw;
  out.moveYaw = moveYaw;
  out.planarVelocity.x = 0;
  out.planarVelocity.z = 0;
  out.sprint = false;
  out.moving = false;
  out.movement.forward = false;
  out.movement.back = false;
  out.movement.left = false;
  out.movement.right = false;
  out.chaseGoalX = chaseGoalX;
  out.chaseGoalZ = chaseGoalZ;
  out.routeDetour = routeDetour;
}

export function fillChaseDrive(
  botX: number,
  botZ: number,
  targetX: number,
  targetZ: number,
  faceYaw: number,
  moveYaw: number,
  sprint: boolean,
  chaseGoalX: number,
  chaseGoalZ: number,
  out: MutableBotDriveCommand,
  routeDetour = false
): void {
  const steerDx = targetX - botX;
  const steerDz = targetZ - botZ;
  const ultimateDx = chaseGoalX - botX;
  const ultimateDz = chaseGoalZ - botZ;
  const ultimateDistance = Math.hypot(ultimateDx, ultimateDz);

  if (ultimateDistance <= CHASE_STOP_RADIUS_M) {
    fillIdleDrive(out, faceYaw, moveYaw, chaseGoalX, chaseGoalZ, routeDetour);
    return;
  }

  const steerDistance = Math.hypot(steerDx, steerDz);
  if (steerDistance <= 0.05) {
    const fallbackYaw = Math.atan2(ultimateDx, ultimateDz);
    const dirX = Math.sin(fallbackYaw);
    const dirZ = Math.cos(fallbackYaw);
    const speed = sprint ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
    out.faceYaw = faceYaw;
    out.moveYaw = fallbackYaw;
    out.planarVelocity.x = dirX * speed;
    out.planarVelocity.z = dirZ * speed;
    out.sprint = sprint;
    out.moving = true;
    out.movement.forward = true;
    out.movement.back = false;
    out.movement.left = false;
    out.movement.right = false;
    out.chaseGoalX = chaseGoalX;
    out.chaseGoalZ = chaseGoalZ;
    out.routeDetour = routeDetour;
    return;
  }

  const speed = sprint ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
  const dirX = Math.sin(moveYaw);
  const dirZ = Math.cos(moveYaw);
  out.faceYaw = faceYaw;
  out.moveYaw = moveYaw;
  out.planarVelocity.x = dirX * speed;
  out.planarVelocity.z = dirZ * speed;
  out.sprint = sprint;
  out.moving = true;
  out.movement.forward = true;
  out.movement.back = false;
  out.movement.left = false;
  out.movement.right = false;
  out.chaseGoalX = chaseGoalX;
  out.chaseGoalZ = chaseGoalZ;
  out.routeDetour = routeDetour;
}


export function tickBotRouteSteerFrame(
  world: World,
  body: RigidBody,
  botX: number,
  botY: number,
  botZ: number,
  routeSteer: BotRouteSteerCache,
  intent: BotBrainIntent,
  stuckFrames: number,
  priorMoveYaw?: number
): void {
  if (intent.state === 'fight' || intent.chaseTarget === null || stuckFrames > 0) {
    return;
  }

  routeSteer.fillStuckInput(
    world,
    body,
    botX,
    botY,
    botZ,
    intent.chaseTarget.x,
    intent.chaseTarget.z,
    priorMoveYaw
  );
  routeSteer.updateInPlace();
}


export function tickBotNavigationFrame(
  world: World,
  body: RigidBody,
  botX: number,
  botY: number,
  botZ: number,
  faction: FactionTeam,
  stuckFrames: number,
  navCache: BotNavigationCache,
  frameDeltaSeconds: number,
  intent: BotBrainIntent
): void {
  if (intent.state === 'fight' || intent.chaseTarget === null || stuckFrames <= 0) {
    return;
  }

  navCache.fillStuckInput(
    world,
    body,
    botX,
    botY,
    botZ,
    faction,
    intent.chaseTarget.x,
    intent.chaseTarget.z,
    stuckFrames
  );
  navCache.updateInPlace(frameDeltaSeconds);
}


export function fillDriveFromBrainIntent(
  botX: number,
  botZ: number,
  intent: BotBrainIntent,
  navCache: BotNavigationCache,
  routeSteer: BotRouteSteerCache,
  stuckFrames: number,
  out: MutableBotDriveCommand
): boolean {
  if (intent.state === 'fight' || intent.chaseTarget === null) {
    if (intent.state !== 'fight') {
      return false;
    }

    fillIdleDrive(
      out,
      intent.aimYaw,
      intent.aimYaw,
      intent.chaseTarget?.x ?? botX,
      intent.chaseTarget?.z ?? botZ,
      false
    );
    return true;
  }

  const chaseGoalX = intent.chaseTarget.x;
  const chaseGoalZ = intent.chaseTarget.z;

  if (stuckFrames > 0) {
    const nav = navCache.peek();
    const faceYaw = resolveChaseFaceYaw(intent, nav.moveYaw);
    fillChaseDrive(
      botX,
      botZ,
      nav.x,
      nav.z,
      faceYaw,
      nav.moveYaw,
      true,
      chaseGoalX,
      chaseGoalZ,
      out,
      true
    );
    return true;
  }

  const steer = routeSteer.peek();
  const movementFaceYaw = steer.steering
    ? steer.moveYaw
    : Math.atan2(chaseGoalX - botX, chaseGoalZ - botZ);
  const faceYaw = resolveChaseFaceYaw(intent, movementFaceYaw);

  if (steer.steering) {
    fillChaseDrive(
      botX,
      botZ,
      steer.steerX,
      steer.steerZ,
      faceYaw,
      steer.moveYaw,
      true,
      chaseGoalX,
      chaseGoalZ,
      out,
      true
    );
    return true;
  }

  const directMoveYaw = Math.atan2(chaseGoalX - botX, chaseGoalZ - botZ);
  fillChaseDrive(
    botX,
    botZ,
    chaseGoalX,
    chaseGoalZ,
    faceYaw,
    directMoveYaw,
    true,
    chaseGoalX,
    chaseGoalZ,
    out,
    false
  );
  return true;
}

export function planarSpeedTargetFromCommand(command: BotDriveCommand): number {
  if (!command.moving) {
    return 0;
  }

  return planarSpeedFromInput(command.movement, { sprint: command.sprint, crouch: false });
}
