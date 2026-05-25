// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-one-shots/audio-impact-default.ts

import type { ImpactProfile, WeaponDefinition } from '../../combat/weapon-definitions';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { playNoiseBurst, playSweepOscBurst } from './audio-one-shot-synth';


const IMPACT: Record<
  WeaponDefinition['visualKind'],
  { crack: number; tone: number; body: number }
> = {
  pistol: { crack: 0.74, tone: 218, body: 0.16 },
  shock: { crack: 0.7, tone: 198, body: 0.2 },
  rocket: { crack: 0.78, tone: 108, body: 0.34 },
  ripper: { crack: 0.82, tone: 248, body: 0.1 },
  flak: { crack: 0.76, tone: 132, body: 0.38 },
  sniper: { crack: 0.8, tone: 168, body: 0.14 },
  gatling: { crack: 0.72, tone: 205, body: 0.18 },
  pulse: { crack: 0.68, tone: 188, body: 0.22 },
  bio: { crack: 0.64, tone: 152, body: 0.26 },
  redeemer: { crack: 0.7, tone: 96, body: 0.32 }
};

export interface DefaultImpactSound {
  thumpStartHz: number;
  thumpEndHz: number;
  crackFilterHz: number;
  crackDurationS: number;
  durationS: number;
  crack: number;
  body: number;
}

export function deriveDefaultImpactSound(
  weapon: WeaponDefinition,
  impact: ImpactProfile
): DefaultImpactSound {
  const { crack, tone, body } = IMPACT[weapon.visualKind];
  const radiusBoost = impact.impactRadius * 90;
  const thumpStartHz = tone + radiusBoost;
  const heaviness = impact.impactRadius * 0.45 + impact.directDamage * 0.00014;
  return {
    thumpStartHz,
    thumpEndHz: thumpStartHz * (0.34 + crack * 0.06),
    crackFilterHz: 680 + thumpStartHz * 2.8 + impact.directDamage * 0.35,
    crackDurationS: 0.026 + crack * 0.022 + heaviness * 0.012,
    durationS: 0.048 + heaviness * 0.14,
    crack,
    body: body * (0.55 + impact.impactRadius * 0.55)
  };
}

export function defaultImpactPhraseDuration(weapon: WeaponDefinition, impact: ImpactProfile): number {
  const sound = deriveDefaultImpactSound(weapon, impact);
  return Math.max(sound.durationS, sound.crackDurationS) + 0.02;
}


export function scheduleDefaultImpactPhrase(
  weapon: WeaponDefinition,
  impact: ImpactProfile,
  gainScale: number,
  startTime: number,
  context: BaseAudioContext,
  destination: AudioNode
): number {
  const volume = AUDIO_VOICE_PEAK * gainScale;
  const sound = deriveDefaultImpactSound(weapon, impact);
  const time = startTime;

  playNoiseBurst({
    context,
    destination,
    time,
    durationS: sound.crackDurationS,
    volume: volume * (0.42 + sound.crack * 0.48),
    noiseKey: 'impact-crack',
    filterHz: sound.crackFilterHz,
    filterQ: 1.05 + sound.crack * 0.35,
    attackS: 0.0015
  });

  playSweepOscBurst({
    context,
    destination,
    time,
    startHz: sound.thumpStartHz,
    endHz: sound.thumpEndHz,
    durationS: sound.durationS,
    volume: volume * (0.38 + (1 - sound.crack) * 0.28),
    type: 'sine'
  });

  if (sound.body > 0.08) {
    playSweepOscBurst({
      context,
      destination,
      time,
      startHz: sound.thumpStartHz * 1.65,
      endHz: sound.thumpEndHz * 1.2,
      durationS: sound.durationS * 0.82,
      volume: volume * sound.body * 0.55,
      type: 'triangle',
      lowpassStartHz: sound.thumpStartHz * 3.2,
      lowpassEndHz: sound.thumpEndHz * 1.4
    });
  }

  return defaultImpactPhraseDuration(weapon, impact);
}
