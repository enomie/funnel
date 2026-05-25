import type { CombatPointLightPool } from '../render/combat-point-light-pool';

/** In-flight — warm luminous orb. */
export const REDEEMER_FLIGHT_LIGHT_COLOR = 0xfffef0;

/** Redeemer impact flash — blinding white. */
export const REDEEMER_FLASH_LIGHT_COLOR = 0xffffff;

/** Rocket impact flash — hot white-orange (smaller cousin of the nuke). */
export const ROCKET_FLASH_LIGHT_COLOR = 0xfff4e0;

const REDEEMER_FLIGHT_INTENSITY = 128;
const REDEEMER_FLIGHT_DISTANCE_M = 26;
const REDEEMER_FLIGHT_DECAY = 1.72;

const REDEEMER_FLASH_ATTACK_MS = 65;
const REDEEMER_FLASH_PEAK_INTENSITY = 520;
const REDEEMER_FLASH_PEAK_DISTANCE_M = 300;
const REDEEMER_FLASH_DECAY = 1.15;
const REDEEMER_FLASH_FADE_POWER = 0.26;

const ROCKET_FLASH_ATTACK_MS = 55;
const ROCKET_FLASH_DURATION_MS = 480;
const ROCKET_FLASH_PEAK_INTENSITY = 142;
const ROCKET_FLASH_PEAK_DISTANCE_M = 32;
const ROCKET_FLASH_DECAY = 1.55;
const ROCKET_FLASH_FADE_POWER = 0.38;

const EXPLOSIVE_FLASH_CAP = 6;

export interface ExplosivePointLightFlash {
  kind: 'redeemer' | 'rocket';
  slot: number;
  x: number;
  y: number;
  z: number;
  spawnedAtMs: number;
  expandMs: number;
}

/** @deprecated Use ExplosivePointLightFlash */
export type RedeemerPointLightFlash = ExplosivePointLightFlash;

export function tryAcquireRedeemerFlightLight(pool: CombatPointLightPool): number {
  return pool.acquire();
}

export function syncRedeemerFlightLight(
  pool: CombatPointLightPool,
  slot: number,
  x: number,
  y: number,
  z: number
): void {
  pool.sync(
    slot,
    x,
    y,
    z,
    REDEEMER_FLIGHT_LIGHT_COLOR,
    REDEEMER_FLIGHT_INTENSITY,
    REDEEMER_FLIGHT_DISTANCE_M,
    REDEEMER_FLIGHT_DECAY
  );
}

export function releaseRedeemerFlightLight(pool: CombatPointLightPool, slot: number): void {
  pool.release(slot);
}

export function beginRedeemerImpactFlash(
  pool: CombatPointLightPool,
  flashes: ExplosivePointLightFlash[],
  options: {
    flightLightSlot: number;
    x: number;
    y: number;
    z: number;
    spawnedAtMs: number;
    expandMs: number;
  }
): void {
  let slot = options.flightLightSlot;
  if (slot < 0) {
    slot = pool.acquire();
  }
  if (slot < 0) {
    return;
  }

  pushExplosiveFlash(pool, flashes, {
    kind: 'redeemer',
    slot,
    x: options.x,
    y: options.y,
    z: options.z,
    spawnedAtMs: options.spawnedAtMs,
    expandMs: options.expandMs
  });
}

export function beginRocketImpactFlash(
  pool: CombatPointLightPool,
  flashes: ExplosivePointLightFlash[],
  x: number,
  y: number,
  z: number,
  spawnedAtMs: number
): void {
  const slot = pool.acquire();
  if (slot < 0) {
    return;
  }

  pushExplosiveFlash(pool, flashes, {
    kind: 'rocket',
    slot,
    x,
    y,
    z,
    spawnedAtMs,
    expandMs: ROCKET_FLASH_DURATION_MS
  });
}

export function tickExplosiveImpactFlashes(
  pool: CombatPointLightPool,
  flashes: ExplosivePointLightFlash[],
  nowMs: number
): void {
  for (let index = flashes.length - 1; index >= 0; index -= 1) {
    const flash = flashes[index];
    if (tickExplosiveImpactFlash(pool, flash, nowMs)) {
      flashes[index] = flashes[flashes.length - 1];
      flashes.length -= 1;
    }
  }
}

