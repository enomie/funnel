// Path: /Users/johann/MyBrew/funnel-real/src/physics/rapier-world.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { EventQueue, World } from '@dimforge/rapier3d-simd-compat';
import { PHYSICS_CONFIG } from '../config/game-config';

export interface RapierRuntime {
  world: World;
  eventQueue: EventQueue;
}

export async function createRapierRuntime(): Promise<RapierRuntime> {
  await RAPIER.init();

  const world = new RAPIER.World(PHYSICS_CONFIG.gravity);
  world.timestep = PHYSICS_CONFIG.fixedStep;

  return {
    world,
    eventQueue: new RAPIER.EventQueue(true)
  };
}
