// Path: /Users/johann/MyBrew/funnel-real/src/player/player-controller.ts

import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  TempContactForceEvent,
  World
} from '@dimforge/rapier3d-simd-compat';
import { Vector3 } from 'three/webgpu';
import type { WeaponArsenal } from '../combat/weapon-arsenal';
import {
  tickHumanoidRenderFrame,
  type HumanoidCombatSuspendState,
  type HumanoidRenderTickContext
} from '../combat/humanoid-actor-tick';
import type { FactionTeam } from '../combat/teams';
import type { InputSnapshot } from '../input/input-state';
import { IDLE_INPUT_SNAPSHOT } from '../input/input-state';
import { syncHumanoidVisualRootAt } from '../physics/synced-body';
import {
  fillHumanoidRenderTranslation,
  fillInterpolatedBodyTranslation,
  PhysicsTranslationInterpolator
} from '../physics/physics-interpolation';
import { PlayerHealth } from './player-health';
import { FootstepController, type MutableFootstepFrameInput } from './footstep-controller';
import { createHumanoidCharacterController } from './character-controller-setup';
import {
  fillHumanoidPlanarStep,
  createHumanoidRapierBody,
  probeHumanoidGrounded
} from './humanoid-physics';
import {
  applyCapsuleMode,
  inferGroundYFromBody,
  pinBodyCapsuleToGround,
  resolveCapsuleMode,
  transitionCapsuleOnGround,
  type HumanoidCapsuleMode
} from './humanoid-capsule-sync';
import { computeJumpImpulse, createJumpAirThrustState, applyJumpAirThrust, type JumpAirThrustState, type JumpStyle, type JumpImpulseResult } from './player-jump';
import {
  beginReviveInPlacePhysics,
  createActorDeathSnapshot,
  finishReviveInPlacePhysics,
  maintainReviveStandUpPhysics,
  resetActorDeathPhysics,
  syncActorDeathState,
  type ActorDeathSnapshot,
  type HumanoidGroundAnchor
} from './actor-death';
import { defaultPlayerSpawnPosition, playerFactionSpawnPosition, playerMatchStartDropPosition } from './player-spawn';
import {
  canEnterCrouch,
  shouldExitCrouch,
  snapRigidBodyToGround
} from './player-stance';
import { planarSpeedFromInput, fillPlanarVelocityFromInput } from './player-movement-speed';
import { buildLocomotionAnimInputInto } from './locomotion-anim-controller';
import type { LocomotionAnimInput, PlayerVisual } from './player-visual';

const JUMP_BUFFER_MS = 180;
const JUMP_COYOTE_MS = 120;
const AIRBORNE_GRACE_MS = 280;
export interface PlayerFrame {
  position: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  airborne: boolean;
  firstPersonView: boolean;
  isDead: boolean;
  health: number;
  shield: number;
  isRegenerating: boolean;
  crouching: boolean;
}

