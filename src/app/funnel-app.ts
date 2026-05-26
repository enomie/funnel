// Path: /Users/johann/MyBrew/funnel-real/src/app/funnel-app.ts

import { PerspectiveCamera, Vector3, type Scene, type WebGPURenderer } from 'three/webgpu';
import {
  createWeaponAudio,
  bindGameAudioUserGestureResume,
  syncAudioListenerFromCamera,
  warmGameAudio
} from '../game-audio/audio-manager';
import { tickFrameHousekeeping } from '../core/frame-housekeeping';
import { playCountdownNarratorine } from '../game-audio/audio-grunts/audio-match-narration';
import { EnvironmentRainSpawner } from '../arena/environment-rain-spawner';
import { playHitConfirm, playKillConfirm } from '../game-audio/audio-one-shots/audio-hit-confirm';
import { playPickupAt, playRedeemerPickupAt } from '../game-audio/audio-one-shots/audio-pickup';
import { PickupField } from '../arena/pickup-field';
import { RedeemerPickup } from '../arena/redeemer-pickup';
import { JumpPadField } from '../arena/jump-pad-field';
import { createFunnelArena } from '../arena/funnel-arena';
import { TeamSpawnMascots, preloadTeamSpawnMascotModels } from '../arena/team-spawn-mascots';
import { BotRoster } from '../bots/bot-roster';
import type { BotActor } from '../bots/bot-actor';
import { beginNavRayBudgetFrame } from '../bots/bot-nav-ray-budget';
import { beginBotRespawnBudgetFrame } from '../bots/bot-respawn-budget';
import { ActorRegistry } from '../combat/actor-registry';
import {
  commitActorDeath,
  type ActorDeathLifecycleDeps
} from '../combat/actor-death-lifecycle';
import type { ApplyImpactDeps } from '../combat/apply-impact';
import { DownedActorIndex } from '../combat/downed-actor-index';
import { ReviveHireChannel } from '../combat/revive-hire-channel';
import type { ReviveHireChannelComplete, ReviveHireChannelDeps } from '../combat/revive-hire-channel';
import { createCombatActor, LOCAL_PLAYER_ACTOR_ID } from '../combat/combat-actor';
import { PersonalMatchStats } from '../combat/personal-match-stats';
import { TeamKillScore } from '../combat/team-kill-score';
import {
  createPresenceTickAccumulator
} from '../combat/team-presence-scoring';
import { TeamMatchPoints } from '../combat/team-match-points';
import { type FactionTeam } from '../combat/teams';
import { IntrusionPressureCache } from '../combat/intrusion-pressure-cache';
import { TeamRosterCounter } from '../combat/team-roster-count';
import {
  applyCombinedSecondaryIntent,
  applyPrimaryFireIntent,
  fillFireIntentFromInput,
  fillSecondaryHoldFromInput,
  PLAYER_FIRE_INTENT_SCRATCH,
  PLAYER_SECONDARY_HOLD_SCRATCH,
  weaponUsesHoldSecondary
} from '../combat/fire-intent';
import { WeaponArsenal, WEAPON_ARSENAL_PLAYER_BUDGET } from '../combat/weapon-arsenal';
import { redeemerWeaponDefinition } from '../combat/spawn-weapon-roll';
import { WorldProjectileSim } from '../combat/world-projectile-sim';
import { DEBUG_CONFIG } from '../config/game-config';
import { isEnvironmentRainEnabled } from '../arena/environment-rain-waves';
import { GameFrameClock } from '../core/game-frame-clock';
import { GameEventBus } from '../core/event-bus';
import {
  applyPreMatchLookOnly,
  IDLE_INPUT_SNAPSHOT,
  InputState,
  type InputSnapshot
} from '../input/input-state';
import { createRapierRuntime } from '../physics/rapier-world';
import { CapsuleColliderDebugLayer } from '../physics/capsule-collider-debug';
import { PlayerCamera, playerHipFovDeg, weaponZoomLookSensitivityScale } from '../player/player-camera';
import { PlayerController } from '../player/player-controller';
import type { HumanoidRigId } from '../player/humanoid-rig';
import { loadShooterPackCharacter } from '../player/shooter-pack-loader';
import { PlayerVisual } from '../player/player-visual';
import { enterArenaDisplayMode } from '../platform/browser-fullscreen';
import { createRenderer } from '../render/create-renderer';
import { createRenderScene } from '../render/create-scene';
import { BlobShadowController } from '../render/blob-shadow';
import { ShadowLodController } from '../render/shadow-lod';
import { SphereInstancingService } from '../render/sphere-instancing';
import { SegmentLineInstancingService } from '../render/segment-line-instancing';
import { BoltInstancingService } from '../render/bolt-instancing';
import { RocketSmokeTrailInstancingService } from '../render/rocket-smoke-trail-instancing';
import { PlayerTeam } from '../player/player-team';
import { FpsHud } from '../ui/fps-hud';
import { WeaponBarHud } from '../ui/weapon-bar-hud';
import { AmmoHud } from '../ui/ammo-hud';
import { CrosshairHud } from '../ui/crosshair-hud';
import { DamageVignetteHud } from '../ui/damage-vignette-hud';
import { DeathRespawnHud } from '../ui/death-respawn-hud';
import { ReviveHireHud } from '../ui/revive-hire-hud';
import { HealthHud } from '../ui/health-hud';
import { PersonalStatsHud } from '../ui/personal-stats-hud';
import { MATCH_COUNTDOWN_SECONDS, MatchFlowScreen } from '../ui/match-flow-screen';
import { loadAllCharacterSelectPreviews } from '../ui/character-select-loader';
import { runCharacterSelect } from '../ui/character-select-scene';
import { MatchResultScreen } from '../ui/match-result-screen';
import { buildMatchResultSummary } from '../ui/match-result-summary';
import { StatusToast } from '../ui/status-toast';
import { TeamHud } from '../ui/team-hud';
import { getRendererPixelRatio, getRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import { createAppDom } from './dom';
import { createMatchLiveUiController, tickMatchLiveReviveHire } from './match-live-ui-tick';

const _muzzlePosition = new Vector3();
const _inputSnapshot: InputSnapshot = {
  movement: { forward: false, back: false, left: false, right: false },
  jumpPressed: false,
  crouchHeld: false,
  sprintHeld: false,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
  secondaryHeld: false,
  secondaryPressed: false,
  secondaryReleased: false,
  firstPersonView: true,
  yaw: Math.PI,
  pitch: -0.05,
  weaponSlotSelect: null,
  killPressed: false,
  reviveChannelHeld: false,
  teamFlipPressed: false
};

function profileMark(name: string): void {
  if (DEBUG_CONFIG.profileFrameMarks) {
    performance.mark(name);
  }
}

let profileMeasureFrames = 0;

function profileMeasure(name: string, startMark: string, endMark: string): void {
  if (!DEBUG_CONFIG.profileFrameMarks) {
    return;
  }

  performance.measure(name, startMark, endMark);
  profileMeasureFrames += 1;
  if (profileMeasureFrames >= 600) {
    profileMeasureFrames = 0;
    performance.clearMarks();
    performance.clearMeasures();
  }
}

export async function startFunnelApp(root: HTMLDivElement): Promise<void> {
  const dom = createAppDom(root);
  const matchFlow = new MatchFlowScreen({
    preMatchHost: dom.preMatchHost,
    shell: dom.shell
  });

  matchFlow.beginFromHomeNavigation();
  matchFlow.beginBootLoading();

  matchFlow.setLoadingProgress(5, 'Starting WebGPU…');
  const renderer = await createRenderer(dom.canvas);

  const rigLabels: Record<HumanoidRigId, string> = {
    'y-bot': 'Y-Bot',
    'x-bot': 'X-Bot'
  };
  const previews = await loadAllCharacterSelectPreviews((loaded, total, rigId) => {
    const percent = 15 + Math.round((loaded / total) * 50);
    matchFlow.setLoadingProgress(percent, `Loading ${rigLabels[rigId]}…`);
  });

  matchFlow.setLoadingProgress(85, 'Preparing selection…');
  const selectedRig = await runCharacterSelect(
    {
      canvas: dom.canvas,
      renderer,
      matchFlow
    },
    previews
  );

  matchFlow.setLoadingProgress(10, 'Starting physics…');
  const { scene, camera, lighting } = createRenderScene();
  const capsuleDebug = new CapsuleColliderDebugLayer(scene);
  const { world, eventQueue } = await createRapierRuntime();

  matchFlow.setLoadingProgress(25, 'Preparing audio…');
  await warmGameAudio();

  matchFlow.setLoadingProgress(40, 'Building arena…');
  const arena = createFunnelArena(scene, world);
  const jumpPadField = new JumpPadField({ scene });

  const toast = new StatusToast(dom.status);
  const input = new InputState(dom.canvas);
  const visual = new PlayerVisual(scene);
  const playerTeam = new PlayerTeam();
  const gameEvents = new GameEventBus();
  const teamKillScore = new TeamKillScore();
  const personalMatchStats = new PersonalMatchStats();
  const teamMatchPoints = new TeamMatchPoints();
  const actorRegistry = new ActorRegistry();
  const weaponAudio = createWeaponAudio();
  const deathRuntime: {
    player: PlayerController | null;
    weapon: WeaponArsenal | null;
    botRoster: BotRoster | null;
  } = {
    player: null,
    weapon: null,
    botRoster: null
  };

  const deathLifecycle: ActorDeathLifecycleDeps = {
    bus: gameEvents,
    weaponAudio,
    isLocalPlayer: (actorId) => actorId === LOCAL_PLAYER_ACTOR_ID,
    resolveWeapon: (actorId) => {
      if (actorId === LOCAL_PLAYER_ACTOR_ID) {
        return deathRuntime.weapon ?? undefined;
      }

      return deathRuntime.botRoster?.resolveBot(actorId)?.weapon;
    },
    onActorDeathPhysics: (actorId, nowMs) => {
      if (actorId === LOCAL_PLAYER_ACTOR_ID) {
        deathRuntime.player?.applyDeathCommit(nowMs);
        return;
      }

      deathRuntime.botRoster?.resolveBot(actorId)?.controller.syncDeathState(nowMs);
    }
  };

  const impactDeps: ApplyImpactDeps = {
    registry: actorRegistry,
    bus: gameEvents,
    world,
    deathLifecycle
  };

  const shadowLod = new ShadowLodController();
  const blobShadow = new BlobShadowController(scene);
  const sphereInstancing = new SphereInstancingService(scene);
  const segmentLineInstancing = new SegmentLineInstancingService(scene);
  const boltInstancing = new BoltInstancingService(scene);
  const rocketSmokeTrailInstancing = new RocketSmokeTrailInstancingService(scene, camera);
  const projectileSim = new WorldProjectileSim(
    scene,
    world,
    impactDeps,
    weaponAudio,
    sphereInstancing,
    segmentLineInstancing,
    boltInstancing,
    rocketSmokeTrailInstancing
  );
  deathRuntime.botRoster = new BotRoster(scene, world, playerTeam, actorRegistry, {
    impactDeps,
    weaponAudio,
    shadowLod,
    blobShadow,
    sphereInstancing,
    segmentLineInstancing,
    projectileSim,
    capsuleDebug
  });
  const botRoster = deathRuntime.botRoster;
  const teamSpawnMascots = new TeamSpawnMascots(scene, playerTeam);

  matchFlow.setLoadingProgress(55, 'Loading gameplay animations…');
  const alternateRig: HumanoidRigId = selectedRig === 'y-bot' ? 'x-bot' : 'y-bot';
  try {
    const [playerPack, alternatePack] = await Promise.all([
      loadShooterPackCharacter(selectedRig),
      loadShooterPackCharacter(alternateRig)
    ]);
    visual.mountShooterPack(playerPack);
    shadowLod.register(visual.root, { alwaysFull: true });
    matchFlow.setLoadingProgress(72, 'Preparing mascots…');
    await preloadTeamSpawnMascotModels();
    matchFlow.setLoadingProgress(75, 'Spawning bots…');
    botRoster.spawn({
      [selectedRig]: playerPack,
      [alternateRig]: alternatePack
    });
    teamSpawnMascots.spawn();
  } catch (error) {
    visual.useFallbackMesh();
    shadowLod.register(visual.root, { alwaysFull: true });
    matchFlow.setLoadingProgress(72, 'Preparing mascots…');
    await preloadTeamSpawnMascotModels();
    matchFlow.setLoadingProgress(75, 'Spawning bots…');
    botRoster.spawn();
    teamSpawnMascots.spawn();
    toast.show(
      `Shooter-Pack character could not be loaded, fallback player is active: ${String(error)}`,
      5200
    );
  }

  matchFlow.setLoadingProgress(90, 'Wiring combat…');
  const teamHud = new TeamHud({
    ownBadge: dom.teamOwnBadge,
    ownLabel: dom.teamOwnLabel,
    ownMembers: dom.teamOwnMembers,
    ownKills: dom.teamOwnKills,
    ownPoints: dom.teamOwnPoints,
    enemyBadge: dom.teamEnemyBadge,
    enemyLabel: dom.teamEnemyLabel,
    enemyMembers: dom.teamEnemyMembers,
    enemyKills: dom.teamEnemyKills,
    enemyPoints: dom.teamEnemyPoints
  });
  let matchLive = false;
  const presenceTickAccumulator = createPresenceTickAccumulator();
  const teamRosterCounter = new TeamRosterCounter();

  const crosshairHud = new CrosshairHud(dom.crosshair);
  const fpsHud = new FpsHud({
    root: dom.fpsHud,
    value: dom.fpsValue,
    canvas: dom.fpsCanvas
  });
  const damageVignetteHud = new DamageVignetteHud(dom.damageVignette);
  gameEvents.on('actor-damaged', (event) => {
    if (event.actorId === LOCAL_PLAYER_ACTOR_ID) {
      damageVignetteHud.flash(event.amount);
      visual.flashDamage(event.nowMs);
    } else {
      botRoster.flashDamage(event.actorId, event.nowMs);
    }
    if (event.sourceActorId === LOCAL_PLAYER_ACTOR_ID && event.actorId !== LOCAL_PLAYER_ACTOR_ID) {
      crosshairHud.flashHit();
      if (event.remaining > 0) {
        playHitConfirm();
      }
    }
  });
  const weaponBarHud = new WeaponBarHud({ root: dom.weaponBar });
  const ammoHud = new AmmoHud({
    root: dom.ammoHud,
    weaponName: dom.ammoWeaponName,
    count: dom.ammoCount,
    magazine: dom.ammoMagazine,
    reloadFill: dom.ammoReloadFill
  });
  const healthHud = new HealthHud({
    root: dom.healthHud,
    shieldFill: dom.shieldFill,
    healthFill: dom.healthFill
  });
  const personalStatsHud = new PersonalStatsHud({
    root: dom.personalStatsHud,
    kills: dom.personalStatsKills,
    deaths: dom.personalStatsDeaths,
    kdRatio: dom.personalStatsKdRatio
  });
  const deathRespawnHud = new DeathRespawnHud({ shell: dom.shell });
  const reviveHireHud = new ReviveHireHud({ shell: dom.shell });
  const downedActorIndex = new DownedActorIndex();
  const reviveHireChannel = new ReviveHireChannel();
  const matchResultScreen = new MatchResultScreen({ shell: dom.shell });
  deathRuntime.player = new PlayerController(world, visual);
  const player = deathRuntime.player;
  blobShadow.register(visual.root, {
    isVisible: () => !player.health.isDead && !input.isFirstPersonView
  });
  const localPlayerActor = createCombatActor({
    id: LOCAL_PLAYER_ACTOR_ID,
    kind: 'player',
    faction: playerTeam.faction,
    health: player.health,
    body: player.body,
    colliders: [player.collider]
  });
  actorRegistry.register(localPlayerActor);
  teamRosterCounter.rebuild(actorRegistry);
  const playerCamera = new PlayerCamera(camera, world, player.collider, scene);
  playerCamera.attachViewmodel(
    visual.root,
    visual.weaponSocket,
    visual.muzzleSocket,
    () => visual.muzzleOffsetThirdPerson(),
    () => visual.muzzleOffsetFirstPerson()
  );
  deathRuntime.weapon = new WeaponArsenal(scene, world, player.body, weaponAudio, impactDeps, () => playerTeam.faction, LOCAL_PLAYER_ACTOR_ID, visual.muzzleSocket, projectileSim, WEAPON_ARSENAL_PLAYER_BUDGET, sphereInstancing, segmentLineInstancing);
  const weapon = deathRuntime.weapon;
  const intrusionPressureCache = new IntrusionPressureCache();
  const matchLiveUi = createMatchLiveUiController({
    hudRoot: dom.hud,
    teamHud,
    weaponBarHud,
    ammoHud,
    healthHud,
    deathRespawnHud,
    playerTeam,
    player,
    weapon,
    teamKillScore,
    teamMatchPoints,
    teamRosterCounter,
    actorRegistry,
    intrusionPressureCache,
    presenceTickAccumulator,
    lighting,
    gameEvents
  });

  playerTeam.onChange((event) => {
    localPlayerActor.setFaction(playerTeam.faction);
    if (!player.health.isDead) {
      teamRosterCounter.onFactionChange(LOCAL_PLAYER_ACTOR_ID, event.previousTeam, event.team);
      matchLiveUi.refreshTeamHud();
    }
    if (event.reason !== 'spawn' && matchLive && !player.health.isDead) {
      player.spawnAtFaction(playerTeam.faction);
    }
  });

  const registerDownedFromBot = (bot: BotActor): void => {
    downedActorIndex.add({
      actorId: bot.combatActor.id,
      actor: bot.combatActor,
      deathSnapshot: bot.controller.deathSnapshot
    });
  };

  const registerDownedActor = (actorId: string): void => {
    if (actorId === LOCAL_PLAYER_ACTOR_ID) {
      downedActorIndex.add({
        actorId,
        actor: localPlayerActor,
        deathSnapshot: player.deathSnapshot
      });
      return;
    }

    const bot = botRoster.resolveBot(actorId);
    if (bot !== null) {
      registerDownedFromBot(bot);
    }
  };

  const completeReviveHire = (result: ReviveHireChannelComplete): void => {
    const { mode, targetActorId, targetActor } = result;
    if (targetActorId === LOCAL_PLAYER_ACTOR_ID) {
      player.reviveInPlace();
      gameEvents.emit('actor-revived', {
        actorId: targetActorId,
        faction: playerTeam.faction,
        reviverId: LOCAL_PLAYER_ACTOR_ID
      });
      matchLiveUi.clearPlayerKilledByWeapon();
      deathRespawnHud.update(false, 0);
      return;
    }

    const bot = botRoster.resolveBot(targetActorId);
    if (bot === null) {
      return;
    }

    if (mode === 'hire') {
      const previousFaction = targetActor.getFaction();
      const newFaction = playerTeam.faction;
      bot.hireInPlace(newFaction, playerTeam);
      gameEvents.emit('actor-hired', {
        actorId: targetActorId,
        previousFaction,
        newFaction,
        hirerId: LOCAL_PLAYER_ACTOR_ID
      });
      return;
    }

    bot.reviveInPlace();
    gameEvents.emit('actor-revived', {
      actorId: targetActorId,
      faction: bot.combatActor.getFaction(),
      reviverId: LOCAL_PLAYER_ACTOR_ID
    });
  };

  const reviveHireChannelDeps: ReviveHireChannelDeps = {
    channelerId: LOCAL_PLAYER_ACTOR_ID,
    getChannelerFaction: () => playerTeam.faction,
    downedIndex: downedActorIndex,
    channelerBody: player.body,
    isChannelerEligible: () => matchLive && !player.health.isDead && !weapon.isRedeemerGuidedActive(),
    onComplete: completeReviveHire
  };

  let lastFrameNowMs = 0;

  gameEvents.on('actor-died', (event) => {
    if (event.actorId === LOCAL_PLAYER_ACTOR_ID && event.sourceWeaponVisualKind !== undefined) {
      matchLiveUi.setPlayerKilledByWeapon(event.sourceWeaponVisualKind);
    }
    if (event.sourceActorId === LOCAL_PLAYER_ACTOR_ID && event.actorId !== LOCAL_PLAYER_ACTOR_ID) {
      crosshairHud.flashKill();
      playKillConfirm();
    }
    teamRosterCounter.onDeath(event.actorId, event.faction);
    personalMatchStats.recordActorDied(event);
    personalStatsHud.update(personalMatchStats);
    teamKillScore.recordKill(event.sourceFaction, event.faction);
    teamMatchPoints.recordCrossFactionKill(event.sourceFaction, event.faction);
    matchLiveUi.refreshTeamHud();
    registerDownedActor(event.actorId);
    const winner = teamMatchPoints.winner;
    if (winner !== null) {
      endMatch(winner);
    }
  });
  gameEvents.on('actor-respawned', (event) => {
    if (event.actorId === LOCAL_PLAYER_ACTOR_ID) {
      matchLiveUi.clearPlayerKilledByWeapon();
    }
    downedActorIndex.remove(event.actorId);
    teamRosterCounter.onRevive(event.actorId, event.faction);
    matchLiveUi.refreshTeamHud();
  });
  gameEvents.on('actor-revived', (event) => {
    if (event.actorId === LOCAL_PLAYER_ACTOR_ID) {
      matchLiveUi.clearPlayerKilledByWeapon();
    }
    downedActorIndex.remove(event.actorId);
    teamRosterCounter.onRevive(event.actorId, event.faction);
    matchLiveUi.refreshTeamHud();
  });
  gameEvents.on('actor-hired', (event) => {
    downedActorIndex.remove(event.actorId);
    teamRosterCounter.onHired(event.actorId, event.previousFaction, event.newFaction);
    matchLiveUi.refreshTeamHud();
  });
  const pickupField = new PickupField({
    scene,
    world,
    registry: actorRegistry,
    onCollected: (kind, origin) => {
      playPickupAt(origin, kind);
    }
  });
  const redeemerPickup = new RedeemerPickup({
    scene,
    registry: actorRegistry,
    onCollected: (collector, origin) => {
      playRedeemerPickupAt(origin);
      if (collector.id === LOCAL_PLAYER_ACTOR_ID) {
        visual.setWeapon(weapon.equipWeapon(redeemerWeaponDefinition()));
        toast.show('Redeemer acquired.', 1200);
        return;
      }

      botRoster.equipRedeemer(collector.id);
    }
  });
  const playerSnapshot = {
    x: 0,
    y: 0,
    z: 0,
    faction: playerTeam.faction,
    isDead: false,
    body: player.body,
    colliders: [player.collider] as const
  };
  const botContextBase = {
    matchLive: false,
    world,
    registry: actorRegistry,
    player: playerSnapshot
  };

  matchFlow.setLoadingProgress(95, 'Finalizing…');
  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer(renderer, dom.canvas, camera);
  });
  resizeObserver.observe(dom.shell);
  resizeRenderer(renderer, dom.canvas, camera);
  playerTeam.assign(playerTeam.faction, 'spawn');
  matchLiveUi.refreshTeamHud();

  matchFlow.setLoadingProgress(100, 'Ready');
  player.setMovementLocked(true);

  let rainActive = false;
  let introDropActive = false;

  const endMatch = (winnerFaction: FactionTeam): void => {
    if (!matchLive) {
      return;
    }

    matchLive = false;
    player.setMovementLocked(true);
    lighting.updateFightFocus(null);
    matchLiveUi.refreshTeamHud();
    reviveHireChannel.abortAll(lastFrameNowMs);
    reviveHireHud.update(false, null, 0);
    deathRespawnHud.update(false, 0);
    matchFlow.setMatchPhase('ended');
    matchResultScreen.show(
      buildMatchResultSummary(
        playerTeam.faction,
        winnerFaction,
        personalMatchStats,
        teamKillScore,
        teamMatchPoints
      )
    );
    void matchResultScreen.waitForNewMatch();
  };

  matchFlow.revealMap();
  resizeRenderer(renderer, dom.canvas, camera);
  player.beginMatchStartDrop(playerTeam.faction);
  introDropActive = true;
  input.connect();
  bindGameAudioUserGestureResume(dom.canvas);
  enterArenaDisplayMode(dom.canvas);

  
  primeArenaFrame(renderer, scene, camera);

  const frameClock = new GameFrameClock(getRuntimeProfile().physicsMaxSubSteps);
  const rainSpawner = isEnvironmentRainEnabled()
    ? new EnvironmentRainSpawner({
        instances: arena.dynamicInstances,
        world,
        dynamicBodies: arena.dynamicBodies
      })
    : undefined;

  frameClock.setVisibilityResetHandler(() => {
    botRoster.resetVisibilityClock();
  });

  void renderer.setAnimationLoop((now) => {
    const renderTick = frameClock.beginRenderFrame(now);
    if (renderTick === null) {
      return;
    }

    const { deltaSeconds, nowMs: frameNowMs, frameId: renderFrameId } = renderTick;
    lastFrameNowMs = frameNowMs;
    actorRegistry.beginFrame(renderFrameId);
    beginNavRayBudgetFrame();
    beginBotRespawnBudgetFrame();

    botContextBase.matchLive = matchLive;
    if (rainActive && rainSpawner !== undefined) {
      rainSpawner.tick(deltaSeconds);
      if (rainSpawner.isComplete()) {
        rainActive = false;
        pickupField.begin();
      }
    }
    if (matchLive && !player.health.isDead) {
      player.health.tickRegen(frameNowMs, deltaSeconds);
    }

    let snapshot: InputSnapshot;
    if (matchLive) {
      snapshot = input.snapshot(_inputSnapshot);
    } else if (introDropActive) {
      snapshot = applyPreMatchLookOnly(input.snapshot(_inputSnapshot));
    } else {
      snapshot = IDLE_INPUT_SNAPSHOT;
    }
    const redeemerGuided = weapon.isRedeemerGuidedActive();
    player.setMovementLocked(!matchLive || redeemerGuided);
    player.beginFrame(snapshot, frameNowMs);

    if (
      player.health.isDead &&
      !player.deathSnapshot.applied &&
      snapshot.killPressed
    ) {
      commitActorDeath(deathLifecycle, {
        actorId: LOCAL_PLAYER_ACTOR_ID,
        faction: playerTeam.faction,
        nowMs: frameNowMs,
        sourceFaction: playerTeam.faction,
        sourceActorId: LOCAL_PLAYER_ACTOR_ID
      });
    }

    if (matchLive && snapshot.teamFlipPressed) {
      playerTeam.flip('dev');
      matchLiveUi.refreshTeamHud();
      toast.show(`Faction flip — now ${playerTeam.definition.label}.`, 1400);
    }

    frameClock.accumulatePhysics(deltaSeconds);
    const playerTranslation = player.body.translation();
    playerSnapshot.x = playerTranslation.x;
    playerSnapshot.y = playerTranslation.y;
    playerSnapshot.z = playerTranslation.z;
    playerSnapshot.faction = playerTeam.faction;
    playerSnapshot.isDead = player.health.isDead;
    profileMark('funnel-physics-start');
    const physicsBatch = frameClock.consumePhysicsSteps((step) => {
      player.fixedUpdate(step, snapshot);
      botRoster.fixedUpdate(step, frameNowMs, botContextBase);
      world.step(eventQueue);
      player.capturePhysicsInterpolation();
      botRoster.capturePhysicsInterpolation();
      arena.dynamicInstances.capturePhysicsInterpolation();
    });
    botRoster.preparePhysicsFrame(
      deltaSeconds,
      frameNowMs,
      botContextBase,
      physicsBatch.loadShedNonCritical
    );
    const renderInterpolationBlend = frameClock.renderInterpolationBlend(physicsBatch.subSteps);
    player.setRenderInterpolationBlend(renderInterpolationBlend);
    botRoster.setRenderInterpolationBlend(renderInterpolationBlend);
    arena.dynamicInstances.setRenderInterpolationBlend(renderInterpolationBlend);
    profileMark('funnel-physics-end');
    profileMeasure('funnel-physics', 'funnel-physics-start', 'funnel-physics-end');

    eventQueue.drainContactForceEvents((event) => {
      player.handleContactForceEvent(event, frameNowMs);
    });

    player.afterPhysics();
    botRoster.afterPhysics();
    if (!player.health.isDead) {
      jumpPadField.tickPlayer(player, snapshot, frameNowMs);
    }
    if (matchLive) {
      botRoster.tickJumpPads(jumpPadField, frameNowMs);
    }
    if (introDropActive) {
      botRoster.tickCountdownDrop(deltaSeconds, frameNowMs);
    }
    if (DEBUG_CONFIG.showCapsuleColliders) {
      capsuleDebug.sync(LOCAL_PLAYER_ACTOR_ID, player.collider);
      botRoster.syncCapsuleDebug();
    }
    profileMark('funnel-bots-start');
    const frame = player.finishFrame(deltaSeconds, snapshot, weapon, () => {
      visual.setWeapon(weapon.equipSpawnWeapon());
    });
    botRoster.update(deltaSeconds, frameNowMs, botContextBase);
    const reviveChannelHeld = input.reviveChannelHeldNow();
    if (matchLive) {
      tickMatchLiveReviveHire(
        {
          player,
          reviveHireChannel,
          reviveHireChannelDeps,
          reviveHireHud,
          downedActorIndex
        },
        {
          frameNowMs,
          deltaSeconds,
          frameIsDead: frame.isDead,
          reviveChannelHeld,
          syncDownedBots: () => {
            botRoster.syncDownedActors(registerDownedFromBot);
          },
          tryAutoRespawn: () => {
            botRoster.tryAutoRespawn(frameNowMs);
          }
        }
      );
    }
    profileMark('funnel-bots-end');
    profileMeasure('funnel-bots', 'funnel-bots-start', 'funnel-bots-end');
    const selectedWeapon = weapon.selectedWeapon;
    const sniperZoom =
      matchLive &&
      !redeemerGuided &&
      snapshot.secondaryHeld &&
      selectedWeapon.sniperZoomFovScale !== undefined
        ? selectedWeapon.sniperZoomFovScale
        : 1;
    playerCamera.setWeaponZoomFovScale(sniperZoom);
    input.setLookSensitivityScale(
      weaponZoomLookSensitivityScale(sniperZoom, playerHipFovDeg(snapshot.firstPersonView))
    );

    playerCamera.setGuidedOverride(weapon.resolveGuidedRedeemerCamera());

    const cameraFrame = playerCamera.update(frame, deltaSeconds);
    const cameraVectors = cameraFrame.vectors;
    syncAudioListenerFromCamera(cameraVectors);
    visual.syncThirdPersonWeaponStance(frame.crouching, cameraFrame.firstPersonBlend);
    visual.updateCameraPresentation(cameraFrame.firstPersonBlend);
    visual.updateAimSpine(frame.pitch, cameraFrame.firstPersonBlend, frame.isDead);
    lighting.updateShadowFocus(frame.position.x, frame.position.z);
    shadowLod.update(frame.position.x, frame.position.y, frame.position.z);
    blobShadow.update(frame.position.x, frame.position.y, frame.position.z);
    if (matchLive) {
      matchLiveUi.tick({
        frameNowMs,
        deltaSeconds,
        renderFrameId,
        firstPersonBlend: cameraFrame.firstPersonBlend,
        frame,
        onMatchEnd: endMatch
      });
    }

    arena.dynamicInstances.sync();
    if (matchLive || pickupField.isStarted) {
      pickupField.tick();
    }
    if (matchLive || redeemerPickup.isStarted) {
      redeemerPickup.tick(frameNowMs, deltaSeconds);
    }

    if (matchLive && !frame.isDead && !reviveHireChannel.isChanneling) {
      if (snapshot.weaponSlotSelect !== null && weapon.selectSlot(snapshot.weaponSlotSelect)) {
        visual.setWeapon(weapon.selectedWeapon);
        toast.show(`Selected ${weapon.selectedWeaponLabel}.`, 900);
      }

      const muzzlePosition = playerCamera.resolveMuzzleWorldPosition(_muzzlePosition, cameraVectors);
      weapon.trackMechanicsAudioOrigin(muzzlePosition);
      const fireIntent = fillFireIntentFromInput(snapshot, selectedWeapon, PLAYER_FIRE_INTENT_SCRATCH);
      const hold = fillSecondaryHoldFromInput(snapshot, selectedWeapon, PLAYER_SECONDARY_HOLD_SCRATCH);
      const holdBlocksPrimary =
        weaponUsesHoldSecondary(selectedWeapon) &&
        (hold.held ||
          hold.pressed ||
          weapon.isBioChargeHolding() ||
          weapon.isRocketMarking() ||
          weapon.isRocketVolleyPending());

      if (!redeemerGuided && !holdBlocksPrimary) {
        applyPrimaryFireIntent(
          weapon,
          fireIntent,
          frameNowMs,
          muzzlePosition,
          cameraVectors.direction,
          matchLive
        );
      }

      if (!redeemerGuided) {
        applyCombinedSecondaryIntent(
          weapon,
          fireIntent,
          hold,
          frameNowMs,
          muzzlePosition,
          cameraVectors.direction,
          matchLive,
          cameraFrame.firstPersonBlend > 0.5
        );
      }

      if (weapon.needsMechanicsAudioTick(frameNowMs)) {
        weapon.tickMechanicsAudio(frameNowMs);
      }
    }

    profileMark('funnel-effects-start');
    tickFrameHousekeeping(frameNowMs, deltaSeconds, physicsBatch.loadShedNonCritical, {
      segmentLineInstancing
    });
    profileMark('funnel-effects-end');
    profileMeasure('funnel-effects', 'funnel-effects-start', 'funnel-effects-end');
    renderer.render(scene, camera);
    const loopWallMs = performance.now() - now;
    frameClock.recordFrameWallMs(loopWallMs);
    fpsHud.tick(loopWallMs, frameNowMs);
  });

  await waitNextAnimationFrame();
  primeArenaFrame(renderer, scene, camera);

  if (rainSpawner !== undefined) {
    rainSpawner.start();
    rainActive = true;
  }

  await matchFlow.runCountdown(MATCH_COUNTDOWN_SECONDS, playCountdownNarratorine);
  introDropActive = false;
  matchFlow.dismissCountdown();
  enterArenaDisplayMode(dom.canvas);
  dom.hud.style.visibility = 'visible';
  matchLive = true;
  if (rainSpawner === undefined) {
    pickupField.begin();
  }
  redeemerPickup.begin();
  player.setMovementLocked(false);
  botRoster.rollSpawnWeapons();
  visual.setWeapon(weapon.equipSpawnWeapon());
  shadowLod.refresh(visual.root);
  toast.show('Match live.');
}

function resizeRenderer(
  renderer: WebGPURenderer,
  canvas: HTMLCanvasElement,
  camera: { aspect: number; updateProjectionMatrix: () => void }
): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  renderer.setPixelRatio(getRendererPixelRatio());
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function primeArenaFrame(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera): void {
  renderer.render(scene, camera);
}

function waitNextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
