// Path: /Users/johann/MyBrew/funnel-real/src/combat/projectile-visuals.ts

import { Euler, Group, Material, Mesh, Object3D, TorusGeometry } from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { getUnitLowPolySphereGeometry } from '../render/low-poly-sphere-geometry';
import {
  PROJECTILE_GLOW_LAYERS,
  PROJECTILE_OUTER_GLOW_SCALE,
  projectileCoreMaterial,
  projectileGlowLayerMaterial
} from './projectile-materials';
import type { ProjectileVisualKind } from './weapon-definitions';



export const BOLT_PROJECTILE_CROSS_SECTION_M = 0.05;
export const BOLT_PROJECTILE_LENGTH_M = 0.15;

export const ROCKET_PROJECTILE_CROSS_SECTION_M = 0.08;
export const ROCKET_PROJECTILE_LENGTH_M = 0.28;


const PROJECTILE_RADIUS: Record<ProjectileVisualKind, number> = {
  pistol: 0.11,
  shock: 0.34,
  rocket: 0.14,
  ripper: 0.32,
  flak: 0.12,
  sniper: 0.1,
  gatling: 0.075,
  pulse: 0.12,
  bio: 0.3,
  redeemer: 0.46
};


const RIPPER_TORUS = new TorusGeometry(0.32, 0.045, 8, 18);
const RIPPER_MESH_ROTATION = new Euler(Math.PI / 2, 0, 0);


const BIO_CHARGE_PREVIEW_FORWARD_FACTOR = 2.15;
const VIEWMODEL_PREVIEW_RENDER_ORDER = 12;

export function createProjectileVisual(kind: ProjectileVisualKind, color: number): Object3D {
  if (kind === 'ripper') {
    return createRipperCoreVisual(color);
  }

  return createSphereProjectile(kind, color);
}


function bindProjectileMesh(mesh: Mesh, scale: number, rotation?: Euler): void {
  mesh.position.set(0, 0, 0);
  mesh.quaternion.set(0, 0, 0, 1);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.setScalar(scale);
  if (rotation !== undefined) {
    mesh.rotation.copy(rotation);
  }
}

function createProjectileMesh(
  geometry: BufferGeometry,
  material: Material,
  scale: number,
  rotation?: Euler
): Mesh {
  const mesh = new Mesh(geometry, material);
  bindProjectileMesh(mesh, scale, rotation);
  return mesh;
}


export function createRipperCoreVisual(color: number): Object3D {
  const root = new Group();
  root.name = 'projectile-ripper';
  resetProjectileTransform(root);

  root.add(createProjectileMesh(RIPPER_TORUS, projectileCoreMaterial(color), 1, RIPPER_MESH_ROTATION));
  appendGlowShells(root, RIPPER_TORUS, color, 1, RIPPER_MESH_ROTATION, true);
  return root;
}

export function projectileVisualRadius(kind: ProjectileVisualKind): number {
  return PROJECTILE_RADIUS[kind];
}

export function projectileCoreRadius(kind: ProjectileVisualKind, visualScale = 1): number {
  return PROJECTILE_RADIUS[kind] * visualScale;
}

export function projectileGlowRadius(kind: ProjectileVisualKind, visualScale = 1): number {
  return PROJECTILE_RADIUS[kind] * PROJECTILE_OUTER_GLOW_SCALE * visualScale;
}


export function syncMuzzleAttachedPreviewPosition(
  preview: Object3D,
  kind: ProjectileVisualKind,
  visualScale: number,
  firstPerson: boolean
): void {
  const extent = projectileGlowRadius(kind, visualScale);
  const forwardFactor = kind === 'bio' ? BIO_CHARGE_PREVIEW_FORWARD_FACTOR : 1;
  const boreZ = (firstPerson ? -1 : 1) * extent * forwardFactor;
  preview.position.set(0, 0, boreZ);
}


export function resetProjectileTransform(object: Object3D): void {
  object.rotation.set(0, 0, 0);
  object.quaternion.set(0, 0, 0, 1);
  object.scale.set(1, 1, 1);
}


export function configureViewmodelAttachedProjectilePreview(object: Object3D): void {
  object.renderOrder = VIEWMODEL_PREVIEW_RENDER_ORDER;
  object.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }

    node.renderOrder = VIEWMODEL_PREVIEW_RENDER_ORDER;
    if (!(node.material instanceof Material)) {
      return;
    }

    const previewMaterial = node.material.clone();
    previewMaterial.depthTest = false;
    previewMaterial.depthWrite = false;
    node.material = previewMaterial;
  });
}


export function releaseViewmodelAttachedProjectilePreview(preview: Object3D): void {
  preview.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    if (node.material instanceof Material) {
      node.material.dispose();
    }
  });
  preview.removeFromParent();
}

function appendGlowShells(
  root: Object3D,
  geometry: BufferGeometry,
  color: number,
  coreRadius: number,
  rotation?: Euler,
  cloneMaterials = false
): void {
  for (let layerIndex = 0; layerIndex < PROJECTILE_GLOW_LAYERS.length; layerIndex += 1) {
    const layer = PROJECTILE_GLOW_LAYERS[layerIndex];
    const material = cloneMaterials
      ? projectileGlowLayerMaterial(color, layerIndex).clone()
      : projectileGlowLayerMaterial(color, layerIndex);
    const glow = createProjectileMesh(geometry, material, coreRadius * layer.scale, rotation);
    glow.name = `projectile-glow-${String(layerIndex)}`;
    root.add(glow);
  }
}

function createSphereProjectile(kind: ProjectileVisualKind, color: number): Object3D {
  const root = new Group();
  root.name = `projectile-${kind}`;
  resetProjectileTransform(root);

  const coreRadius = PROJECTILE_RADIUS[kind];
  root.add(createProjectileMesh(getUnitLowPolySphereGeometry(), projectileCoreMaterial(color), coreRadius));
  appendGlowShells(root, getUnitLowPolySphereGeometry(), color, coreRadius);
  return root;
}

export function isBoltProjectileKind(kind: ProjectileVisualKind): boolean {
  return kind === 'sniper' || kind === 'shock' || kind === 'rocket';
}

export function boltProjectileDimensions(
  kind: ProjectileVisualKind
): { crossSectionM: number; lengthM: number } {
  if (kind === 'rocket') {
    return {
      crossSectionM: ROCKET_PROJECTILE_CROSS_SECTION_M,
      lengthM: ROCKET_PROJECTILE_LENGTH_M
    };
  }

  return {
    crossSectionM: BOLT_PROJECTILE_CROSS_SECTION_M,
    lengthM: BOLT_PROJECTILE_LENGTH_M
  };
}

export function isInstancedSphereProjectileKind(kind: ProjectileVisualKind): boolean {
  return kind !== 'ripper' && !isBoltProjectileKind(kind);
}
