// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-weapon/audio-fire-preset.ts

import type { FireProfile, ImpactProfile, ProjectileVisualKind, WeaponDefinition } from '../../combat/weapon-definitions';

export interface FireAudioPreset {
  fireBaseHz: number;
  fireHarmonicRatio: number;
  fireDurationS: number;
  fireWave: OscillatorType;
  harmonicWave: OscillatorType;
}

const VISUAL_KIND_ORDER: readonly ProjectileVisualKind[] = [
  'pistol',
  'shock',
  'rocket',
  'ripper',
  'flak',
  'sniper',
  'gatling',
  'pulse',
  'bio',
  'redeemer'
];

const HARMONIC_WAVE_BY_KIND: Record<ProjectileVisualKind, OscillatorType> = {
  pistol: 'square',
  shock: 'sawtooth',
  rocket: 'sawtooth',
  ripper: 'square',
  flak: 'square',
  sniper: 'triangle',
  gatling: 'square',
  pulse: 'sawtooth',
  bio: 'triangle',
  redeemer: 'sawtooth'
};

export function deriveFireAudioPreset(
  weapon: WeaponDefinition,
  fire: FireProfile,
  _impact: ImpactProfile
): FireAudioPreset {
  const kindIndex = Math.max(0, VISUAL_KIND_ORDER.indexOf(weapon.visualKind));
  const rateFactor = Math.min(1.4, 220 / fire.fireIntervalMs);
  const fireBaseHz = 78 + kindIndex * 44 + fire.speed * 0.18;
  const fireDurationS = 0.022 + rateFactor * 0.028 + fire.projectileCount * 0.002;

  return {
    fireBaseHz,
    fireHarmonicRatio: weapon.visualKind === 'shock' ? 3.1 : 2.55 + kindIndex * 0.04,
    fireDurationS,
    fireWave: weapon.visualKind === 'rocket' || weapon.visualKind === 'redeemer' ? 'sawtooth' : 'triangle',
    harmonicWave: HARMONIC_WAVE_BY_KIND[weapon.visualKind]
  };
}
