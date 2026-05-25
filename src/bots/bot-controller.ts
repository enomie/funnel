import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World
} from '@dimforge/rapier3d-simd-compat';
import type { BotSpawnSlot } from '../combat/match-roster';
import type { FactionTeam } from '../combat/teams';
import { PLAYER_GROUNDED_CENTER_Y } from '../config/game-config';
import { PlayerHealth } from '../player/player-health';
import { createHumanoidCharacterController } from '../player/character-controller-setup';
import {
  fillHumanoidPlanarStep,
  createHumanoidRapierBody,
  disposeHumanoidRapierBody,
  probeHumanoidGrounded
} from '../player/humanoid-physics';
import {
  createActorDeathSnapshot,
  resetActorDeathPhysics,
  syncActorDeathState,
  type ActorDeathSnapshot
} from '../player/actor-death';
import type { JumpStyle, JumpImpulseResult } from '../player/player-jump';
import type { BotDriveCommand } from './bot-chase-drive';
import { IDLE_MOVEMENT, planarSpeedTargetFromCommand } from './bot-chase-drive';
import {
  buildLocomotionAnimInputInto,
  type LocomotionAnimInput
} from '../player/locomotion-anim-controller';
import {
  applyBotVaultImpulse,
  BOT_JUMP_BAN_MS,
  BOT_VAULT_FAIL_LIMIT,
  BOT_VAULT_PROGRESS_MIN_M,
  fillBotJumpDecision,
  lerpAngleRad,
  vaultProgressM
} from './bot-mobility';
import { BotNavigationCache } from './bot-navigation-cache';
import { BotRouteSteerCache } from './bot-route-steer';

/** Body + weapon aim — same rate as human mouse turn feel (not snap). */
const BOT_TURN_SMOOTH_RATE = 12;
/** Net planar drift from anchor before position stall resets (m) — ignores micro-jitter. */
const STALL_NET_EPS_M = 0.28;
/** Consecutive position-stall samples before counting as stuck. */
const STALL_FRAME_THRESHOLD = 8;
/** Must close this much toward chase goal per goal-stall window (m). */
const GOAL_APPROACH_EPS_M = 0.14;
/** Chase goal stall frames while sprinting direct (no detour). */
const GOAL_STALL_FRAME_THRESHOLD = 12;
/** Goal-stall only applies beyond this chase radius (m). */
const GOAL_STALL_MIN_DIST_M = 3.2;

