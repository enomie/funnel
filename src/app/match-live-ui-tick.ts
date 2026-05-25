// Path: /Users/johann/MyBrew/funnel-real/src/app/match-live-ui-tick.ts

import type { ActorRegistry } from '../combat/actor-registry';
import type { DownedActorIndex } from '../combat/downed-actor-index';
import {
  readSpectatorReviveHireHud,
  type ReviveHireChannel,
  type ReviveHireChannelDeps
} from '../combat/revive-hire-channel';
import { LOCAL_PLAYER_ACTOR_ID } from '../combat/combat-actor';
import type { IntrusionPressureCache } from '../combat/intrusion-pressure-cache';
import type { TeamKillScore } from '../combat/team-kill-score';
import type { TeamMatchPoints } from '../combat/team-match-points';
import {
  tickTeamPresenceScoring,
  type PresenceTickAccumulator
} from '../combat/team-presence-scoring';
import type { TeamRosterCounter } from '../combat/team-roster-count';
import { type FactionTeam } from '../combat/teams';
import type { WeaponArsenal } from '../combat/weapon-arsenal';
import {
  weaponDefinitionForVisualKind,
  type ProjectileVisualKind
} from '../combat/weapon-definitions';
import type { GameEventBus } from '../core/event-bus';
import { playLocalDeathRespawnCountdown } from '../game-audio/audio-grunts/audio-match-narration';
import { playerAutoRespawnCountdownSeconds, playerAutoRespawnDue } from '../player/player-auto-respawn';
import type { PlayerController, PlayerFrame } from '../player/player-controller';
import type { PlayerTeam } from '../player/player-team';
import type { ArenaLighting } from '../render/create-scene';
import type { AmmoHud } from '../ui/ammo-hud';
import type { DeathRespawnHud, DeathKillerDisplay } from '../ui/death-respawn-hud';
import type { HealthHud } from '../ui/health-hud';
import type { TeamHud } from '../ui/team-hud';
import type { ReviveHireHud } from '../ui/revive-hire-hud';
import type { WeaponBarHud } from '../ui/weapon-bar-hud';

