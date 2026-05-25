// Path: /Users/johann/MyBrew/funnel-real/src/player/character-controller-setup.ts

import type { KinematicCharacterController } from '@dimforge/rapier3d-simd-compat';


const CONTROLLER_OFFSET_M = 0.02;


const AUTOSTEP_MAX_HEIGHT_M = 0.55;

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
