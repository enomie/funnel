import type { KinematicCharacterController } from '@dimforge/rapier3d-simd-compat';

/** Skin gap — Rapier recommends non-zero for stable sliding (was 0 on player). */
const CONTROLLER_OFFSET_M = 0.02;

/** Max automatic step-up (m). ~1 m podium lips still need a jump. */
const AUTOSTEP_MAX_HEIGHT_M = 0.55;
/** Min flat depth on the step top after autostep (m). */
const AUTOSTEP_MIN_WIDTH_M = 0.24;

const MAX_SLOPE_CLIMB_RAD = (50 * Math.PI) / 180;

export function createHumanoidCharacterController(
  world: { createCharacterController: (offset: number) => KinematicCharacterController }
): KinematicCharacterController {
  const controller = world.createCharacterController(CONTROLLER_OFFSET_M);
  configureHumanoidCharacterController(controller);
  return controller;
}

export function configureHumanoidCharacterController(
  controller: KinematicCharacterController
): void {
  controller.setMaxSlopeClimbAngle(MAX_SLOPE_CLIMB_RAD);
  controller.enableAutostep(AUTOSTEP_MAX_HEIGHT_M, AUTOSTEP_MIN_WIDTH_M, true);
}
