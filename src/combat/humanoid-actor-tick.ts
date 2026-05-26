// Path: /Users/johann/MyBrew/funnel-real/src/combat/humanoid-actor-tick.ts

import type { Vector3 } from 'three/webgpu';
import type { LocomotionAnimInput } from '../player/locomotion-anim-controller';
import type { WeaponArsenal } from './weapon-arsenal';

export interface HumanoidCombatSuspendState {
  active: boolean;
}

export interface HumanoidRenderTickContext {
  readonly isDead: boolean;
  readonly nowMs: number;
  readonly deltaSeconds: number;
  readonly syncDeathState: () => void;
  readonly pinBeforeRender?: () => void;
  readonly syncVisualFromBody: () => void;
  readonly updateLocomotion: (deltaSeconds: number, input: LocomotionAnimInput, nowMs: number) => void;
  readonly weapon: WeaponArsenal;
  readonly weaponAim: { readonly yaw: number; readonly pitch: number };
  readonly weaponBodyPosition: Vector3;
  readonly suspendState: HumanoidCombatSuspendState;
  readonly afterDeathSync?: (nowMs: number) => void;
  readonly afterLocomotion?: () => void;
  readonly onRevive?: () => void;
}


export function tickHumanoidRenderFrame(
  context: HumanoidRenderTickContext,
  locomotionInput: LocomotionAnimInput
): void {
  const { isDead, nowMs, deltaSeconds, weapon, suspendState } = context;
  const wasSuspended = suspendState.active;

  if (isDead) {
    if (!wasSuspended) {
      suspendState.active = true;
    }
  } else {
    if (wasSuspended) {
      context.onRevive?.();
    }
    suspendState.active = false;
  }

  context.pinBeforeRender?.();
  context.syncDeathState();
  context.afterDeathSync?.(nowMs);

  locomotionInput.fireStarted = weapon.consumeFireStarted();
  context.updateLocomotion(deltaSeconds, locomotionInput, nowMs);
  context.afterLocomotion?.();
  context.syncVisualFromBody();
}
