// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-roster.ts

import type { Collider, RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import type { Scene } from 'three/webgpu';
import type { WeaponAudio } from '../game-audio/audio-weapon/audio-weapon';
import type { ActorRegistry } from '../combat/actor-registry';
import type { ApplyImpactDeps } from '../combat/apply-impact';
import { devPlaceholderSpawnPairs } from '../combat/match-roster';
import type { FactionTeam } from '../combat/teams';
import { resolveBotShooterPack, type ShooterPackRoster } from '../player/humanoid-rig';
import type { PlayerTeam } from '../player/player-team';
import type { BlobShadowController } from '../render/blob-shadow';
import type { ShadowLodController } from '../render/shadow-lod';
import type { SphereInstancingService } from '../render/sphere-instancing';
import type { SegmentLineInstancingService } from '../render/segment-line-instancing';
import type { WorldProjectileSim } from '../combat/world-projectile-sim';
import { BotActor } from './bot-actor';
import { BotTargetSnapshotCache } from './bot-target-snapshots';
import type { CapsuleColliderDebugLayer } from '../physics/capsule-collider-debug';
import type { JumpPadField } from '../arena/jump-pad-field';
import type { BotController } from './bot-controller';

export interface BotCombatContext {
  readonly matchLive: boolean;
  readonly world: World;
  readonly registry: ActorRegistry;
  readonly targets: BotTargetSnapshotCache['targets'];
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly faction: FactionTeam;
    readonly isDead: boolean;
    readonly body: RigidBody;
    readonly colliders: readonly Collider[];
  };
}

export interface BotRosterDeps {
  readonly impactDeps: ApplyImpactDeps;
  readonly weaponAudio: WeaponAudio;
  readonly shadowLod: ShadowLodController;
  readonly blobShadow: BlobShadowController;
  readonly sphereInstancing: SphereInstancingService;
  readonly segmentLineInstancing: SegmentLineInstancingService;
  readonly projectileSim: WorldProjectileSim;
  readonly capsuleDebug: CapsuleColliderDebugLayer;
}

