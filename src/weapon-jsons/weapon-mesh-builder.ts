import {
  BoxGeometry,
  BufferGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial
} from 'three/webgpu';
import { createRampGeometry } from '../arena/environment-dynamic-shapes';
import type { WeaponDefinition } from '../combat/weapon-definitions';
import type { WeaponMeshDefinition, WeaponMeshPart, WeaponMeshPartStyle } from './weapon-mesh-types';
import { weaponMeshDefinitionFor } from './weapon-mesh-registry';

const WEAPON_EMISSIVE_INTENSITY = 0.16;
const GLOW_EMISSIVE_INTENSITY = 0.8;

const WEAPON_SURFACE = {
  roughness: 0.42,
  metalness: 0.32
} as const;

const BOX_GEOMETRY_CACHE = new Map<string, BoxGeometry>();
const RAMP_GEOMETRY_CACHE = new Map<string, BufferGeometry>();
const MATERIAL_CACHE = new Map<string, MeshStandardMaterial>();

const _partRotation = new Euler();

function boxGeometryKey(size: readonly [number, number, number]): string {
  return `box-${String(size[0])}x${String(size[1])}x${String(size[2])}`;
}

function rampGeometryKey(width: number, height: number, depth: number): string {
  return `ramp-${String(width)}x${String(height)}x${String(depth)}`;
}

function getBoxGeometry(size: readonly [number, number, number]): BoxGeometry {
  const key = boxGeometryKey(size);
  const cached = BOX_GEOMETRY_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const geometry = new BoxGeometry(size[0], size[1], size[2]);
  BOX_GEOMETRY_CACHE.set(key, geometry);
  return geometry;
}

function getRampGeometry(width: number, height: number, depth: number): BufferGeometry {
  const key = rampGeometryKey(width, height, depth);
  const cached = RAMP_GEOMETRY_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const geometry = createRampGeometry(width, height, depth);
  RAMP_GEOMETRY_CACHE.set(key, geometry);
  return geometry;
}

function materialCacheKey(color: number, style: WeaponMeshPartStyle): string {
  return `${color.toString(16)}:${style}`;
}

function weaponPartMaterial(color: number, style: WeaponMeshPartStyle): MeshStandardMaterial {
  const key = materialCacheKey(color, style);
  const cached = MATERIAL_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const material =
    style === 'glow'
      ? new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: GLOW_EMISSIVE_INTENSITY,
          ...WEAPON_SURFACE
        })
      : new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: WEAPON_EMISSIVE_INTENSITY,
          ...WEAPON_SURFACE
        });

  MATERIAL_CACHE.set(key, material);
  return material;
}

function appendWeaponMeshPart(
  root: Group,
  part: WeaponMeshPart,
  color: number,
  visualKind: string,
  partIndex: number
): void {
  const geometry =
    part.kind === 'box'
      ? getBoxGeometry(part.size)
      : getRampGeometry(part.width, part.height, part.depth);

  const mesh = new Mesh(geometry, weaponPartMaterial(color, part.style));
  mesh.name = `${visualKind}-weapon-part-${String(partIndex)}`;
  mesh.position.set(part.position[0], part.position[1], part.position[2]);

  if (part.kind === 'ramp' && part.rotation !== undefined) {
    mesh.rotation.copy(
      _partRotation.set(
        part.rotation[0],
        part.rotation[1],
        part.rotation[2]
      )
    );
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

export function createWeaponMeshFromDefinition(
  weapon: WeaponDefinition,
  meshDefinition: WeaponMeshDefinition
): Group {
  const root = new Group();
  root.name = `${weapon.visualKind}-weapon-mesh`;

  for (let partIndex = 0; partIndex < meshDefinition.parts.length; partIndex += 1) {
    appendWeaponMeshPart(root, meshDefinition.parts[partIndex], weapon.color, weapon.visualKind, partIndex);
  }

  return root;
}

export function createWeaponMesh(weapon: WeaponDefinition): Group {
  return createWeaponMeshFromDefinition(weapon, weaponMeshDefinitionFor(weapon.visualKind));
}
