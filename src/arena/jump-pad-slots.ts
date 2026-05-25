// Path: /Users/johann/MyBrew/funnel-real/src/arena/jump-pad-slots.ts

import type { FactionTeam } from '../combat/teams';
import { TEAM_ZONE_PODIUM_HEIGHT_M, teamZonePodiumSlots } from './team-zone-podiums';

export const JUMP_PAD_SIZE_M = 3;
export const JUMP_PAD_HEIGHT_M = 1;
export const JUMP_PAD_HALF_M = JUMP_PAD_SIZE_M * 0.5;
export const JUMP_PAD_HALF_HEIGHT = JUMP_PAD_HEIGHT_M * 0.5;

export const JUMP_PAD_CENTER_Y = TEAM_ZONE_PODIUM_HEIGHT_M + JUMP_PAD_HALF_HEIGHT;

export interface JumpPadSlot {
  readonly faction: FactionTeam;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function buildJumpPadWorldSlots(): readonly JumpPadSlot[] {
  const slots: JumpPadSlot[] = [];
  for (const faction of ['alpha', 'beta'] as const) {
    for (const podium of teamZonePodiumSlots(faction)) {
      slots.push({
        faction,
        x: podium.x,
        y: JUMP_PAD_CENTER_Y,
        z: podium.z
      });
    }
  }
  return slots;
}

export const JUMP_PAD_WORLD_SLOTS: readonly JumpPadSlot[] = buildJumpPadWorldSlots();
export const JUMP_PAD_COUNT = JUMP_PAD_WORLD_SLOTS.length;