export class BotRoster {
  readonly #scene: Scene;
  readonly #world: World;
  readonly #viewerTeam: PlayerTeam;
  readonly #actorRegistry: ActorRegistry;
  readonly #impactDeps: ApplyImpactDeps;
  readonly #weaponAudio: WeaponAudio;
  readonly #shadowLod: ShadowLodController;
  readonly #blobShadow: BlobShadowController;
  readonly #sphereInstancing: SphereInstancingService;
  readonly #segmentLineInstancing: SegmentLineInstancingService;
  readonly #projectileSim: WorldProjectileSim;
  readonly #capsuleDebug: CapsuleColliderDebugLayer;
  readonly #targetSnapshots = new BotTargetSnapshotCache();
  readonly #combatContext: BotCombatContext = {
    matchLive: false,
    world: null as unknown as World,
    registry: null as unknown as ActorRegistry,
    targets: this.#targetSnapshots.targets,
    player: {
      x: 0,
      y: 0,
      z: 0,
      faction: 'beta',
      isDead: false,
      body: null as unknown as RigidBody,
      colliders: []
    }
  };
  #bots: BotActor[] = [];
  readonly #jumpPadBotScratch: BotController[] = [];

  constructor(
    scene: Scene,
    world: World,
    viewerTeam: PlayerTeam,
    actorRegistry: ActorRegistry,
    deps: BotRosterDeps
  ) {
    this.#scene = scene;
    this.#world = world;
    this.#viewerTeam = viewerTeam;
    this.#actorRegistry = actorRegistry;
    this.#impactDeps = deps.impactDeps;
    this.#weaponAudio = deps.weaponAudio;
    this.#shadowLod = deps.shadowLod;
    this.#blobShadow = deps.blobShadow;
    this.#sphereInstancing = deps.sphereInstancing;
    this.#segmentLineInstancing = deps.segmentLineInstancing;
    this.#projectileSim = deps.projectileSim;
    this.#capsuleDebug = deps.capsuleDebug;
    this.#viewerTeam.onChange(() => {
      this.refreshViewerColors();
    });
  }

  spawn(roster: ShooterPackRoster = {}): void {
    this.clear();
    const spawnPairs = devPlaceholderSpawnPairs(this.#viewerTeam.faction);

    for (const [index, pair] of spawnPairs.entries()) {
      const { matchStart: slot, respawn: respawnSlot } = pair;
      const id = `bot-${slot.faction}-${String(index)}`;
      const bot = new BotActor(
          this.#scene,
          this.#world,
          this.#actorRegistry,
          this.#impactDeps,
          this.#weaponAudio,
          slot,
          respawnSlot,
          this.#viewerTeam,
          id,
          resolveBotShooterPack(roster, id),
          this.#sphereInstancing,
          this.#segmentLineInstancing,
          this.#projectileSim,
          index,
          spawnPairs.length
        );
      this.#shadowLod.register(bot.visual.root);
      this.#blobShadow.register(bot.visual.root, {
        isVisible: () => !bot.controller.health.isDead
      });
      this.#bots.push(bot);
    }
  }

  refreshViewerColors(): void {
    for (const bot of this.#bots) {
      bot.applyViewerColors(this.#viewerTeam);
    }
  }

  flashDamage(actorId: string, nowMs: number): void {
    for (const bot of this.#bots) {
      if (bot.combatActor.id === actorId) {
        bot.visual.flashDamage(nowMs);
        return;
      }
    }
  }

  
  rollSpawnWeapons(): void {
    for (const bot of this.#bots) {
      bot.rollSpawnWeapon();
      this.#shadowLod.refresh(bot.visual.root);
    }
  }

  equipRedeemer(actorId: string): boolean {
    for (const bot of this.#bots) {
      if (bot.combatActor.id !== actorId) {
        continue;
      }

      bot.equipRedeemer();
      this.#shadowLod.refresh(bot.visual.root);
      return true;
    }

    return false;
  }

  suspendAllCombat(nowMs: number): void {
    for (const bot of this.#bots) {
      bot.weapon.suspendCombat(nowMs);
    }
  }

  prepareMatchRestart(nowMs: number): void {
    for (const bot of this.#bots) {
      bot.prepareMatchRestart(nowMs);
    }
  }

  fixedUpdate(fixedStep: number, nowMs: number, context: Omit<BotCombatContext, 'targets'>): void {
    if (!context.matchLive) {
      return;
    }

    const combatContext = this.#bindCombatContext(context);

    for (const bot of this.#bots) {
      bot.fixedUpdate(fixedStep, nowMs, combatContext);
    }
  }

  capturePhysicsInterpolation(): void {
    for (const bot of this.#bots) {
      bot.controller.capturePhysicsInterpolation();
    }
  }

  setRenderInterpolationBlend(blend: number): void {
    for (const bot of this.#bots) {
      bot.controller.setRenderInterpolationBlend(blend);
    }
  }

  
  preparePhysicsFrame(
    deltaSeconds: number,
    nowMs: number,
    context: Omit<BotCombatContext, 'targets'>,
    shedNonCritical = false
  ): void {
    if (!context.matchLive) {
      return;
    }

    this.#syncTargets(context.player);
    const combatContext = this.#bindCombatContext(context);

    for (const bot of this.#bots) {
      bot.preparePhysicsFrame(deltaSeconds, nowMs, combatContext, shedNonCritical);
    }
  }

  
  afterPhysics(): void {
    for (const bot of this.#bots) {
      if (!bot.controller.health.isDead) {
        bot.controller.afterPhysics();
      }
    }
  }

  tickJumpPads(jumpPadField: JumpPadField, nowMs: number): void {
    const bots = this.#bots;
    const scratch = this.#jumpPadBotScratch;
    for (let index = 0; index < bots.length; index += 1) {
      scratch[index] = bots[index].controller;
    }
    scratch.length = bots.length;
    jumpPadField.tickBots(scratch, nowMs);
  }

  
  tickCountdownDrop(deltaSeconds: number, nowMs: number): void {
    for (const bot of this.#bots) {
      bot.tickCountdownDrop(deltaSeconds, nowMs);
    }
  }

  update(deltaSeconds: number, nowMs: number, context: Omit<BotCombatContext, 'targets'>): void {
    if (!context.matchLive) {
      return;
    }

    const combatContext = this.#bindCombatContext(context);

    for (const bot of this.#bots) {
      if (!bot.controller.health.isDead) {
        bot.controller.health.tickRegen(nowMs, deltaSeconds);
      }
      bot.update(deltaSeconds, nowMs, combatContext);
    }
  }

  syncCapsuleDebug(): void {
    for (const bot of this.#bots) {
      this.#capsuleDebug.sync(bot.combatActor.id, bot.controller.collider);
    }
  }

  resolveBot(actorId: string): BotActor | null {
    for (const bot of this.#bots) {
      if (bot.combatActor.id === actorId) {
        return bot;
      }
    }

    return null;
  }

  syncDownedActors(register: (bot: BotActor) => void): void {
    for (const bot of this.#bots) {
      if (!bot.controller.health.isDead) {
        continue;
      }

      register(bot);
    }
  }

  tryAutoRespawn(nowMs: number): void {
    for (const bot of this.#bots) {
      bot.tryAutoRespawn(nowMs);
    }
  }

  clear(): void {
    for (const bot of this.#bots) {
      this.#capsuleDebug.untrack(bot.combatActor.id);
      this.#shadowLod.unregister(bot.visual.root);
      this.#blobShadow.unregister(bot.visual.root);
      bot.dispose(this.#world, this.#actorRegistry);
    }

    this.#bots = [];
  }

  resetVisibilityClock(): void {
    for (const bot of this.#bots) {
      bot.resetVisibilityClock();
    }
  }

  #syncTargets(player: BotCombatContext['player']): void {
    this.#targetSnapshots.syncFromRoster(player, this.#bots);
  }

  #bindCombatContext(context: Omit<BotCombatContext, 'targets'>): BotCombatContext {
    const bound = this.#combatContext as {
      -readonly [K in keyof BotCombatContext]: BotCombatContext[K];
    };
    bound.matchLive = context.matchLive;
    bound.world = context.world;
    bound.registry = context.registry;
    bound.player = context.player;
    return this.#combatContext;
  }
}
