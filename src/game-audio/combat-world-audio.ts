// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/combat-world-audio.ts

import { Vector3 } from 'three/webgpu';
import type { ImpactProfile, WeaponDefinition } from '../combat/weapon-definitions';
import { sweepExpiredSpatialOneShots } from './audio-spatial-voice';
import { readAudioListenerPosition } from './audio-system';
import type { WeaponAudio } from './audio-weapon/audio-weapon';

const _listenerScratch = new Vector3();

/** Full gain beyond this distance; closer blasts duck to protect the sfx limiter. */
const EXPLOSION_FULL_GAIN_DISTANCE_M = 22;
const EXPLOSION_MIN_GAIN_SCALE = 0.36;

export function scaleExplosionGainNearListener(position: Vector3, gain: number): number {
  const listener = readAudioListenerPosition(_listenerScratch);
  const distance = listener.distanceTo(position);
  if (distance >= EXPLOSION_FULL_GAIN_DISTANCE_M) {
    return gain;
  }

  const blend = distance / EXPLOSION_FULL_GAIN_DISTANCE_M;
  const scale = EXPLOSION_MIN_GAIN_SCALE + (1 - EXPLOSION_MIN_GAIN_SCALE) * blend;
  return gain * scale;
}

export function isLethalExplosionWeapon(weapon: WeaponDefinition, impact: ImpactProfile): boolean {
  return (
    weapon.visualKind === 'redeemer' ||
    weapon.visualKind === 'rocket' ||
    impact.explodeOnContact ||
    (impact.expandingLethal ?? false) ||
    (impact.lethalSplash ?? false)
  );
}

export function tickCombatWorldAudio(): void {
  // Spatial lease sweep runs in tickGameAudio.
}

export function stabilizeCombatAudioAfterDeath(weaponAudio: WeaponAudio): void {
  weaponAudio.stopReloadMechanics();
  sweepExpiredSpatialOneShots();
}
