import type { World } from '@dimforge/rapier3d-simd-compat';
import type { FactionTeam } from '../combat/teams';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentRamp } from './environment-cube';
import {
  TEAM_ZONE_PODIUM_HALF_M,
  TEAM_ZONE_PODIUM_HEIGHT_M,
  teamZonePodiumSlots
} from './team-zone-podiums';

/** Matches podium footprint — bulkhead-side access ramp per team flank pad. */
export const TEAM_ZONE_PODIUM_RAMP_WIDTH_M = 5;
export const TEAM_ZONE_PODIUM_RAMP_DEPTH_M = 5;
export const TEAM_ZONE_PODIUM_RAMP_HEIGHT_M = TEAM_ZONE_PODIUM_HEIGHT_M;

const RAMP_CENTER_Y = TEAM_ZONE_PODIUM_RAMP_HEIGHT_M * 0.5;

interface TeamZonePodiumRampSlot {
  readonly faction: FactionTeam;
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
}

function teamZonePodiumRampSlots(): readonly TeamZonePodiumRampSlot[] {
  const slots: TeamZonePodiumRampSlot[] = [];
  const bulkheadOffset = TEAM_ZONE_PODIUM_HALF_M + TEAM_ZONE_PODIUM_RAMP_DEPTH_M * 0.5;

  for (const podium of teamZonePodiumSlots('alpha')) {
    slots.push({
      faction: 'alpha',
      x: podium.x,
      z: podium.z - bulkheadOffset,
      rotationY: Math.PI
    });
  }

  for (const podium of teamZonePodiumSlots('beta')) {
    slots.push({
      faction: 'beta',
      x: podium.x,
      z: podium.z + bulkheadOffset,
      rotationY: 0
    });
  }

  return slots;
}

/** 5×5×1 m ramps on the neutral-opposed face of each team podium. */
export function createTeamZonePodiumRamps(instances: ArenaStaticInstances, world: World): void {
  const rampSize: [number, number, number] = [
    TEAM_ZONE_PODIUM_RAMP_WIDTH_M,
    TEAM_ZONE_PODIUM_RAMP_HEIGHT_M,
    TEAM_ZONE_PODIUM_RAMP_DEPTH_M
  ];

  for (const slot of teamZonePodiumRampSlots()) {
    addFixedEnvironmentRamp(
      instances,
      world,
      [slot.x, RAMP_CENTER_Y, slot.z],
      rampSize,
      slot.faction,
      slot.rotationY
    );
  }
}
