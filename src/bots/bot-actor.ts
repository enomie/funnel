import type { World } from '@dimforge/rapier3d-simd-compat';
import { Vector3 } from 'three/webgpu';
import type { Scene } from 'three/webgpu';
import type { WeaponAudio } from '../game-audio/audio-weapon/audio-weapon';
import type { ActorRegistry } from '../combat/actor-registry';
import type { ApplyImpactDeps } from '../combat/apply-impact';
import {
  applyCombinedSecondaryIntent,
  applyPrimaryFireIntent,
  fillFireIntentFromBrain,
  fillSecondaryHoldFromBrain,
  type MutableFireIntent,
  type MutableSecondaryHoldGates,
  tickSecondaryBeamHold,
  weaponUsesHoldSecondary
} from '../combat/fire-intent';
import { secondaryFireEnabled } from '../combat/weapon-definitions';
import { tickHumanoidRenderFrame, type HumanoidCombatSuspendState, type HumanoidRenderTickContext } from '../combat/humanoid-actor-tick';
import { createCombatActor, type CombatActor } from '../combat/combat-actor';
import type { BotSpawnSlot } from '../combat/match-roster';
import { rollSpawnWeapon, redeemerWeaponDefinition } from '../combat/spawn-weapon-roll';
import { aimDirectionFromYawPitch, resolveMuzzleWorldPosition } from '../combat/weapon-aim';
import { WeaponArsenal, WEAPON_ARSENAL_BOT_BUDGET } from '../combat/weapon-arsenal';
import type { WorldProjectileSim } from '../combat/world-projectile-sim';
import type { ShooterPackCharacter } from '../player/shooter-pack-loader';
import type { PlayerTeam } from '../player/player-team';
import type { SphereInstancingService } from '../render/sphere-instancing';
import type { SegmentLineInstancingService } from '../render/segment-line-instancing';
import { BotBrain, type BotBrainInput } from './bot-brain';
import {
  fillDriveFromBrainIntent,
  tickBotNavigationFrame,
  tickBotRouteSteerFrame,
  type MutableBotDriveCommand
} from './bot-chase-drive';
import { BotController } from './bot-controller';
import { hasLineOfSightToTarget, BOT_EYE_HEIGHT_OFFSET } from './bot-perception';
import type { GameEventBus } from '../core/event-bus';
import { tryAcquireBotRespawn } from './bot-respawn-budget';
import { botRespawnDueAtMs } from './bot-respawn';
import type { BotCombatContext } from './bot-roster';
import { BotTargetFocus } from './bot-target-focus';
import { BotVisual } from './bot-visual';
import type { LocomotionAnimInput } from '../player/locomotion-anim-controller';
import { syncHumanoidVisualRoot } from '../physics/synced-body';

const _muzzlePosition = new Vector3();
const _aimDirection = new Vector3();
const _weaponBodyPosition = new Vector3();
/** Rockets marked before bot releases RMB volley (player can hold up to mag size). */
const BOT_ROCKET_VOLLEY_MARKS = 3;
/** Release Bio blob once charge fraction crosses this (matches full charge feel). */
const BOT_BIO_RELEASE_FRACTION = 0.92;
/** Beyond this distance from the viewer, skip mixer/foot/eye work (root sync still runs). */
const BOT_ANIMATION_LOD_DISTANCE_M = 40;
const BOT_ANIMATION_LOD_DISTANCE_SQ = BOT_ANIMATION_LOD_DISTANCE_M * BOT_ANIMATION_LOD_DISTANCE_M;

