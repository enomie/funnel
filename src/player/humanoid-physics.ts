// Path: /Users/johann/MyBrew/funnel-real/src/player/humanoid-physics.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World
} from '@dimforge/rapier3d-simd-compat';
import { PLAYER_CONFIG } from '../config/game-config';
import {
  ACTOR_COLLISION_GROUPS,
  ACTOR_RAY_QUERY_GROUPS
} from '../physics/collision-groups';
import { stanceHalfHeight } from './player-stance';


export const HUMANOID_GROUND_RAY_EXTRA_M = 0.18;

const CAPSULE_FRICTION = 1.15;
const CAPSULE_RESTITUTION = 0;
const CAPSULE_MASS = 1;

export interface HumanoidRapierBody {
  readonly body: RigidBody;
  readonly collider: Collider;
}

export interface CreateHumanoidRapierBodyOptions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  
  readonly contactForceEvents?: boolean;
}

export function createHumanoidRapierBody(
  world: World,
  options: CreateHumanoidRapierBodyOptions
): HumanoidRapierBody {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(options.x, options.y, options.z)
      .lockRotations()
      .setLinearDamping(0)
  );

  const standDesc = RAPIER.ColliderDesc.capsule(stanceHalfHeight(false), PLAYER_CONFIG.radius)
    .setFriction(CAPSULE_FRICTION)
    .setRestitution(CAPSULE_RESTITUTION)
    .setMass(CAPSULE_MASS);

  if (options.contactForceEvents === true) {
    standDesc.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
  }

  standDesc.setCollisionGroups(ACTOR_COLLISION_GROUPS);

  const collider = world.createCollider(standDesc, body);

  return { body, collider };
}

export interface DisposeHumanoidRapierBodyOptions extends HumanoidRapierBody {
  readonly characterController: KinematicCharacterController;
}


export function disposeHumanoidRapierBody(
  world: World,
  options: DisposeHumanoidRapierBodyOptions
): void {
  world.removeCharacterController(options.characterController);
  world.removeCollider(options.collider, true);
  world.removeRigidBody(options.body);
}

let _groundProbeRay: RAPIER.Ray | null = null;

function groundProbeRay(originX: number, originY: number, originZ: number): RAPIER.Ray {
  if (_groundProbeRay === null) {
    _groundProbeRay = new RAPIER.Ray({ x: originX, y: originY, z: originZ }, { x: 0, y: -1, z: 0 });
    return _groundProbeRay;
  }

  _groundProbeRay.origin.x = originX;
  _groundProbeRay.origin.y = originY;
  _groundProbeRay.origin.z = originZ;
  return _groundProbeRay;
}


export function probeHumanoidGrounded(
  world: World,
  body: RigidBody,
  crouching: boolean,
  extraDistance = 0
): boolean {
  const position = body.translation();
  const ray = groundProbeRay(position.x, position.y, position.z);
  const maxToi =
    stanceHalfHeight(crouching) + PLAYER_CONFIG.radius + HUMANOID_GROUND_RAY_EXTRA_M + extraDistance;
  const hit = world.castRay(
    ray,
    maxToi,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    body
  );
  return hit !== null && hit.timeOfImpact <= maxToi;
}

export interface HumanoidPlanarStepParams {
  readonly body: RigidBody;
  readonly collider: Collider;
  readonly controller: KinematicCharacterController;
  readonly planarVelocityX: number;
  readonly planarVelocityZ: number;
  readonly fixedStep: number;
}

export interface HumanoidPlanarStepResult {
  readonly correctedX: number;
  readonly correctedZ: number;
}

const _planarStepScratch = { correctedX: 0, correctedZ: 0 };


export function fillHumanoidPlanarStep(
  params: HumanoidPlanarStepParams,
  out: { correctedX: number; correctedZ: number } = _planarStepScratch
): HumanoidPlanarStepResult {
  const { body, collider, controller, planarVelocityX, planarVelocityZ, fixedStep } = params;
  const velocity = body.linvel();

  body.setLinvel({ x: planarVelocityX, y: velocity.y, z: planarVelocityZ }, true);
  
  controller.computeColliderMovement(
    collider,
    {
      x: planarVelocityX * fixedStep,
      y: velocity.y * fixedStep,
      z: planarVelocityZ * fixedStep
    },
    undefined,
    ACTOR_COLLISION_GROUPS
  );

  const correctedMovement = controller.computedMovement();
  if (fixedStep > 0) {
    body.setLinvel(
      {
        x: correctedMovement.x / fixedStep,
        y: correctedMovement.y / fixedStep,
        z: correctedMovement.z / fixedStep
      },
      true
    );
  }

  out.correctedX = correctedMovement.x;
  out.correctedZ = correctedMovement.z;
  return out;
}


export function applyHumanoidPlanarStep(params: HumanoidPlanarStepParams): HumanoidPlanarStepResult {
  return fillHumanoidPlanarStep(params, { correctedX: 0, correctedZ: 0 });
}