export class BotController {
  readonly body: RigidBody;
  readonly collider: Collider;
  readonly health: PlayerHealth;
  readonly faction: FactionTeam;
  readonly navigation = new BotNavigationCache();
  readonly routeSteer = new BotRouteSteerCache();
  readonly #world: World;
  readonly #characterController: KinematicCharacterController;
  #yaw: number;
  #aimYaw: number;
  #aimPitch: number;
  #grounded = true;
  #wasGrounded = true;
  readonly #death = createActorDeathSnapshot();
  #lastDrive: BotDriveCommand | null = null;
  #stuckFrames = 0;
  #lastJumpAtMs = 0;
  #jumpStyle: JumpStyle = 'run';
  #landedFromAir = false;
  #landImpactMps = 0;
  #vaultFailures = 0;
  #jumpBannedUntilMs = 0;
  #vaultFromX = 0;
  #vaultFromZ = 0;
  #vaultMoveYaw = 0;
  #vaultInFlight = false;
  #jumpedThisStep = false;
  #stallAnchorX = 0;
  #stallAnchorZ = 0;
  #stallFrames = 0;
  #goalDistAnchor = 0;
  #goalStallFrames = 0;
  #navPhaseSlot = 0;
  #navPhaseSlotCount = 1;
  #vaultArmed = true;
  readonly #brainJumpDecision: { shouldJump: boolean; jumpStyle: JumpStyle } = {
    shouldJump: false,
    jumpStyle: 'idle'
  };
  readonly #landingFrameScratch = { landedFromAir: false, landImpactMps: 0 };
  readonly #planarCorrectedScratch = { x: 0, z: 0 };
  readonly #jumpProbeScratch = { shouldJump: false, jumpStyle: 'idle' as JumpStyle, rearmVault: false };

  constructor(world: World, slot: BotSpawnSlot, navPhaseSlot = 0, navPhaseSlotCount = 1) {
    this.#world = world;
    this.faction = slot.faction;
    this.#yaw = slot.yaw;
    this.#aimYaw = slot.yaw;
    this.#aimPitch = 0;
    this.#stallAnchorX = slot.x;
    this.#stallAnchorZ = slot.z;
    this.#goalDistAnchor = 0;
    this.#navPhaseSlot = navPhaseSlot;
    this.#navPhaseSlotCount = navPhaseSlotCount;
    this.health = new PlayerHealth();
    this.navigation.reset(slot.x, slot.z, slot.yaw, navPhaseSlot, navPhaseSlotCount);
    this.routeSteer.reset(slot.x, slot.z, slot.yaw, navPhaseSlot, navPhaseSlotCount);

    this.#characterController = createHumanoidCharacterController(world);

    const humanoid = createHumanoidRapierBody(world, {
      x: slot.x,
      y: slot.y,
      z: slot.z
    });
    this.body = humanoid.body;
    this.collider = humanoid.collider;

    const spawnAirborne = slot.y > PLAYER_GROUNDED_CENTER_Y + 0.05;
    this.#grounded = !spawnAirborne;
    this.#wasGrounded = this.#grounded;
  }

  get yaw(): number {
    return this.#yaw;
  }

  get aimYaw(): number {
    return this.#aimYaw;
  }

  get aimPitch(): number {
    return this.#aimPitch;
  }

  get diedAtMs(): number {
    return this.#death.diedAtMs;
  }

  get deathSnapshot(): ActorDeathSnapshot {
    return this.#death;
  }

  get stuckFrames(): number {
    return this.#stuckFrames;
  }

  get grounded(): boolean {
    return this.#grounded;
  }

  get lastDrive(): BotDriveCommand | null {
    return this.#lastDrive;
  }

  /** UT-style jump pad — launch once per pad enter while overlapping trigger volume. */
  launchFromJumpPad(impulse: JumpImpulseResult, nowMs: number): void {
    if (this.health.isDead) {
      return;
    }

    this.#lastJumpAtMs = nowMs;
    this.#grounded = false;
    this.#jumpStyle = impulse.style;
    this.#vaultInFlight = false;
    this.body.setLinvel({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }

  peekLandingFrame(): { landedFromAir: boolean; landImpactMps: number } {
    const scratch = this.#landingFrameScratch;
    scratch.landedFromAir = this.#landedFromAir;
    scratch.landImpactMps = this.#landImpactMps;
    return scratch;
  }

  consumeJumpedThisStep(): boolean {
    const jumped = this.#jumpedThisStep;
    this.#jumpedThisStep = false;
    return jumped;
  }

  get navPhaseSlot(): number {
    return this.#navPhaseSlot;
  }

  get navPhaseSlotCount(): number {
    return this.#navPhaseSlotCount;
  }

  /** Capsule cast + landing headroom — once per render frame while moving. */
  probeJumpAhead(
    world: World,
    nowMs: number,
    drive: BotDriveCommand | null
  ): void {
    const probe = this.#jumpProbeScratch;
    fillBotJumpDecision(
      world,
      this.body,
      this.#grounded,
      this.#lastJumpAtMs,
      nowMs,
      drive,
      {
        vaultFailures: this.#vaultFailures,
        jumpBannedUntilMs: this.#jumpBannedUntilMs,
        vaultArmed: this.#vaultArmed
      },
      probe
    );

    if (probe.rearmVault) {
      this.#vaultArmed = true;
    } else if (probe.shouldJump) {
      this.#vaultArmed = false;
    }

    this.#brainJumpDecision.shouldJump = probe.shouldJump;
    this.#brainJumpDecision.jumpStyle = probe.jumpStyle;
  }

  locomotionInputInto(out: LocomotionAnimInput): LocomotionAnimInput {
    const velocity = this.body.linvel();
    const drive = this.#lastDrive;
    const movement = drive?.movement ?? IDLE_MOVEMENT;

    buildLocomotionAnimInputInto(out, {
      movement,
      sprint: drive?.sprint ?? false,
      grounded: this.#grounded,
      airborne: !this.#grounded,
      isDead: this.health.isDead,
      fireStarted: false,
      planarSpeedBody: Math.hypot(velocity.x, velocity.z),
      planarSpeedTarget: drive === null ? 0 : planarSpeedTargetFromCommand(drive),
      jumpStyle: this.#jumpStyle,
      landedFromAir: this.#landedFromAir
    });

    this.#landedFromAir = false;
    return out;
  }

  /** @deprecated Prefer `locomotionInputInto` on hot paths. */
  locomotionInput(): LocomotionAnimInput {
    return this.locomotionInputInto({
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
      jumpStyle: 'run',
      landedFromAir: false
    });
  }

  /** Once per render frame after physics — single ground ray (matches player). */
  afterPhysics(): void {
    if (this.health.isDead) {
      return;
    }

    this.#reconcileGrounded();
  }

  fixedUpdate(
    fixedStep: number,
    drive: BotDriveCommand | null,
    aimTarget: { readonly yaw: number; readonly pitch: number } | null,
    nowMs: number
  ): void {
    if (this.health.isDead) {
      return;
    }

    this.#tryJump(drive, nowMs);
    this.#lastDrive = drive;

    const alpha = Math.min(1, BOT_TURN_SMOOTH_RATE * fixedStep);
    if (drive !== null) {
      this.#yaw = lerpAngleRad(this.#yaw, drive.faceYaw, alpha);
    }
    if (aimTarget !== null) {
      this.#aimYaw = lerpAngleRad(this.#aimYaw, aimTarget.yaw, alpha);
      this.#aimPitch += (aimTarget.pitch - this.#aimPitch) * alpha;
    }

    const corrected = this.#applyPlanarDrive(fixedStep, drive);
    this.#updateStuckFrames(fixedStep, drive, corrected);
  }

  syncDeathState(): void {
    syncActorDeathState(
      this.body,
      this.collider,
      this.#death,
      this.health.isDead,
      this.#yaw
    );

    if (this.#death.applied) {
      this.#lastDrive = null;
    }
  }

  respawnAt(slot: BotSpawnSlot): void {
    this.health.respawn();
    resetActorDeathPhysics(this.body, this.collider, this.#death);
    this.#lastDrive = null;
    this.#stuckFrames = 0;
    this.#stallFrames = 0;
    this.#goalStallFrames = 0;
    this.#lastJumpAtMs = 0;
    this.#vaultFailures = 0;
    this.#jumpBannedUntilMs = 0;
    this.#vaultInFlight = false;
    this.#vaultArmed = true;
    this.#brainJumpDecision.shouldJump = false;
    this.#brainJumpDecision.jumpStyle = 'idle';
    this.body.setTranslation({ x: slot.x, y: slot.y, z: slot.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.#yaw = slot.yaw;
    this.#aimYaw = slot.yaw;
    this.#aimPitch = 0;
    this.#stallAnchorX = slot.x;
    this.#stallAnchorZ = slot.z;
    this.#goalDistAnchor = 0;
    this.#goalStallFrames = 0;
    this.#grounded = true;
    this.#wasGrounded = true;
    this.navigation.reset(slot.x, slot.z, slot.yaw, this.#navPhaseSlot, this.#navPhaseSlotCount);
    this.routeSteer.reset(slot.x, slot.z, slot.yaw, this.#navPhaseSlot, this.#navPhaseSlotCount);
  }

  /** Rematch intro — full heal, air spawn in match-start band. */
  beginMatchStartDrop(slot: BotSpawnSlot): void {
    this.health.respawn();
    if (this.#death.applied) {
      resetActorDeathPhysics(this.body, this.collider, this.#death);
    }
    this.#lastDrive = null;
    this.#stuckFrames = 0;
    this.#stallFrames = 0;
    this.#goalStallFrames = 0;
    this.#lastJumpAtMs = 0;
    this.#vaultFailures = 0;
    this.#jumpBannedUntilMs = 0;
    this.#vaultInFlight = false;
    this.#vaultArmed = true;
    this.#brainJumpDecision.shouldJump = false;
    this.#brainJumpDecision.jumpStyle = 'idle';
    this.body.setTranslation({ x: slot.x, y: slot.y, z: slot.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.#yaw = slot.yaw;
    this.#aimYaw = slot.yaw;
    this.#aimPitch = 0;
    this.#stallAnchorX = slot.x;
    this.#stallAnchorZ = slot.z;
    this.#goalDistAnchor = 0;
    const spawnAirborne = slot.y > PLAYER_GROUNDED_CENTER_Y + 0.05;
    this.#grounded = !spawnAirborne;
    this.#wasGrounded = this.#grounded;
    this.navigation.reset(slot.x, slot.z, slot.yaw, this.#navPhaseSlot, this.#navPhaseSlotCount);
    this.routeSteer.reset(slot.x, slot.z, slot.yaw, this.#navPhaseSlot, this.#navPhaseSlotCount);
  }

  dispose(world: World): void {
    disposeHumanoidRapierBody(world, {
      body: this.body,
      collider: this.collider,
      characterController: this.#characterController
    });
  }

  #tryJump(drive: BotDriveCommand | null, nowMs: number): void {
    if (nowMs >= this.#jumpBannedUntilMs && this.#vaultFailures >= BOT_VAULT_FAIL_LIMIT) {
      this.#vaultFailures = 0;
    }

    const decision = this.#brainJumpDecision;

    if (!decision.shouldJump || drive === null) {
      return;
    }

    const pos = this.body.translation();
    this.#vaultFromX = pos.x;
    this.#vaultFromZ = pos.z;
    this.#vaultMoveYaw = drive.moveYaw;
    this.#vaultInFlight = true;

    const impulse = applyBotVaultImpulse(drive, this.body.linvel());
    this.body.setLinvel({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    this.#jumpStyle = impulse.style;
    this.#lastJumpAtMs = nowMs;
    this.#grounded = false;
    this.#jumpedThisStep = true;
  }

  #applyPlanarDrive(
    fixedStep: number,
    drive: BotDriveCommand | null
  ): { x: number; z: number } {
    const velocity = this.body.linvel();
    const scratch = this.#planarCorrectedScratch;

    if (!this.#grounded || drive === null || !drive.moving) {
      if (this.#grounded) {
        this.body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
      }
      scratch.x = 0;
      scratch.z = 0;
      return scratch;
    }

    const inputX = drive.planarVelocity.x;
    const inputZ = drive.planarVelocity.z;

    const step = fillHumanoidPlanarStep({
      body: this.body,
      collider: this.collider,
      controller: this.#characterController,
      planarVelocityX: inputX,
      planarVelocityZ: inputZ,
      fixedStep
    });

    scratch.x = step.correctedX;
    scratch.z = step.correctedZ;
    return scratch;
  }

  #updateStuckFrames(
    fixedStep: number,
    drive: BotDriveCommand | null,
    corrected: { x: number; z: number }
  ): void {
    if (!this.#grounded || drive === null || !drive.moving || fixedStep <= 0) {
      this.#stuckFrames = 0;
      this.#stallFrames = 0;
      this.#goalStallFrames = 0;
      return;
    }

    const pos = this.body.translation();
    const wishedSpeed = Math.hypot(drive.planarVelocity.x, drive.planarVelocity.z);
    const actualSpeed = Math.hypot(corrected.x, corrected.z) / fixedStep;
    const moved = Math.hypot(corrected.x, corrected.z);
    const forwardProgress =
      moved <= 0.0001
        ? 0
        : (corrected.x * drive.planarVelocity.x + corrected.z * drive.planarVelocity.z) /
          (moved * wishedSpeed);

    const netDrift = Math.hypot(pos.x - this.#stallAnchorX, pos.z - this.#stallAnchorZ);
    if (netDrift >= STALL_NET_EPS_M) {
      this.#stallAnchorX = pos.x;
      this.#stallAnchorZ = pos.z;
      this.#stallFrames = 0;
    } else {
      this.#stallFrames = Math.min(this.#stallFrames + 1, 48);
    }

    const velocityStuck =
      wishedSpeed > 0.1 &&
      (actualSpeed < wishedSpeed * 0.35 || forwardProgress < 0.35);
    const positionStuck = this.#stallFrames >= STALL_FRAME_THRESHOLD;
    const goalStuck = this.#updateGoalStallFrames(drive, pos.x, pos.z);

    if (!velocityStuck && !positionStuck && !goalStuck) {
      if (this.#stuckFrames > 0) {
        this.#vaultFailures = 0;
      }
      this.#stuckFrames = 0;
      return;
    }

    this.#stuckFrames = Math.min(this.#stuckFrames + 1, 120);
  }

  /** Direct chase only — detours may move away from the mission goal on purpose. */
  #updateGoalStallFrames(
    drive: BotDriveCommand,
    botX: number,
    botZ: number
  ): boolean {
    const goalDist = Math.hypot(drive.chaseGoalX - botX, drive.chaseGoalZ - botZ);

    if (drive.routeDetour || goalDist < GOAL_STALL_MIN_DIST_M) {
      this.#goalDistAnchor = goalDist;
      this.#goalStallFrames = 0;
      return false;
    }

    if (this.#goalDistAnchor <= 0) {
      this.#goalDistAnchor = goalDist;
      return false;
    }

    const goalGain = this.#goalDistAnchor - goalDist;
    if (goalGain >= GOAL_APPROACH_EPS_M) {
      this.#goalDistAnchor = goalDist;
      this.#goalStallFrames = 0;
      return false;
    }

    this.#goalStallFrames = Math.min(this.#goalStallFrames + 1, 48);
    return this.#goalStallFrames >= GOAL_STALL_FRAME_THRESHOLD;
  }

  #reconcileGrounded(): void {
    const grounded = probeHumanoidGrounded(this.#world, this.body, false);

    if (!this.#wasGrounded && grounded) {
      this.#landedFromAir = true;
      const velocity = this.body.linvel();
      this.#landImpactMps = Math.abs(Math.min(0, velocity.y));
      this.#onVaultLanded();
    }

    this.#wasGrounded = grounded;
    this.#grounded = grounded;
  }

  #onVaultLanded(): void {
    if (!this.#vaultInFlight) {
      return;
    }

    this.#vaultInFlight = false;
    const pos = this.body.translation();
    const progress = vaultProgressM(
      this.#vaultMoveYaw,
      this.#vaultFromX,
      this.#vaultFromZ,
      pos.x,
      pos.z
    );

    if (progress >= BOT_VAULT_PROGRESS_MIN_M) {
      this.#vaultFailures = 0;
      return;
    }

    this.#vaultFailures = Math.min(this.#vaultFailures + 1, BOT_VAULT_FAIL_LIMIT);
    if (this.#vaultFailures >= BOT_VAULT_FAIL_LIMIT) {
      this.#jumpBannedUntilMs = performance.now() + BOT_JUMP_BAN_MS;
    }
  }
}
