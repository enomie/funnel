// Path: /Users/johann/MyBrew/funnel-real/src/weapon-jsons/weapon-mesh-registry.ts

import type { ProjectileVisualKind } from '../combat/weapon-definitions';
import type { WeaponMeshDefinition } from './weapon-mesh-types';
import bioMesh from './weapon-bio.json';
import flakMesh from './weapon-flak.json';
import gatlingMesh from './weapon-gatling.json';
import pistolMesh from './weapon-pistol.json';
import pulseMesh from './weapon-pulse.json';
import redeemerMesh from './weapon-redeemer.json';
import ripperMesh from './weapon-ripper.json';
import rocketMesh from './weapon-rocket.json';
import shockMesh from './weapon-shock.json';
import sniperMesh from './weapon-sniper.json';

function asWeaponMeshDefinition(value: unknown): WeaponMeshDefinition {
  return value as WeaponMeshDefinition;
}

const WEAPON_MESH_BY_KIND: Record<ProjectileVisualKind, WeaponMeshDefinition> = {
  pistol: asWeaponMeshDefinition(pistolMesh),
  shock: asWeaponMeshDefinition(shockMesh),
  rocket: asWeaponMeshDefinition(rocketMesh),
  ripper: asWeaponMeshDefinition(ripperMesh),
  flak: asWeaponMeshDefinition(flakMesh),
  sniper: asWeaponMeshDefinition(sniperMesh),
  gatling: asWeaponMeshDefinition(gatlingMesh),
  pulse: asWeaponMeshDefinition(pulseMesh),
  bio: asWeaponMeshDefinition(bioMesh),
  redeemer: asWeaponMeshDefinition(redeemerMesh)
};

export function weaponMeshDefinitionFor(visualKind: ProjectileVisualKind): WeaponMeshDefinition {
  return WEAPON_MESH_BY_KIND[visualKind];
}
