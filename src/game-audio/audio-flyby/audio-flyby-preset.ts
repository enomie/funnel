import type { ProjectileVisualKind, WeaponDefinition } from '../../combat/weapon-definitions';
import { AUDIO_VOICE_PEAK } from '../audio-config';

/** Same fly synth for every projectile — only these two knobs differ per kind. */
const FLYBY: Record<ProjectileVisualKind, { noise: number; tone: number }> = {
  pistol: { noise: 0.38, tone: 168 },
  shock: { noise: 0.3, tone: 200 },
  rocket: { noise: 0.9, tone: 68 },
  ripper: { noise: 0.12, tone: 215 },
  flak: { noise: 0.68, tone: 88 },
  sniper: { noise: 0.25, tone: 235 },
  gatling: { noise: 0.76, tone: 125 },
  pulse: { noise: 0.44, tone: 148 },
  bio: { noise: 0.36, tone: 115 },
  redeemer: { noise: 0.82, tone: 54 }
};

export interface FlybyPreset {
  humHz: number;
  humVolume: number;
  noiseFilterHz: number;
  noiseVolume: number;
  toneSquare: boolean;
}

/** hum + filtered noise loop — timbre from kind; loudness from AUDIO_VOICE_PEAK. */
export function deriveFlybyPreset(
  weapon: WeaponDefinition,
  speed: number,
  _impactRadius: number
): FlybyPreset {
  const { noise, tone } = FLYBY[weapon.visualKind];

  return {
    humHz: tone,
    humVolume: AUDIO_VOICE_PEAK * (1 - noise) * 0.55,
    noiseVolume: AUDIO_VOICE_PEAK * noise * 0.55,
    noiseFilterHz: tone * (2 + noise * 3) + speed * noise,
    toneSquare: noise < 0.22
  };
}
