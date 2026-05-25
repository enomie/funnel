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
  readonly syncVisualFromBody: () => void;
  readonly updateLocomotion: (deltaSeconds: number, input: LocomotionAnimInput) => void;
  readonly weapon: WeaponArsenal;
  readonly weaponAim: { readonly yaw: number; readonly pitch: number };
  readonly weaponBodyPosition: Vector3;
  readonly suspendState: HumanoidCombatSuspendState;
  readonly afterDeathSync?: (nowMs: number) => void;
  readonly onRevive?: () => void;
}

/** Death → weapon suspend/update → visual root → locomotion — once per frame after `world.step`. */
export function tickHumanoidRenderFrame(
  context: HumanoidRenderTickContext,
  locomotionInput: LocomotionAnimInput
): void {
  const { isDead, nowMs, deltaSeconds, weapon, suspendState } = context;
  const wasSuspended = suspendState.active;

  if (isDead) {
    if (!wasSuspended) {
      weapon.suspendCombat();
      suspendState.active = true;
    }
  } else {
    if (wasSuspended) {
      context.onRevive?.();
    }
    suspendState.active = false;
  }

  context.syncDeathState();
  context.afterDeathSync?.(nowMs);

  context.syncVisualFromBody();

  locomotionInput.fireStarted = weapon.consumeFireStarted();
  context.updateLocomotion(deltaSeconds, locomotionInput);
}
