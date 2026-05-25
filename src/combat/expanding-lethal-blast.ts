// Path: /Users/johann/MyBrew/funnel-real/src/combat/expanding-lethal-blast.ts

import type { Collider } from '@dimforge/rapier3d-simd-compat';
import { Vector3 } from 'three/webgpu';
import type { ApplyImpactDeps } from './apply-impact';
import {
  killActorFromBlastDirectHit,
  tickExpandingLethalBlast,
  type ExpandingLethalBlastTick
} from './apply-impact';
import type { FactionTeam } from './teams';
import type { ProjectileVisualKind } from './weapon-definitions';


export interface ExpandingLethalBlast {
  readonly center: Vector3;
  readonly maxRadius: number;
  readonly expandMs: number;
  readonly spawnedAtMs: number;
  readonly killedActorIds: Set<string>;
  readonly sourceFaction: FactionTeam;
  readonly sourceActorId?: string;
  readonly sourceWeaponVisualKind?: ProjectileVisualKind;
  readonly friendlyFire: boolean;
  lastSweepMs: number;
  audioSlot: number | null;
}

export function spawnExpandingLethalBlast(
  center: Vector3,
  maxRadius: number,
  expandMs: number,
  sourceFaction: FactionTeam,
  sourceActorId: string | undefined,
  sourceWeaponVisualKind: ProjectileVisualKind | undefined,
  friendlyFire: boolean,
  nowMs: number,
  hitCollider?: Collider,
  impactDeps?: ApplyImpactDeps
): ExpandingLethalBlast {
  const blast: ExpandingLethalBlast = {
    center: center.clone(),
    maxRadius,
    expandMs,
    spawnedAtMs: nowMs,
    killedActorIds: new Set<string>(),
    sourceFaction,
    sourceActorId,
    sourceWeaponVisualKind,
    friendlyFire,
    lastSweepMs: 0,
    audioSlot: null
  };

  if (impactDeps !== undefined && hitCollider !== undefined) {
    killActorFromBlastDirectHit(
      impactDeps,
      sourceFaction,
      sourceActorId,
      sourceWeaponVisualKind,
      hitCollider,
      blast.killedActorIds,
      friendlyFire,
      nowMs
    );
  }

  return blast;
}

export function expandingLethalBlastProgress(blast: ExpandingLethalBlast, nowMs: number): number {
  return Math.min(1, (nowMs - blast.spawnedAtMs) / blast.expandMs);
}

export function tickExpandingLethalBlastEffect(
  blast: ExpandingLethalBlast,
  nowMs: number,
  impactDeps: ApplyImpactDeps
): boolean {
  const progress = expandingLethalBlastProgress(blast, nowMs);
  const currentRadius = blast.maxRadius * progress;
  const tick: ExpandingLethalBlastTick = {
    sourceFaction: blast.sourceFaction,
    sourceActorId: blast.sourceActorId,
    sourceWeaponVisualKind: blast.sourceWeaponVisualKind,
    center: blast.center,
    currentRadius,
    killedActorIds: blast.killedActorIds,
    friendlyFire: blast.friendlyFire,
    lastSweepMs: blast.lastSweepMs
  };
  tickExpandingLethalBlast(impactDeps, tick, nowMs);
  blast.lastSweepMs = tick.lastSweepMs;
  return progress >= 1;
}
