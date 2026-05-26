// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-actor.ts

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
import type { FactionTeam } from '../combat/teams';
import { rollSpawnWeapon, redeemerWeaponDefinition } from '../combat/spawn-weapon-roll';
import { aimDirectionFromYawPitch, resolveMuzzleWorldPositionFromRoot } from '../combat/weapon-aim';
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
import { botAutoRespawnDue } from './bot-respawn';
import type { BotCombatContext } from './bot-roster';
import { BotTargetFocus } from './bot-target-focus';
import { BotVisual } from './bot-visual';
import type { LocomotionAnimInput } from '../player/locomotion-anim-controller';
import {
  FootstepController,
  type MutableFootstepFrameInput
} from '../player/footstep-controller';
import { syncHumanoidVisualRootAt } from '../physics/synced-body';

const _muzzlePosition = new Vector3();
const _aimDirection = new Vector3();
const _weaponBodyPosition = new Vector3();

const BOT_ROCKET_VOLLEY_MARKS = 3;

const BOT_BIO_RELEASE_FRACTION = 0.92;

const BOT_ANIM_LOD_EXIT_M = 46;
const BOT_ANIM_LOD_ENTER_M = 34;
const BOT_ANIM_LOD_EXIT_SQ = BOT_ANIM_LOD_EXIT_M * BOT_ANIM_LOD_EXIT_M;
const BOT_ANIM_LOD_ENTER_SQ = BOT_ANIM_LOD_ENTER_M * BOT_ANIM_LOD_ENTER_M;

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
  #visualReducedLod = false;
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
    updateLocomotion: (deltaSeconds: number, input: LocomotionAnimInput, nowMs: number) => void;
    weapon: WeaponArsenal;
    weaponAim: { yaw: number; pitch: number };
    weaponBodyPosition: Vector3;
    suspendState: HumanoidCombatSuspendState;
    afterDeathSync?: (nowMs: number) => void;
    pinBeforeRender?: () => void;
    afterLocomotion?: () => void;
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
  readonly #footsteps = new FootstepController();
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
      pinBeforeRender: this.#pinReviveBeforeRenderBound,
      syncVisualFromBody: this.#syncVisualFromBodyBound,
      updateLocomotion: this.#updateLocomotionBound,
      weapon: this.weapon,
      weaponAim: this.#weaponAimScratch,
      weaponBodyPosition: _weaponBodyPosition,
      suspendState: this.#combatSuspend,
      afterLocomotion: this.#finishReviveStandUpIfDoneBound
    };

    syncHumanoidVisualRootAt(
      this.visual.root,
      this.controller.fillRenderTranslation(),
      this.controller.deathSnapshot,
      this.controller.yaw
    );
  }

  
  preparePhysicsFrame(
    deltaSeconds: number,
    nowMs: number,
    context: BotCombatContext,
    shedNonCritical = false
  ): void {
    if (this.controller.health.isDead) {
      this.#driveActive = false;
      return;
    }

    const translation = this.controller.body.translation();
    let intent = this.#brain.intent;

    if (!shedNonCritical) {
      const brainFrame = this.#brain.update(deltaSeconds, () =>
        this.#sampleBrainInput(context, translation, nowMs)
      );
      if (brainFrame.stepped) {
        this.#combatStepPending = true;
      }

      intent = brainFrame.intent;

      tickBotRouteSteerFrame(
        context.world,
        this.controller.body,
        translation.x,
        translation.y,
        translation.z,
        this.controller.routeSteer,
        intent,
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
        intent
      );
    }

    this.#driveActive = fillDriveFromBrainIntent(
      translation.x,
      translation.z,
      intent,
      this.controller.navigation,
      this.controller.routeSteer,
      this.controller.stuckFrames,
      this.#driveScratch
    );

    if (this.#driveActive && this.#driveScratch.moving && !shedNonCritical) {
      this.controller.probeJumpAhead(context.world, nowMs, this.#driveScratch);
    }
  }

  
  tickCountdownDrop(deltaSeconds: number, nowMs: number): void {
    if (this.controller.health.isDead) {
      return;
    }

    this.#visualReducedLod = false;
    const landing = this.controller.peekLandingFrame();
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
    this.#tickFootsteps(landing);
  }

  #tickFootsteps(landing: { landedFromAir: boolean; landImpactMps: number }): void {
    const renderPos = this.controller.fillRenderTranslation();
    const loc = this.#locomotionScratch;
    const footInput = this.#footstepFrameScratch;

    footInput.grounded = loc.grounded && !loc.airborne;
    footInput.landedFromAir = landing.landedFromAir;
    footInput.landImpactMps = landing.landImpactMps;
    footInput.isDead = loc.isDead;
    footInput.sprint = loc.sprint;
    footInput.crouch = loc.crouch;
    footInput.position.x = renderPos.x;
    footInput.position.y = renderPos.y;
    footInput.position.z = renderPos.z;
    footInput.planarSpeedBody = loc.planarSpeedBody;
    footInput.planarSpeedTarget = loc.planarSpeedTarget;
    footInput.locomotionClipId = this.visual.locomotionClipId;
    footInput.rigId = this.visual.rigId;
    this.#footsteps.update(footInput);

    if (this.controller.consumeJumpedThisStep()) {
      this.#footsteps.playJumpAt(renderPos, this.visual.rigId);
    }
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

  update(
    deltaSeconds: number,
    nowMs: number,
    context: BotCombatContext,
    loadShedNonCritical = false
  ): void {
    const landing = this.controller.peekLandingFrame();
    const translation = this.controller.body.translation();
    _weaponBodyPosition.set(translation.x, translation.y, translation.z);
    this.controller.locomotionInputInto(this.#locomotionScratch);

    const player = context.player;
    const dx = player.x - translation.x;
    const dy = player.y - translation.y;
    const dz = player.z - translation.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (this.controller.health.isDead) {
      this.#visualReducedLod = false;
    } else if (this.#visualReducedLod) {
      if (distSq <= BOT_ANIM_LOD_ENTER_SQ) {
        this.#visualReducedLod = false;
      }
    } else if (distSq > BOT_ANIM_LOD_EXIT_SQ) {
      this.#visualReducedLod = true;
    }

    const tickContext = this.#humanoidTickContext;
    tickContext.isDead = this.controller.health.isDead;
    tickContext.nowMs = nowMs;
    tickContext.deltaSeconds = deltaSeconds;
    this.#weaponAimScratch.yaw = this.controller.aimYaw;
    this.#weaponAimScratch.pitch = this.controller.aimPitch;

    tickHumanoidRenderFrame(tickContext as HumanoidRenderTickContext, this.#locomotionScratch);
    if (!this.#visualReducedLod) {
      this.#tickFootsteps(landing);
    }

    if (
      !this.controller.health.isDead &&
      !this.controller.reviveStandUpPending &&
      (!loadShedNonCritical || !this.#visualReducedLod)
    ) {
      this.#tickCombat(nowMs, context);
    }

    this.weapon.prepareWorldTickContext(
      this.controller.health.isDead || this.controller.reviveStandUpPending
        ? undefined
        : this.#weaponAimScratch
    );
  }

  readonly #syncDeathStateBound = (): void => {
    this.controller.syncDeathState(this.#humanoidTickContext.nowMs);
  };

  readonly #pinReviveBeforeRenderBound = (): void => {
    this.controller.maintainReviveStandUpIfPending();
  };

  readonly #finishReviveStandUpIfDoneBound = (): void => {
    this.controller.finishReviveStandUpIfDone(this.visual.standingUpActive);
  };

  readonly #syncVisualFromBodyBound = (): void => {
    syncHumanoidVisualRootAt(
      this.visual.root,
      this.controller.fillRenderTranslation(),
      this.controller.deathSnapshot,
      this.controller.yaw
    );
  };

  readonly #updateLocomotionBound = (
    delta: number,
    input: LocomotionAnimInput,
    nowMs: number
  ): void => {
    this.visual.updateLocomotion(
      delta,
      input,
      this.controller.aimPitch,
      this.#visualReducedLod,
      nowMs
    );
  };

  tryAutoRespawn(nowMs: number): void {
    this.#tryRespawn(nowMs);
  }

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
    resolveMuzzleWorldPositionFromRoot(
      this.visual.root,
      this.visual.muzzleSocket,
      _muzzlePosition
    );
    this.weapon.trackMechanicsAudioOrigin(_muzzlePosition);
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

    if (this.weapon.needsMechanicsAudioTick(nowMs)) {
      this.weapon.tickMechanicsAudio(nowMs);
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

  resetVisibilityClock(): void {
    this.#brain.reset();
    this.controller.navigation.flushAccumulator();
  }

  reviveInPlace(): void {
    this.controller.reviveInPlace();
    this.#brain.reset();
    this.#targetFocus.reset();
    this.#combatSuspend.active = false;
    this.#secondaryHoldActive = false;
    this.visual.reviveLocomotion(true);
  }

  hireInPlace(newFaction: FactionTeam, viewerTeam: PlayerTeam): void {
    this.controller.reviveInPlace();
    this.controller.setFaction(newFaction);
    this.combatActor.setFaction(newFaction);
    this.visual.setFaction(newFaction);
    this.#brain.reset();
    this.#targetFocus.reset();
    this.#combatSuspend.active = false;
    this.#secondaryHoldActive = false;
    this.visual.applyViewerColors(viewerTeam);
    this.visual.reviveLocomotion(true);
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

    const deathSnapshot = this.controller.deathSnapshot;
    if (deathSnapshot.channelerId !== null) {
      return;
    }

    if (
      !botAutoRespawnDue(
        nowMs,
        deathSnapshot,
        this.#respawnPhaseSlot,
        this.#respawnPhaseSlotCount
      ) ||
      !tryAcquireBotRespawn()
    ) {
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

  
  prepareMatchRestart(nowMs: number): void {
    this.weapon.suspendCombat(nowMs);
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