function weaponColorToCss(hex: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

function deathKillerDisplay(visualKind: ProjectileVisualKind | null): DeathKillerDisplay | null {
  if (visualKind === null) {
    return null;
  }

  const weapon = weaponDefinitionForVisualKind(visualKind);
  if (weapon === undefined) {
    return null;
  }

  return {
    weaponName: weapon.name,
    weaponColorCss: weaponColorToCss(weapon.color)
  };
}

export interface MatchLiveUiControllerDeps {
  readonly hudRoot: HTMLElement;
  readonly teamHud: TeamHud;
  readonly weaponBarHud: WeaponBarHud;
  readonly ammoHud: AmmoHud;
  readonly healthHud: HealthHud;
  readonly deathRespawnHud: DeathRespawnHud;
  readonly playerTeam: PlayerTeam;
  readonly player: PlayerController;
  readonly weapon: WeaponArsenal;
  readonly teamKillScore: TeamKillScore;
  readonly teamMatchPoints: TeamMatchPoints;
  readonly teamRosterCounter: TeamRosterCounter;
  readonly actorRegistry: ActorRegistry;
  readonly intrusionPressureCache: IntrusionPressureCache;
  readonly presenceTickAccumulator: PresenceTickAccumulator;
  readonly lighting: ArenaLighting;
  readonly gameEvents: GameEventBus;
}

export interface MatchLiveUiTickParams {
  readonly frameNowMs: number;
  readonly deltaSeconds: number;
  readonly renderFrameId: number;
  readonly firstPersonBlend: number;
  readonly frame: PlayerFrame;
  readonly onMatchEnd: (winner: FactionTeam) => void;
}

export interface MatchLiveUiController {
  refreshTeamHud(): void;
  setPlayerKilledByWeapon(kind: ProjectileVisualKind): void;
  clearPlayerKilledByWeapon(): void;
  tick(params: MatchLiveUiTickParams): void;
}

export interface MatchLiveReviveHireTickDeps {
  readonly player: PlayerController;
  readonly reviveHireChannel: ReviveHireChannel;
  readonly reviveHireChannelDeps: ReviveHireChannelDeps;
  readonly reviveHireHud: ReviveHireHud;
  readonly downedActorIndex: DownedActorIndex;
}

export interface MatchLiveReviveHireTickParams {
  readonly frameNowMs: number;
  readonly deltaSeconds: number;
  readonly frameIsDead: boolean;
  readonly reviveChannelHeld: boolean;
  readonly syncDownedBots: () => void;
  readonly tryAutoRespawn: () => void;
}

export function tickMatchLiveReviveHire(
  deps: MatchLiveReviveHireTickDeps,
  params: MatchLiveReviveHireTickParams
): void {
  const { frameNowMs, deltaSeconds, frameIsDead, reviveChannelHeld, syncDownedBots, tryAutoRespawn } =
    params;

  if (reviveChannelHeld || deps.reviveHireChannel.isChanneling) {
    syncDownedBots();
  }

  const deathSnapshotForChannel = deps.player.deathSnapshot;
  const spectatorSnapshot =
    frameIsDead &&
    (deathSnapshotForChannel.applied || deathSnapshotForChannel.diedAtMs > 0)
      ? deathSnapshotForChannel
      : null;
  let reviveHireHudView = readSpectatorReviveHireHud(spectatorSnapshot);
  if (
    deps.reviveHireChannel.mayTick(
      true,
      deps.downedActorIndex.count,
      reviveChannelHeld,
      spectatorSnapshot
    )
  ) {
    reviveHireHudView = deps.reviveHireChannel.tick(
      deps.reviveHireChannelDeps,
      reviveChannelHeld,
      frameNowMs,
      deltaSeconds,
      spectatorSnapshot
    );
  }
  deps.reviveHireHud.update(
    reviveHireHudView.visible,
    reviveHireHudView.mode,
    reviveHireHudView.progress
  );
  tryAutoRespawn();
}

export function createMatchLiveUiController(deps: MatchLiveUiControllerDeps): MatchLiveUiController {
  let lastTeamHudKey = '';
  let lastAimingHud = '';
  let cachedKillerDisplay: DeathKillerDisplay | null = null;
  let lastDeathNarratorSeconds = -1;

  const refreshTeamHud = (): void => {
    const roster = deps.teamRosterCounter.counts;
    const viewerFaction = deps.playerTeam.faction;
    const hudKey = `${viewerFaction}|${String(roster.alpha)}|${String(roster.beta)}|${String(deps.teamKillScore.killsBy('alpha'))}|${String(deps.teamKillScore.killsBy('beta'))}|${String(deps.teamMatchPoints.pointsBy('alpha'))}|${String(deps.teamMatchPoints.pointsBy('beta'))}|${deps.teamMatchPoints.winner ?? ''}`;

    if (hudKey === lastTeamHudKey) {
      return;
    }

    lastTeamHudKey = hudKey;
    deps.teamHud.update(viewerFaction, deps.teamKillScore, roster, deps.teamMatchPoints);
  };

  const tick = (params: MatchLiveUiTickParams): void => {
    const { frameNowMs, deltaSeconds, renderFrameId, firstPersonBlend, frame, onMatchEnd } = params;

    deps.lighting.updateFightFocus(
      deps.intrusionPressureCache.focusFactionForFrame(renderFrameId, deps.actorRegistry)
    );

    const aimingHud = firstPersonBlend > 0.65 ? 'true' : 'false';
    if (aimingHud !== lastAimingHud) {
      lastAimingHud = aimingHud;
      deps.hudRoot.dataset.aiming = aimingHud;
    }

    const presenceResult = tickTeamPresenceScoring(
      deltaSeconds,
      deps.presenceTickAccumulator,
      deps.actorRegistry,
      deps.teamMatchPoints
    );
    if (presenceResult.winner !== null) {
      onMatchEnd(presenceResult.winner);
    } else if (presenceResult.scored) {
      refreshTeamHud();
    }

    deps.weaponBarHud.update(!frame.isDead, deps.weapon.selectedSlotIndex);
    deps.ammoHud.update(deps.weapon.getAmmoHudSnapshot(frameNowMs));
    deps.healthHud.update(
      frame.health,
      deps.player.health.maxHealth,
      frame.shield,
      deps.player.health.maxShield,
      frame.isDead,
      frame.isRegenerating
    );

    const deathSnapshot = deps.player.deathSnapshot;
    if (frame.isDead && deathSnapshot.diedAtMs > 0) {
      const countdownSeconds = playerAutoRespawnCountdownSeconds(frameNowMs, deathSnapshot);
      if (!playerAutoRespawnDue(frameNowMs, deathSnapshot)) {
        deps.deathRespawnHud.update(true, countdownSeconds, cachedKillerDisplay);
        if (countdownSeconds > 0 && countdownSeconds !== lastDeathNarratorSeconds) {
          lastDeathNarratorSeconds = countdownSeconds;
          playLocalDeathRespawnCountdown(countdownSeconds);
        }
      } else {
        lastDeathNarratorSeconds = -1;
        deps.player.respawnAtFaction(deps.playerTeam.faction);
        deps.gameEvents.emit('actor-respawned', {
          actorId: LOCAL_PLAYER_ACTOR_ID,
          faction: deps.playerTeam.faction
        });
        cachedKillerDisplay = null;
        deps.deathRespawnHud.update(false, 0);
        refreshTeamHud();
      }
    } else {
      lastDeathNarratorSeconds = -1;
      deps.deathRespawnHud.update(false, 0);
    }
  };

  return {
    refreshTeamHud,
    setPlayerKilledByWeapon(kind: ProjectileVisualKind): void {
      cachedKillerDisplay = deathKillerDisplay(kind);
    },
    clearPlayerKilledByWeapon(): void {
      cachedKillerDisplay = null;
    },
    tick
  };
}