/** @deprecated Use tickExplosiveImpactFlashes */
export function tickRedeemerImpactFlashes(
  pool: CombatPointLightPool,
  flashes: ExplosivePointLightFlash[],
  nowMs: number
): void {
  tickExplosiveImpactFlashes(pool, flashes, nowMs);
}

function pushExplosiveFlash(
  pool: CombatPointLightPool,
  flashes: ExplosivePointLightFlash[],
  flash: ExplosivePointLightFlash
): void {
  while (flashes.length >= EXPLOSIVE_FLASH_CAP) {
    const evicted = flashes[0];
    pool.release(evicted.slot);
    flashes[0] = flashes[flashes.length - 1];
    flashes.length -= 1;
  }
  flashes.push(flash);
}

function tickExplosiveImpactFlash(
  pool: CombatPointLightPool,
  flash: ExplosivePointLightFlash,
  nowMs: number
): boolean {
  const elapsed = nowMs - flash.spawnedAtMs;
  if (elapsed >= flash.expandMs) {
    pool.release(flash.slot);
    return true;
  }

  if (flash.kind === 'rocket') {
    return tickRocketImpactFlash(pool, flash, elapsed);
  }

  return tickRedeemerImpactFlash(pool, flash, elapsed);
}

function tickRedeemerImpactFlash(
  pool: CombatPointLightPool,
  flash: ExplosivePointLightFlash,
  elapsed: number
): boolean {
  let intensity: number;
  let distance: number;

  if (elapsed < REDEEMER_FLASH_ATTACK_MS) {
    const attackT = elapsed / REDEEMER_FLASH_ATTACK_MS;
    const attackEase = attackT * attackT * attackT;
    intensity =
      REDEEMER_FLIGHT_INTENSITY +
      (REDEEMER_FLASH_PEAK_INTENSITY - REDEEMER_FLIGHT_INTENSITY) * attackEase;
    distance =
      REDEEMER_FLIGHT_DISTANCE_M +
      (REDEEMER_FLASH_PEAK_DISTANCE_M - REDEEMER_FLIGHT_DISTANCE_M) * attackEase;
  } else {
    const fadeT = (elapsed - REDEEMER_FLASH_ATTACK_MS) / (flash.expandMs - REDEEMER_FLASH_ATTACK_MS);
    const fadeEase = fadeT ** REDEEMER_FLASH_FADE_POWER;
    intensity = REDEEMER_FLASH_PEAK_INTENSITY * (1 - fadeEase * 0.97);
    distance = REDEEMER_FLASH_PEAK_DISTANCE_M * (1 - fadeEase * 0.1);
  }

  pool.sync(
    flash.slot,
    flash.x,
    flash.y,
    flash.z,
    REDEEMER_FLASH_LIGHT_COLOR,
    intensity,
    distance,
    REDEEMER_FLASH_DECAY
  );
  return false;
}

function tickRocketImpactFlash(
  pool: CombatPointLightPool,
  flash: ExplosivePointLightFlash,
  elapsed: number
): boolean {
  let intensity: number;
  let distance: number;

  if (elapsed < ROCKET_FLASH_ATTACK_MS) {
    const attackT = elapsed / ROCKET_FLASH_ATTACK_MS;
    const attackEase = attackT * attackT * attackT;
    intensity = ROCKET_FLASH_PEAK_INTENSITY * attackEase;
    distance = ROCKET_FLASH_PEAK_DISTANCE_M * attackEase;
  } else {
    const fadeT = (elapsed - ROCKET_FLASH_ATTACK_MS) / (flash.expandMs - ROCKET_FLASH_ATTACK_MS);
    const fadeEase = fadeT ** ROCKET_FLASH_FADE_POWER;
    intensity = ROCKET_FLASH_PEAK_INTENSITY * (1 - fadeEase * 0.96);
    distance = ROCKET_FLASH_PEAK_DISTANCE_M * (1 - fadeEase * 0.35);
  }

  pool.sync(
    flash.slot,
    flash.x,
    flash.y,
    flash.z,
    ROCKET_FLASH_LIGHT_COLOR,
    intensity,
    distance,
    ROCKET_FLASH_DECAY
  );
  return false;
}