export class PlayerController {
  readonly body: RigidBody;
  readonly collider: Collider;
  readonly visual: PlayerVisual;
  readonly health: PlayerHealth;
  readonly #world: World;
  readonly #characterController: KinematicCharacterController;
  readonly #footsteps = new FootstepController();
  #grounded = false;
  #airborne = false;
  #lastJumpAt = -Infinity;
  #lastJumpPressedAt = -Infinity;
  #jumpGraceUntil = 0;
  #coyoteUntil = 0;
  #isJump = false;
  #isCrouch = false;
  #isSliding = false;
  #pinnedGroundY: number | null = null;
  #movementLocked = false;
  #reviveAnchor: HumanoidGroundAnchor | null = null;
  #frameNow = 0;
  #lastJumpStyle: JumpStyle = 'idle';
  #jumpAirThrust: JumpAirThrustState | null = null;
  #wasAirbornePrev = false;
  #leftAirborneVoluntarily = false;
  readonly #death = createActorDeathSnapshot();
  readonly #combatSuspend: HumanoidCombatSuspendState = { active: false };
  readonly #weaponBodyPosition = new Vector3();
  readonly #framePosition = new Vector3();
  readonly #weaponAimScratch = { yaw: 0, pitch: 0 };
  readonly #frameScratch: PlayerFrame = {
    position: this.#framePosition,
    yaw: 0,
    pitch: 0,
    grounded: false,
    airborne: false,
    firstPersonView: false,
    isDead: false,
    health: 0,
    shield: 0,
    isRegenerating: false,
    crouching: false
  };
  readonly #humanoidTickContext: {
    isDead: boolean;
    nowMs: number;
    deltaSeconds: number;
    syncDeathState: () => void;
    pinBeforeRender?: () => void;
    syncVisualFromBody: () => void;
    updateLocomotion: (deltaSeconds: number, input: LocomotionAnimInput, nowMs: number) => void;
    weapon: WeaponArsenal;
    weaponAim: { yaw: number; pitch: number };
    weaponBodyPosition: Vector3;
    suspendState: HumanoidCombatSuspendState;
    afterLocomotion?: () => void;
    onRevive?: () => void;
  };
  readonly #locomotionScratch: LocomotionAnimInput = {
    movement: { forward: false, back: false, left: false, right: false },
    sprint: false,
    grounded: false,
    airborne: false,
    crouch: false,
    sliding: false,
    fireStarted: false,
    isDead: false,
    planarSpeedBody: 0,
    planarSpeedTarget: 0,
    jumpStyle: 'idle',
    landedFromAir: false
  };
  readonly #footstepFrameScratch: MutableFootstepFrameInput = {
    grounded: false,
    landedFromAir: false,
    landImpactMps: 0,
    isDead: false,
    sprint: false,
    crouch: false,
    position: { x: 0, y: 0, z: 0 },
    planarSpeedBody: 0,
    planarSpeedTarget: 0,
    locomotionClipId: '',
    rigId: undefined
  };
  readonly #planarWishScratch = { x: 0, z: 0 };
  readonly #translationInterp = new PhysicsTranslationInterpolator();
  readonly #renderTranslationScratch = { x: 0, y: 0, z: 0 };
  #renderInterpolationBlend = 1;
  #capsuleMode: HumanoidCapsuleMode | null = null;
  constructor(world: World, visual: PlayerVisual) {
    this.#world = world;
    this.visual = visual;
    this.health = new PlayerHealth();
    this.#characterController = createHumanoidCharacterController(world);

    const spawn = defaultPlayerSpawnPosition();
    const humanoid = createHumanoidRapierBody(world, {
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      contactForceEvents: true
    });
    this.body = humanoid.body;
    this.collider = humanoid.collider;
    this.#translationInterp.seedFromBody(this.body);
    this.#humanoidTickContext = {
      isDead: false,
      nowMs: 0,
      deltaSeconds: 0,
      syncDeathState: this.#syncDeathStateBound,
      pinBeforeRender: this.#pinReviveBeforeRenderBound,
      syncVisualFromBody: this.#syncVisualFromBodyBound,
      updateLocomotion: this.#updateLocomotionBound,
      weapon: null as unknown as WeaponArsenal,
      weaponAim: this.#weaponAimScratch,
      weaponBodyPosition: this.#weaponBodyPosition,
      suspendState: this.#combatSuspend,
      afterLocomotion: this.#finishReviveStandUpIfDoneBound
    };
  }

  get deathSnapshot(): ActorDeathSnapshot {
    return this.#death;
  }

  get reviveStandUpPending(): boolean {
    return this.#reviveAnchor !== null;
  }

  applyDeathCommit(nowMs: number): void {
    this.#syncDeathState(this.#lastInputSnapshot, nowMs);
  }

  setRenderInterpolationBlend(blend: number): void {
    this.#renderInterpolationBlend = blend;
  }

  capturePhysicsInterpolation(): void {
    if (this.health.isDead || this.#reviveAnchor !== null) {
      return;
    }

    this.#translationInterp.captureAfterPhysicsStep(this.body);
  }

  reseedPhysicsInterpolation(): void {
    this.#translationInterp.seedFromBody(this.body);
  }

  
  beginFrame(input: InputSnapshot, nowMs: number): void {
    this.#lastInputSnapshot = input;
    this.#frameNow = nowMs;
    this.#applyDevLifeKeys(input);

    if (this.health.isDead) {
      return;
    }

    if (this.#reviveAnchor !== null) {
      return;
    }

    this.#reconcileGrounded(this.#frameNow);
    this.#applyKeyEdges(input, this.#frameNow);
    this.#applyJumpImpulse(this.#frameNow, input);
  }

  
  fixedUpdate(fixedStep: number, input: InputSnapshot): void {
    if (this.health.isDead || this.#reviveAnchor !== null) {
      return;
    }

    this.#applyMovement(fixedStep, input);
  }

  
  afterPhysics(): void {
    if (this.health.isDead) {
      return;
    }

    if (this.#reviveAnchor !== null) {
      return;
    }

    this.#reconcileGrounded(this.#frameNow);
  }

  finishFrame(
    deltaSeconds: number,
    input: InputSnapshot,
    weapon: WeaponArsenal,
    onRevive?: () => void
  ): PlayerFrame {
    const now = this.#frameNow;
    this.#airborne = !this.#grounded || now < this.#jumpGraceUntil;

    const velocity = this.body.linvel();
    const landedFromAir =
      !this.health.isDead &&
      this.#grounded &&
      !this.#airborne &&
      this.#wasAirbornePrev &&
      this.#leftAirborneVoluntarily;
    const landImpactMps = Math.abs(Math.min(0, velocity.y));

    if (landedFromAir) {
      this.#leftAirborneVoluntarily = false;
    }

    const translation = this.body.translation();
    this.#weaponBodyPosition.set(translation.x, translation.y, translation.z);
    this.#fillLocomotionInput(input, landedFromAir, this.#locomotionScratch);

    const tickContext = this.#humanoidTickContext;
    tickContext.isDead = this.health.isDead;
    tickContext.nowMs = now;
    tickContext.deltaSeconds = deltaSeconds;
    tickContext.weapon = weapon;
    tickContext.weaponAim.yaw = input.yaw;
    tickContext.weaponAim.pitch = input.pitch;
    tickContext.onRevive = onRevive;
    tickHumanoidRenderFrame(tickContext as HumanoidRenderTickContext, this.#locomotionScratch);

    fillHumanoidRenderTranslation(
      this.#translationInterp,
      this.#renderInterpolationBlend,
      this.body,
      this.#skipRenderInterpolation(),
      this.#renderTranslationScratch
    );

    const footInput = this.#footstepFrameScratch;
    footInput.grounded = this.#grounded && !this.#airborne;
    footInput.landedFromAir = landedFromAir;
    footInput.landImpactMps = landImpactMps;
    footInput.isDead = this.health.isDead;
    footInput.sprint = this.#locomotionScratch.sprint;
    footInput.crouch = this.#locomotionScratch.crouch;
    footInput.position.x = this.#renderTranslationScratch.x;
    footInput.position.y = this.#renderTranslationScratch.y;
    footInput.position.z = this.#renderTranslationScratch.z;
    footInput.planarSpeedBody = this.#locomotionScratch.planarSpeedBody;
    footInput.planarSpeedTarget = this.#locomotionScratch.planarSpeedTarget;
    footInput.locomotionClipId = this.visual.locomotionClipId;
    footInput.rigId = this.visual.rigId;
    this.#footsteps.update(footInput);
    this.#wasAirbornePrev = this.#airborne;

    this.#framePosition.set(
      this.#renderTranslationScratch.x,
      this.#renderTranslationScratch.y,
      this.#renderTranslationScratch.z
    );
    if (this.health.isDead || this.#reviveAnchor !== null) {
      weapon.prepareWorldTickContext(undefined);
    } else {
      this.#weaponAimScratch.yaw = input.yaw;
      this.#weaponAimScratch.pitch = input.pitch;
      weapon.prepareWorldTickContext(this.#weaponAimScratch);
    }

    const frame = this.#frameScratch;
    frame.yaw = input.yaw;
    frame.pitch = input.pitch;
    frame.grounded = this.#grounded;
    frame.airborne = this.#airborne;
    frame.firstPersonView = input.firstPersonView;
    frame.isDead = this.health.isDead;
    frame.health = this.health.health;
    frame.shield = this.health.shield;
    frame.isRegenerating = this.health.isRegeneratingAt(now);
    frame.crouching = this.#isCrouch;
    return frame;
  }

  handleContactForceEvent(event: TempContactForceEvent, nowMs: number): void {
    const handle1 = event.collider1();
    const handle2 = event.collider2();
    if (handle1 !== this.collider.handle && handle2 !== this.collider.handle) {
      return;
    }

    if (Math.abs(event.totalForce().y) > 1 && nowMs > this.#lastJumpAt + 100) {
      this.#grounded = true;
      this.#coyoteUntil = nowMs + JUMP_COYOTE_MS;
    }
  }

  position(): Vector3 {
    const t = this.body.translation();
    return new Vector3(t.x, t.y, t.z);
  }

  setMovementLocked(locked: boolean): void {
    this.#movementLocked = locked;
  }

  
  launchFromJumpPad(impulse: JumpImpulseResult, nowMs: number): void {
    if (this.health.isDead || this.#movementLocked || this.#reviveAnchor !== null) {
      return;
    }

    this.#lastJumpAt = nowMs;
    this.#grounded = false;
    this.#coyoteUntil = 0;
    this.#jumpGraceUntil = nowMs + AIRBORNE_GRACE_MS;
    this.#leftAirborneVoluntarily = true;
    this.#lastJumpStyle = impulse.style;
    this.#jumpAirThrust = null;
    this.body.setLinvel({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    fillInterpolatedBodyTranslation(
      this.#translationInterp,
      1,
      this.#renderTranslationScratch
    );
    this.#footsteps.playJumpAt(this.#renderTranslationScratch, this.visual.rigId);
  }

  
  beginMatchStartDrop(faction: FactionTeam): void {
    const spawn = playerMatchStartDropPosition(faction);
    this.body.setTranslation(spawn, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.#grounded = false;
    this.#airborne = true;
    this.#wasAirbornePrev = false;
    this.#leftAirborneVoluntarily = false;
    this.#jumpGraceUntil = 0;
    this.#coyoteUntil = 0;
    this.#pinnedGroundY = null;
    this.#jumpAirThrust = null;
    this.reseedPhysicsInterpolation();
  }

  
  spawnAtFaction(faction: FactionTeam): void {
    const spawn = playerFactionSpawnPosition(faction);
    this.body.setTranslation(spawn, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.#grounded = true;
    this.#airborne = false;
    this.#jumpGraceUntil = 0;
    this.#leftAirborneVoluntarily = false;
    this.#wasAirbornePrev = false;
    this.#jumpAirThrust = null;
    snapRigidBodyToGround(this.#world, this.body, false);
    this.reseedPhysicsInterpolation();
  }

  
  prepareMatchRestart(faction: FactionTeam): void {
    this.#reviveAnchor = null;
    this.health.respawn();
    if (this.#death.applied) {
      resetActorDeathPhysics(this.body, this.collider, this.#death);
      this.#standFromCrouch();
      this.visual.reviveLocomotion();
    }
    this.beginMatchStartDrop(faction);
  }

  
  respawnAtFaction(faction: FactionTeam): void {
    if (!this.health.isDead) {
      return;
    }

    this.#reviveAnchor = null;
    this.health.respawn();
    resetActorDeathPhysics(this.body, this.collider, this.#death);
    this.#standFromCrouch();
    this.spawnAtFaction(faction);
    this.visual.reviveLocomotion();
  }

  reviveInPlace(): void {
    if (!this.health.isDead) {
      return;
    }

    this.health.respawn();
    this.#reviveAnchor = beginReviveInPlacePhysics(this.body, this.collider, this.#death);
    this.#resetLocomotionStateAfterRevive();
    this.reseedPhysicsInterpolation();
    this.visual.reviveLocomotion(true);
  }

  readonly #finishReviveStandUpIfDoneBound = (): void => {
    this.#finishReviveStandUpIfDone();
  };

  #finishReviveStandUpIfDone(): void {
    if (this.#reviveAnchor === null || this.visual.standingUpActive) {
      return;
    }

    finishReviveInPlacePhysics(this.body, this.collider, this.#reviveAnchor);
    this.#reviveAnchor = null;
    this.reseedPhysicsInterpolation();
  }

  #skipRenderInterpolation(): boolean {
    return this.health.isDead || this.#reviveAnchor !== null;
  }

  #resetLocomotionStateAfterRevive(): void {
    this.#isJump = false;
    this.#isCrouch = false;
    this.#isSliding = false;
    this.#pinnedGroundY = null;
    this.#jumpAirThrust = null;
    this.#grounded = true;
    this.#wasAirbornePrev = false;
    this.#leftAirborneVoluntarily = false;
    this.#jumpGraceUntil = 0;
  }

  #applyJumpImpulse(now: number, input: InputSnapshot): void {
    if (!this.#isJump || this.#movementLocked) {
      return;
    }

    this.#isJump = false;
    this.#lastJumpAt = now;
    this.#grounded = false;
    this.#coyoteUntil = 0;
    this.#jumpGraceUntil = now + AIRBORNE_GRACE_MS;
    this.#leftAirborneVoluntarily = true;

    const linvel = this.body.linvel();
    const sprint = input.sprintHeld && !this.#isCrouch;
    const impulse = computeJumpImpulse({
      movement: input.movement,
      yaw: input.yaw,
      sprint,
      crouch: this.#isCrouch,
      linvel
    });

    this.#lastJumpStyle = impulse.style;

    this.body.setLinvel({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    const translation = this.body.translation();
    this.#jumpAirThrust =
      impulse.style === 'idle'
        ? createJumpAirThrustState(
            translation.y,
            impulse.y,
            impulse.airThrustWishX,
            impulse.airThrustWishZ
          )
        : null;
    fillInterpolatedBodyTranslation(
      this.#translationInterp,
      1,
      this.#renderTranslationScratch
    );
    this.#footsteps.playJumpAt(this.#renderTranslationScratch, this.visual.rigId);
  }

  #reconcileGrounded(now: number): void {
    if (now < this.#jumpGraceUntil) {
      this.#grounded = false;
      return;
    }

    const rayGrounded = this.#detectGrounded();
    if (rayGrounded) {
      this.#grounded = true;
      this.#coyoteUntil = now + JUMP_COYOTE_MS;
      this.#jumpAirThrust = null;
      return;
    }

    if (now < this.#coyoteUntil) {
      this.#grounded = true;
      return;
    }

    this.#grounded = false;
  }

  #applyMovement(deltaSeconds: number, input: InputSnapshot): void {
    this.#syncCapsuleStance();

    const velocity = this.body.linvel();

    if (this.#movementLocked) {
      if (this.#grounded) {
        this.body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
      }
      return;
    }

    if (this.#grounded) {
      if (this.#isCrouch) {
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (this.#pinnedGroundY !== null) {
          pinBodyCapsuleToGround(this.body, this.#pinnedGroundY, 'crouch');
        }
        return;
      }

      const sprint = input.sprintHeld;
      const wish = fillPlanarVelocityFromInput(
        input.movement,
        { sprint, crouch: false },
        input.yaw,
        this.#planarWishScratch
      );
      fillHumanoidPlanarStep({
        body: this.body,
        collider: this.collider,
        controller: this.#characterController,
        planarVelocityX: wish.x,
        planarVelocityZ: wish.z,
        fixedStep: deltaSeconds
      });
      return;
    }

    
    if (this.#jumpAirThrust !== null) {
      const pos = this.body.translation();
      const thrust = applyJumpAirThrust(
        this.#jumpAirThrust,
        pos.y,
        velocity.y,
        velocity.x,
        velocity.z,
        deltaSeconds
      );
      this.body.setLinvel({ x: thrust.x, y: velocity.y, z: thrust.z }, true);
      return;
    }

    this.body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
  }

  #detectGrounded(extraDistance = 0): boolean {
    return probeHumanoidGrounded(
      this.#world,
      this.body,
      this.#isCrouch || this.#isSliding,
      extraDistance
    );
  }

  #syncCapsuleStance(): void {
    const mode = resolveCapsuleMode({ crouch: this.#isCrouch, sliding: this.#isSliding });
    if (this.#capsuleMode === mode) {
      return;
    }

    this.#capsuleMode = mode;
    applyCapsuleMode(this.collider, mode);
  }

  #fillLocomotionInput(
    input: InputSnapshot,
    landedFromAir: boolean,
    out: LocomotionAnimInput
  ): void {
    const sprint = input.sprintHeld && !this.#isCrouch;
    let planarSpeedBody = 0;
    let planarSpeedTarget = 0;
    if (!this.health.isDead) {
      const velocity = this.body.linvel();
      planarSpeedBody = Math.hypot(velocity.x, velocity.z);
      planarSpeedTarget = planarSpeedFromInput(input.movement, { sprint, crouch: this.#isCrouch });
    }

    buildLocomotionAnimInputInto(out, {
      movement: input.movement,
      sprint,
      grounded: this.#grounded,
      airborne: this.#airborne,
      crouch: this.#isCrouch,
      sliding: this.#isSliding,
      fireStarted: false,
      isDead: this.health.isDead,
      planarSpeedBody,
      planarSpeedTarget,
      jumpStyle: this.#lastJumpStyle,
      landedFromAir
    });
  }

  readonly #syncDeathStateBound = (): void => {
    this.#syncDeathState(this.#lastInputSnapshot, this.#frameNow);
  };

  readonly #pinReviveBeforeRenderBound = (): void => {
    if (this.#reviveAnchor !== null) {
      maintainReviveStandUpPhysics(this.body, this.#reviveAnchor);
    }
  };

  readonly #syncVisualFromBodyBound = (): void => {
    fillHumanoidRenderTranslation(
      this.#translationInterp,
      this.#renderInterpolationBlend,
      this.body,
      this.#skipRenderInterpolation(),
      this.#renderTranslationScratch
    );
    syncHumanoidVisualRootAt(
      this.visual.root,
      this.#renderTranslationScratch,
      this.#death,
      this.#lastInputSnapshot.yaw
    );
  };

  readonly #updateLocomotionBound = (
    delta: number,
    animInput: LocomotionAnimInput,
    nowMs: number
  ): void => {
    this.visual.updateLocomotion(delta, animInput, nowMs);
  };

  #lastInputSnapshot: InputSnapshot = IDLE_INPUT_SNAPSHOT;

  #applyDevLifeKeys(input: InputSnapshot): void {
    if (input.killPressed && !this.health.isDead) {
      this.health.kill();
    }
  }

  #syncDeathState(input: InputSnapshot, nowMs: number): void {
    const wasApplied = this.#death.applied;
    syncActorDeathState(
      this.body,
      this.collider,
      this.#death,
      this.health.isDead,
      input.yaw,
      nowMs
    );

    if (!wasApplied && this.#death.applied) {
      this.#isJump = false;
      this.#isCrouch = false;
      this.#isSliding = false;
      this.#pinnedGroundY = null;
      this.reseedPhysicsInterpolation();
    }
  }

  #applyKeyEdges(input: InputSnapshot, now: number): void {
    if (this.health.isDead || this.#reviveAnchor !== null) {
      return;
    }

    if (this.#movementLocked) {
      return;
    }

    if (input.jumpPressed) {
      this.#lastJumpPressedAt = now;
    }

    const canJump =
      this.#grounded ||
      now < this.#coyoteUntil ||
      this.#detectGrounded(0.35);
    const jumpBuffered = now < this.#lastJumpPressedAt + JUMP_BUFFER_MS;

    if (jumpBuffered && canJump) {
      this.#lastJumpPressedAt = -Infinity;
      this.#standFromCrouch();
      this.#isJump = true;
    }

    this.#updateCrouchStance(input);
    this.#isSliding = false;
  }

  #updateCrouchStance(input: InputSnapshot): void {
    if (this.#isCrouch) {
      if (shouldExitCrouch({ crouchHeld: input.crouchHeld })) {
        this.#standFromCrouch();
      }
      return;
    }

    if (canEnterCrouch({ crouchHeld: input.crouchHeld, grounded: this.#grounded })) {
      this.#dropIntoCrouch();
    }
  }

  #dropIntoCrouch(): void {
    if (this.#isCrouch) {
      return;
    }

    this.#pinnedGroundY = inferGroundYFromBody(this.body, 'stand');
    this.#isCrouch = true;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    transitionCapsuleOnGround({
      collider: this.collider,
      body: this.body,
      toMode: 'crouch',
      groundY: this.#pinnedGroundY
    });
  }

  #standFromCrouch(): void {
    if (!this.#isCrouch) {
      return;
    }

    const groundY = this.#pinnedGroundY ?? inferGroundYFromBody(this.body, 'crouch');
    this.#pinnedGroundY = null;
    this.#isCrouch = false;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    transitionCapsuleOnGround({
      collider: this.collider,
      body: this.body,
      toMode: 'stand',
      groundY
    });
  }
}
