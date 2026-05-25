// Path: /Users/johann/MyBrew/funnel-real/src/combat/spawn-weapon-roll.ts

import { WEAPON_DEFINITIONS, type WeaponDefinition } from './weapon-definitions';


export const SPAWN_WEAPON_POOL: readonly WeaponDefinition[] = WEAPON_DEFINITIONS.filter(
  (weapon) => weapon.visualKind !== 'redeemer'
);

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}


export function rollSpawnWeapon(seed?: string): WeaponDefinition {
  if (seed === undefined) {
    const index = Math.floor(Math.random() * SPAWN_WEAPON_POOL.length);
    return SPAWN_WEAPON_POOL[index] ?? WEAPON_DEFINITIONS[0];
  }

  const unit = (hashUnit(seed) * 0.65 + Math.random() * 0.35) % 1;
  const index = Math.min(SPAWN_WEAPON_POOL.length - 1, Math.floor(unit * SPAWN_WEAPON_POOL.length));
  return SPAWN_WEAPON_POOL[index] ?? WEAPON_DEFINITIONS[0];
}

export function spawnWeaponSlotIndex(weapon: WeaponDefinition): number {
  const index = WEAPON_DEFINITIONS.findIndex(
    (candidate) => candidate.slotLabel === weapon.slotLabel
  );
  return index >= 0 ? index : 0;
}


export function redeemerWeaponDefinition(): WeaponDefinition {
  for (const weapon of WEAPON_DEFINITIONS) {
    if (weapon.visualKind === 'redeemer') {
      return weapon;
    }
  }
  return WEAPON_DEFINITIONS[WEAPON_DEFINITIONS.length - 1];
}
