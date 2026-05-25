// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-mobility.ts

import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  JUMP_ARM_CLEAR_M,
  probeBodyCastAhead,
  vaultLandingHeadroomClear
} from './bot-body-probe';
import { computeJumpImpulse, upwardVelocityForApex, type JumpStyle } from '../player/player-jump';
import type { BotDriveCommand } from './bot-chase-drive';


const BOT_STEP_JUMP_COOLDOWN_MS = 420;

export const BOT_VAULT_FAIL_LIMIT = 2;

export const BOT_JUMP_BAN_MS = 2800;


const BOT_VAULT_APEX_M = 3.45;
const BOT_VAULT_FORWARD_MPS = 2.8;
const BOT_VAULT_RETAIN = 0.4;


export const BOT_VAULT_PROGRESS_MIN_M = 0.55;

export interface BotJumpDecision {
  readonly shouldJump: boolean;
  readonly jumpStyle: JumpStyle;
}

export interface BotJumpProbeResult extends BotJumpDecision {
  
  readonly rearmVault: boolean;
}

export type MutableBotJumpProbeResult = {
  shouldJump: boolean;
  jumpStyle: JumpStyle;
  rearmVault: boolean;
};

export interface BotJumpGate {
  readonly vaultFailures: number;
  readonly jumpBannedUntilMs: number;
  readonly vaultArmed: boolean;
}


function fillIdleJump(out: MutableBotJumpProbeResult): void {
  out.shouldJump = false;
  out.jumpStyle = 'idle';
  out.rearmVault = false;
}

export function fillBotJumpDecision(
  world: World,
  body: RigidBody,
  grounded: boolean,
  lastJumpAtMs: number,
  nowMs: number,
  drive: BotDriveCommand | null,
  gate: BotJumpGate,
  out: MutableBotJumpProbeResult
): void {
  if (!grounded || drive === null || !drive.moving) {
    fillIdleJump(out);
    return;
  }

  if (nowMs < gate.jumpBannedUntilMs) {
    fillIdleJump(out);
    return;
  }

  if (gate.vaultFailures >= BOT_VAULT_FAIL_LIMIT) {
    fillIdleJump(out);
    return;
  }

  if (nowMs < lastJumpAtMs + BOT_STEP_JUMP_COOLDOWN_MS) {
    fillIdleJump(out);
    return;
  }

  const pos = body.translation();
  const dirX = Math.sin(drive.moveYaw);
  const dirZ = Math.cos(drive.moveYaw);
  const cast = probeBodyCastAhead(world, body, pos.x, pos.y, pos.z, dirX, dirZ);

  if (cast.clearanceM >= JUMP_ARM_CLEAR_M) {
    out.shouldJump = false;
    out.jumpStyle = 'idle';
    out.rearmVault = true;
    return;
  }

  if (!gate.vaultArmed || !cast.vaultObstacle) {
    fillIdleJump(out);
    return;
  }

  if (!vaultLandingHeadroomClear(world, body, pos.x, pos.y, pos.z, dirX, dirZ)) {
    fillIdleJump(out);
    return;
  }

  out.shouldJump = true;
  out.jumpStyle = drive.sprint ? 'run' : 'walk';
  out.rearmVault = false;
}


export function resolveBotJumpDecision(
  world: World,
  body: RigidBody,
  grounded: boolean,
  lastJumpAtMs: number,
  nowMs: number,
  drive: BotDriveCommand | null,
  gate: BotJumpGate
): BotJumpProbeResult {
  const scratch: MutableBotJumpProbeResult = {
    shouldJump: false,
    jumpStyle: 'idle',
    rearmVault: false
  };
  fillBotJumpDecision(world, body, grounded, lastJumpAtMs, nowMs, drive, gate, scratch);
  return scratch;
}

export function applyBotVaultImpulse(
  drive: BotDriveCommand,
  linvel: { x: number; y: number; z: number }
) {
  if (drive.sprint) {
    return computeJumpImpulse({
      movement: drive.movement,
      yaw: drive.moveYaw,
      sprint: true,
      crouch: false,
      linvel
    });
  }

  const dirX = Math.sin(drive.moveYaw);
  const dirZ = Math.cos(drive.moveYaw);
  const along = linvel.x * dirX + linvel.z * dirZ;
  const forward = Math.max(along, 0) * BOT_VAULT_RETAIN + BOT_VAULT_FORWARD_MPS;

  return {
    x: dirX * forward,
    y: upwardVelocityForApex(BOT_VAULT_APEX_M),
    z: dirZ * forward,
    style: 'walk' as JumpStyle
  };
}


export function vaultProgressM(
  moveYaw: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): number {
  const dirX = Math.sin(moveYaw);
  const dirZ = Math.cos(moveYaw);
  return (toX - fromX) * dirX + (toZ - fromZ) * dirZ;
}

export function lerpAngleRad(current: number, target: number, alpha: number): number {
  let delta = target - current;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return current + delta * alpha;
}
