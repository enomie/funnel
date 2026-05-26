// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-weapon/audio-weapon-bake.ts

import { WEAPON_DEFINITIONS, type FireProfile, type ImpactProfile, type WeaponDefinition } from '../../combat/weapon-definitions';
import { getBakedPhraseCache, type BakedPhrase } from '../audio-baked-phrase';
import { AudioContextEngine } from '../audio-mixer';
import { deriveFireAudioPreset } from './audio-fire-preset';
import { defaultImpactPhraseDuration, scheduleDefaultImpactPhrase } from '../audio-one-shots/audio-impact-default';
import { rocketImpactPhraseDuration, scheduleRocketImpactPhrase } from '../audio-one-shots/audio-impact-rocket';
import { scheduleFirePhrase } from '../audio-one-shots/audio-fire-phrase';
import { sniperFirePhraseDuration } from '../audio-one-shots/audio-fire-sniper';
import { scheduleNoAmmoPhrase, NO_AMMO_PHRASE_DURATION_S } from '../audio-one-shots/audio-no-ammo-phrase';

const FIRE_KEY_PREFIX = 'fire:';
const IMPACT_KEY_PREFIX = 'impact:';
const ROCKET_IMPACT_KEY_PREFIX = 'rocket-impact:';
const NO_AMMO_KEY = 'mechanics:no-ammo';

function fireCacheKey(weapon: WeaponDefinition, fire: FireProfile): string {
  const preset = deriveFireAudioPreset(weapon, fire, weapon.primaryImpact);
  return `${FIRE_KEY_PREFIX}${weapon.visualKind}|${String(fire.fireIntervalMs)}|${String(fire.projectileCount)}|${String(fire.speed)}|${preset.fireBaseHz.toFixed(1)}|${preset.fireDurationS.toFixed(4)}`;
}

function impactCacheKey(weapon: WeaponDefinition, impact: ImpactProfile): string {
  return `${IMPACT_KEY_PREFIX}${weapon.visualKind}|${impact.impactRadius.toFixed(3)}|${impact.directDamage.toFixed(2)}`;
}

function rocketImpactCacheKey(impactRadius: number): string {
  return `${ROCKET_IMPACT_KEY_PREFIX}${impactRadius.toFixed(3)}`;
}

export function getBakedFire(weapon: WeaponDefinition, fire: FireProfile): BakedPhrase | undefined {
  return getBakedPhraseCache().get(fireCacheKey(weapon, fire));
}

export function getBakedImpact(weapon: WeaponDefinition, impact: ImpactProfile): BakedPhrase | undefined {
  if (weapon.visualKind === 'rocket') {
    return getBakedPhraseCache().get(rocketImpactCacheKey(impact.impactRadius));
  }
  return getBakedPhraseCache().get(impactCacheKey(weapon, impact));
}

export function getBakedNoAmmoClick(): BakedPhrase | undefined {
  return getBakedPhraseCache().get(NO_AMMO_KEY);
}

async function ensureFireBake(
  weapon: WeaponDefinition,
  fire: FireProfile,
  sampleRate: number
): Promise<void> {
  const key = fireCacheKey(weapon, fire);
  const cache = getBakedPhraseCache();
  if (cache.has(key)) {
    return;
  }

  const preset = deriveFireAudioPreset(weapon, fire, weapon.primaryImpact);
  const durationS =
    weapon.visualKind === 'sniper'
      ? sniperFirePhraseDuration()
      : scheduleFirePhraseDuration(preset, fire);
  await cache.getOrBake(key, sampleRate, durationS, (context, output) => {
    if (weapon.visualKind === 'sniper') {
      scheduleFirePhrase(context, output, preset, fire, 0, weapon);
      return;
    }
    scheduleFirePhrase(context, output, preset, fire, 0);
  });
}

async function ensureDefaultImpactBake(
  weapon: WeaponDefinition,
  impact: ImpactProfile,
  sampleRate: number
): Promise<void> {
  const key = impactCacheKey(weapon, impact);
  const cache = getBakedPhraseCache();
  if (cache.has(key)) {
    return;
  }

  const durationS = defaultImpactPhraseDuration(weapon, impact);
  await cache.getOrBake(key, sampleRate, durationS, (context, output) => {
    scheduleDefaultImpactPhrase(weapon, impact, 1, 0, context, output);
  });
}

async function ensureRocketImpactBake(impactRadius: number, sampleRate: number): Promise<void> {
  const key = rocketImpactCacheKey(impactRadius);
  const cache = getBakedPhraseCache();
  if (cache.has(key)) {
    return;
  }

  const durationS = rocketImpactPhraseDuration(impactRadius);
  await cache.getOrBake(key, sampleRate, durationS, (context, output) => {
    scheduleRocketImpactPhrase(impactRadius, 1, 0, context, output);
  });
}

async function ensureNoAmmoBake(sampleRate: number): Promise<void> {
  const cache = getBakedPhraseCache();
  if (cache.has(NO_AMMO_KEY)) {
    return;
  }

  await cache.getOrBake(NO_AMMO_KEY, sampleRate, NO_AMMO_PHRASE_DURATION_S, (context, output) => {
    scheduleNoAmmoPhrase(context, output, 0);
  });
}


export async function warmWeaponBakes(): Promise<void> {
  AudioContextEngine.get().resume();
  const sampleRate = AudioContextEngine.get().context.sampleRate;

  const jobs: Promise<void>[] = [ensureNoAmmoBake(sampleRate)];

  for (const weapon of WEAPON_DEFINITIONS) {
    jobs.push(ensureFireBake(weapon, weapon.primary, sampleRate));
    jobs.push(ensureFireBake(weapon, weapon.secondary, sampleRate));

    if (weapon.visualKind === 'rocket') {
      jobs.push(ensureRocketImpactBake(weapon.primaryImpact.impactRadius, sampleRate));
      jobs.push(ensureRocketImpactBake(weapon.secondaryImpact.impactRadius, sampleRate));
    } else {
      jobs.push(ensureDefaultImpactBake(weapon, weapon.primaryImpact, sampleRate));
      jobs.push(ensureDefaultImpactBake(weapon, weapon.secondaryImpact, sampleRate));
    }
  }

  await Promise.all(jobs);
}

function scheduleFirePhraseDuration(
  preset: ReturnType<typeof deriveFireAudioPreset>,
  fire: FireProfile,
  weapon?: WeaponDefinition
): number {
  if (weapon?.visualKind === 'sniper') {
    return sniperFirePhraseDuration();
  }

  let durationS = preset.fireDurationS;
  durationS = Math.max(durationS, preset.fireDurationS * 0.72);
  if (fire.projectileCount > 1) {
    durationS = Math.max(durationS, 0.012 + preset.fireDurationS * 1.1);
  }
  return durationS + 0.02;
}
