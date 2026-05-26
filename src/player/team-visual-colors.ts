// Path: /Users/johann/MyBrew/funnel-real/src/player/team-visual-colors.ts

import {
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D
} from 'three/webgpu';
import { JOINT_HIT_FLASH_EMISSIVE_INTENSITY } from '../combat/damage-feedback';
import { deriveTeamHex, type RelativeTeamRole } from '../combat/team-color-derive';
import { HUMANOID_EYE_LEFT, HUMANOID_EYE_RIGHT, refreshHumanoidEyeMaterials } from './humanoid-eye-visual';

const MANNEQUIN_SURFACE = {
  roughness: 0.55,
  metalness: 0.35
} as const;

const SEGMENT_EMISSIVE_INTENSITY = 0.18;

const JOINT_EMISSIVE_INTENSITY = 0.5;

function isJointMesh(mesh: { name: string; material: Material | Material[] }): boolean {
  const meshName = mesh.name.toLowerCase();
  if (meshName.includes('joint')) {
    return true;
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (material.name.toLowerCase().includes('joint')) {
      return true;
    }
  }

  return false;
}

type TeamMaterialSlot =
  | `${RelativeTeamRole}-${'joint' | 'segment'}`
  | `${RelativeTeamRole}-joint-flash`;

const TEAM_MATERIAL_POOL = new Map<TeamMaterialSlot, MeshStandardMaterial>();
const POOLED_TEAM_MATERIALS = new Set<MeshStandardMaterial>();

function teamMaterialSlot(role: RelativeTeamRole, joint: boolean): `${RelativeTeamRole}-${'joint' | 'segment'}` {
  return joint ? `${role}-joint` : `${role}-segment`;
}

function teamJointFlashSlot(role: RelativeTeamRole): `${RelativeTeamRole}-joint-flash` {
  return `${role}-joint-flash`;
}

function createTeamMaterial(
  role: RelativeTeamRole,
  joint: boolean,
  hitFlash = false
): MeshStandardMaterial {
  if (joint) {
    return new MeshStandardMaterial({
      ...MANNEQUIN_SURFACE,
      color: deriveTeamHex(role),
      emissive: deriveTeamHex(role, 'emissiveGlow'),
      emissiveIntensity: hitFlash ? JOINT_HIT_FLASH_EMISSIVE_INTENSITY : JOINT_EMISSIVE_INTENSITY
    });
  }

  return new MeshStandardMaterial({
    ...MANNEQUIN_SURFACE,
    color: deriveTeamHex(role),
    emissive: deriveTeamHex(role, 'emissiveDim'),
    emissiveIntensity: SEGMENT_EMISSIVE_INTENSITY
  });
}

function ensureTeamMaterialPool(): void {
  if (TEAM_MATERIAL_POOL.size > 0) {
    return;
  }

  for (const role of ['ally', 'enemy'] as const) {
    for (const joint of [false, true] as const) {
      const slot = teamMaterialSlot(role, joint);
      const material = createTeamMaterial(role, joint);
      material.name = `team-pool-${slot}`;
      TEAM_MATERIAL_POOL.set(slot, material);
      POOLED_TEAM_MATERIALS.add(material);
    }

    const flashSlot = teamJointFlashSlot(role);
    const flashMaterial = createTeamMaterial(role, true, true);
    flashMaterial.name = `team-pool-${flashSlot}`;
    TEAM_MATERIAL_POOL.set(flashSlot, flashMaterial);
    POOLED_TEAM_MATERIALS.add(flashMaterial);
  }
}

function getTeamMaterial(role: RelativeTeamRole, joint: boolean, hitFlash = false): MeshStandardMaterial {
  ensureTeamMaterialPool();
  const slot = hitFlash ? teamJointFlashSlot(role) : teamMaterialSlot(role, joint);
  const material = TEAM_MATERIAL_POOL.get(slot);
  if (material === undefined) {
    throw new Error(`Missing team material pool slot for ${role} joint=${String(joint)} flash=${String(hitFlash)}`);
  }
  return material;
}

export function getTeamJointMaterial(role: RelativeTeamRole, hitFlash = false): MeshStandardMaterial {
  return getTeamMaterial(role, true, hitFlash);
}

export function isHumanoidEyeMeshName(name: string): boolean {
  return name === HUMANOID_EYE_LEFT || name === HUMANOID_EYE_RIGHT;
}

function releaseMeshMaterial(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (isPooledTeamMaterial(entry)) {
      continue;
    }
    entry.dispose();
  }
}

export function isPooledTeamMaterial(material: Material): boolean {
  return POOLED_TEAM_MATERIALS.has(material as MeshStandardMaterial);
}


export function applyRelativeTeamColors(root: Object3D, role: RelativeTeamRole): void {
  ensureTeamMaterialPool();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    if (isWeaponPlaceholderMesh(object) || isHumanoidEyeMeshName(object.name)) {
      return;
    }

    const mesh = object;
    const nextMaterial = getTeamMaterial(role, isJointMesh(mesh));
    if (mesh.material === nextMaterial) {
      return;
    }

    releaseMeshMaterial(mesh.material as Material | Material[]);
    mesh.material = nextMaterial;
  });

  refreshHumanoidEyeMaterials(root, role);
}

function isWeaponPlaceholderMesh(object: Object3D): boolean {
  if (object.name.endsWith('-weapon-mesh') || object.name.endsWith('-weapon-part')) {
    return true;
  }

  let parent: Object3D | null = object.parent;
  while (parent !== null) {
    if (parent.name === 'bot-weapon-socket' || parent.name.endsWith('-weapon-mesh')) {
      return true;
    }
    parent = parent.parent;
  }

  return object.name.endsWith('-bounds');
}


export function setJointHitFlash(character: Object3D, role: RelativeTeamRole, active: boolean): void {
  const material = getTeamMaterial(role, true, active);
  character.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    if (isJointMesh(object) || isHumanoidEyeMeshName(object.name)) {
      object.material = material;
    }
  });
}