export class BotActor {
  readonly controller: BotController;
  readonly visual: BotVisual;
  readonly combatActor: CombatActor;
  readonly weapon: WeaponArsenal;
  readonly #respawnSlot: BotSpawnSlot;
  readonly #matchStartSlot: BotSpawnSlot;
  readonly #botId: string;
  readonly #brain = new BotBrain();
  readonly #targetFocus = new BotTargetFocus();
  readonly #combatSuspend: HumanoidCombatSuspendState = { active: false };
  readonly #respawnPhaseSlot: number;
  readonly #respawnPhaseSlotCount: number;
  readonly #bus: GameEventBus;
  #weaponRollIndex = 0;
  #secondaryHoldActive = false;
  #combatStepPending = false;
  #driveActive = false;
  #skipAnimationLod = false;
  readonly #weaponAimScratch = { yaw: 0, pitch: 0 };
  readonly #driveScratch: MutableBotDriveCommand = {
    faceYaw: 0,
    moveYaw: 0,
    planarVelocity: { x: 0, z: 0 },
    sprint: false,
    moving: false,
    movement: { forward: false, back: false, left: false, right: false },
    chaseGoalX: 0,
    chaseGoalZ: 0,
    routeDetour: false
  };
  readonly #brainInputScratch: BotBrainInput = {
    botX: 0,
    botY: 0,
    botZ: 0,
    faction: 'alpha',
    isDead: false,
    matchLive: false,
    target: null,
    hasLineOfSight: false,
    fireRangeM: 0,
    canFire: false
  };
  readonly #humanoidTickContext: {
    isDead: boolean;
    nowMs: number;
    deltaSeconds: number;
    syncDeathState: () => void;
    syncVisualFromBody: () => void;
    updateLocomotion: (deltaSeconds: number, input: LocomotionAnimInput) => void;
    weapon: WeaponArsenal;
    weaponAim: { yaw: number; pitch: number };
    weaponBodyPosition: Vector3;
    suspendState: HumanoidCombatSuspendState;
    afterDeathSync?: (nowMs: number) => void;
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
    jumpStyle: 'run',
    landedFromAir: false
  };
  readonly #fireIntentScratch: MutableFireIntent = {
    primary: { held: false, pressed: false },
    secondary: { held: false, pressed: false },
    aimYaw: 0,
    aimPitch: 0
  };
  readonly #secondaryHoldScratch: MutableSecondaryHoldGates = {
    pressed: false,
    held: false,
    released: false
  };

  constructor(
    scene: Scene,
    world: World,
    registry: ActorRegistry,
    impactDeps: ApplyImpactDeps,
    weaponAudio: WeaponAudio,
    slot: BotSpawnSlot,
    respawnSlot: BotSpawnSlot,
    viewerTeam: PlayerTeam,
    id: string,
    template: ShooterPackCharacter | undefined,
    sphereInstancing: SphereInstancingService,
    segmentLineInstancing: SegmentLineInstancingService,
    projectileSim: WorldProjectileSim,
    navPhaseSlot = 0,
    navPhaseSlotCount = 1
  ) {
    this.#respawnSlot = respawnSlot;
    this.#matchStartSlot = slot;
    this.#botId = id;
    this.#respawnPhaseSlot = navPhaseSlot;
    this.#respawnPhaseSlotCount = navPhaseSlotCount;
    this.#bus = impactDeps.bus;
    this.controller = new BotController(world, slot, navPhaseSlot, navPhaseSlotCount);
    const weaponDef = rollSpawnWeapon(`${this.#botId}:${String(this.#weaponRollIndex)}`);
    this.visual = new BotVisual(scene, slot, viewerTeam, template, weaponDef);
    this.combatActor = createCombatActor({
      id,
      kind: 'bot',
      faction: slot.faction,
      health: this.controller.health,
      body: this.controller.body,
      colliders: [this.controller.collider]
    });
    registry.register(this.combatActor);

    this.weapon = new WeaponArsenal(
      scene,
      world,
      this.controller.body,
      weaponAudio,
      impactDeps,
      () => this.controller.faction,
      id,
      this.visual.weaponSocket,
      projectileSim,
      WEAPON_ARSENAL_BOT_BUDGET,
      sphereInstancing,
      segmentLineInstancing
    );
    this.weapon.equipWeapon(weaponDef);

    this.#humanoidTickContext = {
      isDead: false,
      nowMs: 0,
      deltaSeconds: 0,
      syncDeathState: this.#syncDeathStateBound,
      syncVisualFromBody: this.#syncVisualFromBodyBound,
      updateLocomotion: this.#updateLocomotionBound,
      weapon: this.weapon,
      weaponAim: this.#weaponAimScratch,
      weaponBodyPosition: _weaponBodyPosition,
      suspendState: this.#combatSuspend
    };

    syncHumanoidVisualRoot(
      this.controller.body,
      this.visual.root,
      this.controller.deathSnapshot,
      this.controller.yaw
    );
  }

  /** Brain + nav once per render frame — must not run per physics sub-step. */
  preparePhysicsFrame(deltaSeconds: number, nowMs: number, context: BotCombatContext): void {
    if (this.controller.health.isDead) {
      this.#driveActive = false;
      return;
    }

    const translation = this.controller.body.translation();
    const brainFrame = this.#brain.update(deltaSeconds, () =>
      this.#sampleBrainInput(context, translation, nowMs)
    );
    if (brainFrame.stepped) {
      this.#combatStepPending = true;
    }

    tickBotRouteSteerFrame(
      context.world,
      this.controller.body,
      translation.x,
      translation.y,
      translation.z,
      this.controller.routeSteer,
      brainFrame.intent,
      this.controller.stuckFrames,
      this.controller.navigation.moveYaw
    );

    tickBotNavigationFrame(
      context.world,
      this.controller.body,
      translation.x,
      translation.y,
      translation.z,
      this.controller.faction,
      this.controller.stuckFrames,
      this.controller.navigation,
      deltaSeconds,
      brainFrame.intent
    );

    this.#driveActive = fillDriveFromBrainIntent(
      translation.x,
      translation.z,
      brainFrame.intent,
      this.controller.navigation,
      this.controller.routeSteer,
      this.controller.stuckFrames,
      this.#driveScratch
    );

    if (this.#driveActive && this.#driveScratch.moving) {
      this.controller.probeJumpAhead(context.world, nowMs, this.#driveScratch);
    }
  }

  /** Pre-match countdown — gravity fall + visual sync (no brain/combat). */
  tickCountdownDrop(deltaSeconds: number, nowMs: number): void {
    if (this.controller.health.isDead) {
      return;
    }

    this.#skipAnimationLod = false;
    const translation = this.controller.body.translation();

    _weaponBodyPosition.set(translation.x, translation.y, translation.z);

    this.controller.locomotionInputInto(this.#locomotionScratch);

    const tickContext = this.#humanoidTickContext;
    tickContext.isDead = false;
    tickContext.nowMs = nowMs;
    tickContext.deltaSeconds = deltaSeconds;
    this.#weaponAimScratch.yaw = this.controller.yaw;
    this.#weaponAimScratch.pitch = 0;

    tickHumanoidRenderFrame(tickContext as HumanoidRenderTickContext, this.#locomotionScratch);
  }

  fixedUpdate(fixedStep: number, nowMs: number, _context: BotCombatContext): void {
    if (this.controller.health.isDead) {
      return;
    }

    const aim = this.#brain.intent;
    this.#weaponAimScratch.yaw = aim.aimYaw;
    this.#weaponAimScratch.pitch = aim.aimPitch;
    this.controller.fixedUpdate(
      fixedStep,
      this.#driveActive ? this.#driveScratch : null,
      this.#weaponAimScratch,
      nowMs
    );
  }

  update(deltaSeconds: number, nowMs: number, context: BotCombatContext): void {
    const translation = this.controller.body.translation();
    _weaponBodyPosition.set(translation.x, translation.y, translation.z);
    this.controller.locomotionInputInto(this.#locomotionScratch);

    const player = context.player;
    const dx = player.x - translation.x;
    const dy = player.y - translation.y;
    const dz = player.z - translation.z;
    this.#skipAnimationLod =
      !this.controller.health.isDead &&
      dx * dx + dy * dy + dz * dz > BOT_ANIMATION_LOD_DISTANCE_SQ;

    const tickContext = this.#humanoidTickContext;
    tickContext.isDead = this.controller.health.isDead;
    tickContext.nowMs = nowMs;
    tickContext.deltaSeconds = deltaSeconds;
    tickContext.afterDeathSync = this.#afterDeathSyncBound;
    this.#weaponAimScratch.yaw = this.controller.aimYaw;
    this.#weaponAimScratch.pitch = this.controller.aimPitch;

    tickHumanoidRenderFrame(tickContext as HumanoidRenderTickContext, this.#locomotionScratch);

    if (!this.controller.health.isDead) {
      this.#tickCombat(nowMs, context);
    }

    this.weapon.prepareWorldTickContext(
      this.controller.health.isDead ? undefined : this.#weaponAimScratch
    );
  }

  readonly #syncDeathStateBound = (): void => {
    this.controller.syncDeathState();
  };

  readonly #syncVisualFromBodyBound = (): void => {
    syncHumanoidVisualRoot(
      this.controller.body,
      this.visual.root,
      this.controller.deathSnapshot,
      this.controller.yaw
    );
  };

  readonly #updateLocomotionBound = (delta: number, input: LocomotionAnimInput): void => {
    this.visual.updateLocomotion(
      delta,
      input,
      this.controller.aimPitch,
      this.#skipAnimationLod,
      this.#humanoidTickContext.nowMs
    );
  };

  readonly #afterDeathSyncBound = (deathNowMs: number): void => {
    this.#tryRespawn(deathNowMs);
  };

  #tickCombat(nowMs: number, context: BotCombatContext): void {
    const brainStepped = this.#combatStepPending;
    this.#combatStepPending = false;

    const intent = this.#brain.intent;
    const weaponDef = this.weapon.selectedWeapon;
    const fireIntent = fillFireIntentFromBrain(
      intent,
      weaponDef,
      brainStepped,
      this.controller.aimYaw,
      this.controller.aimPitch,
      this.#fireIntentScratch
    );
    resolveMuzzleWorldPosition(this.visual.muzzleSocket, _muzzlePosition);
    if (this.weapon.needsMechanicsAudioTick(nowMs)) {
      this.weapon.trackMechanicsAudioOrigin(_muzzlePosition);
      this.weapon.tickMechanicsAudio(nowMs);
    }
    aimDirectionFromYawPitch(fireIntent.aimYaw, fireIntent.aimPitch, _aimDirection);

    const wantsHoldSecondary =
      intent.wantsFire &&
      secondaryFireEnabled(weaponDef) &&
      weaponUsesHoldSecondary(weaponDef);
    const hold = fillSecondaryHoldFromBrain(
      wantsHoldSecondary,
      brainStepped,
      this.#secondaryHoldActive,
      this.#secondaryHoldScratch
    );

    applyCombinedSecondaryIntent(
      this.weapon,
      fireIntent,
      hold,
      nowMs,
      _muzzlePosition,
      _aimDirection,
      context.matchLive
    );

    if (wantsHoldSecondary) {
      this.#autoReleaseBotSecondary(nowMs, _muzzlePosition, _aimDirection);
      this.#secondaryHoldActive = this.weapon.isBioChargeHolding() || this.weapon.isRocketMarking();
    } else {
      this.#secondaryHoldActive = false;
    }

    const primaryBusy =
      weaponUsesHoldSecondary(weaponDef) &&
      (this.#secondaryHoldActive ||
        this.weapon.isBioChargeHolding() ||
        this.weapon.isRocketMarking());
    applyPrimaryFireIntent(
      this.weapon,
      fireIntent,
      nowMs,
      _muzzlePosition,
      _aimDirection,
      context.matchLive && !primaryBusy
    );

    tickSecondaryBeamHold(this.weapon, fireIntent, nowMs, _muzzlePosition, _aimDirection);
  }

  applyViewerColors(viewerTeam: PlayerTeam): void {
    this.visual.applyViewerColors(viewerTeam);
  }

  dispose(world: World, registry: ActorRegistry): void {
    registry.unregister(this.combatActor);
    this.weapon.releaseAllWorldEffects();
    this.controller.dispose(world);
    this.visual.dispose();
  }

  #tryRespawn(nowMs: number): void {
    if (!this.controller.health.isDead) {
      return;
    }

    const deathTime = this.controller.diedAtMs;
    const dueAt = botRespawnDueAtMs(
      deathTime,
      this.#respawnPhaseSlot,
      this.#respawnPhaseSlotCount
    );
    if (nowMs < dueAt || !tryAcquireBotRespawn()) {
      return;
    }

    this.controller.respawnAt(this.#respawnSlot);
    this.#bus.emit('actor-respawned', {
      actorId: this.#botId,
      faction: this.controller.faction
    });
    this.#brain.reset();
    this.#targetFocus.reset();
    this.#combatSuspend.active = false;
    this.#secondaryHoldActive = false;
    this.rollSpawnWeapon();
    this.visual.reviveLocomotion();
  }

  rollSpawnWeapon(): void {
    this.#weaponRollIndex += 1;
    const weaponDef = rollSpawnWeapon(`${this.#botId}:${String(this.#weaponRollIndex)}`);
    this.weapon.equipWeapon(weaponDef);
    this.visual.equipWeapon(weaponDef);
  }

  equipRedeemer(): void {
    const weaponDef = redeemerWeaponDefinition();
    this.weapon.equipWeapon(weaponDef);
    this.visual.equipWeapon(weaponDef);
  }

  /** Rematch — clear combat state and air-drop at match-start slot. */
  prepareMatchRestart(): void {
    this.weapon.suspendCombat();
    this.controller.beginMatchStartDrop(this.#matchStartSlot);
    this.#brain.reset();
    this.#targetFocus.reset();
    this.#combatSuspend.active = false;
    this.#secondaryHoldActive = false;
    this.#driveActive = false;
    this.visual.reviveLocomotion();
  }

  #autoReleaseBotSecondary(nowMs: number, muzzlePosition: Vector3, direction: Vector3): void {
    if (this.weapon.isRocketMarking()) {
      const marked = this.weapon.rocketMarkedCount;
      if (marked > 0 && (marked >= BOT_ROCKET_VOLLEY_MARKS || this.weapon.roundsAvailable() <= 0)) {
        this.weapon.releaseRocketVolley(nowMs, direction, muzzlePosition);
      }
      return;
    }

    if (
      this.weapon.isBioChargeHolding() &&
      this.weapon.peekBioChargeFraction(nowMs) >= BOT_BIO_RELEASE_FRACTION
    ) {
      this.weapon.releaseBioCharge(nowMs, direction, muzzlePosition);
    }
  }

  #sampleBrainInput(
    context: BotCombatContext,
    translation: { x: number; y: number; z: number },
    nowMs: number
  ): BotBrainInput {
    const scratch = this.#brainInputScratch as {
      botX: number;
      botY: number;
      botZ: number;
      faction: BotBrainInput['faction'];
      isDead: boolean;
      matchLive: boolean;
      target: BotBrainInput['target'];
      hasLineOfSight: boolean;
      fireRangeM: number;
      canFire: boolean;
    };
    scratch.botX = translation.x;
    scratch.botY = translation.y;
    scratch.botZ = translation.z;
    scratch.faction = this.controller.faction;
    scratch.isDead = this.controller.health.isDead;
    scratch.matchLive = context.matchLive;
    scratch.fireRangeM = this.weapon.fireRangeM;
    scratch.canFire = this.weapon.canFirePrimary(nowMs);

    const target = this.#targetFocus.resolve(
      translation.x,
      translation.z,
      this.controller.faction,
      this.controller.body,
      context.targets
    );
    scratch.target = target;

    if (target !== null) {
      scratch.hasLineOfSight = hasLineOfSightToTarget(
        context.world,
        context.registry,
        translation.x,
        translation.y + BOT_EYE_HEIGHT_OFFSET,
        translation.z,
        target,
        this.controller.body
      );
    } else {
      scratch.hasLineOfSight = false;
    }

    return scratch;
  }
}
