import {
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from 'three/webgpu';
import type { ProjectileVisualKind } from './weapon-definitions';

const PROJECTILE_FORWARD = new Vector3(0, 1, 0);
const MATERIAL_CACHE = new Map<number, MeshBasicMaterial>();
const GLOW_MATERIAL_CACHE = new Map<number, MeshBasicMaterial>();
const GLOW_GEOMETRY = new SphereGeometry(0.34, 10, 8);
const DEFAULT_GLOW_SCALE = new Vector3(1.12, 1.12, 1.12);

const GEOMETRY = {
  pistol: new SphereGeometry(0.11, 10, 8),
  shock: new SphereGeometry(0.34, 18, 12),
  rocket: new CylinderGeometry(0.12, 0.12, 1.18, 12),
  ripper: new TorusGeometry(0.32, 0.045, 8, 18),
  flak: new ConeGeometry(0.1, 0.42, 5),
  sniper: new CylinderGeometry(0.035, 0.035, 1.35, 8),
  gatling: new SphereGeometry(0.075, 8, 6),
  pulse: new IcosahedronGeometry(0.22, 1),
  bio: new SphereGeometry(0.3, 12, 8),
  redeemer: new SphereGeometry(0.46, 18, 12)
} as const;

const VISUAL_SCALE: Partial<Record<ProjectileVisualKind, Vector3>> = {
  shock: new Vector3(0.95, 0.95, 1.45),
  bio: new Vector3(1.2, 0.82, 1.05),
  redeemer: new Vector3(1.25, 1.25, 1.25)
};

const GLOW_SCALE: Partial<Record<ProjectileVisualKind, Vector3>> = {
  pistol: new Vector3(0.72, 0.72, 0.72),
  rocket: new Vector3(0.82, 1.85, 0.82),
  ripper: new Vector3(1.35, 1.35, 0.5),
  flak: new Vector3(0.62, 0.95, 0.62),
  sniper: new Vector3(0.38, 2.2, 0.38),
  gatling: new Vector3(0.46, 0.46, 0.46),
  redeemer: new Vector3(1.85, 1.85, 1.85)
};

export function createProjectileVisual(kind: ProjectileVisualKind, direction: Vector3, color: number): Object3D {
  const mesh = new Mesh(GEOMETRY[kind], materialForColor(color));
  alignProjectileVisual(mesh, direction);

  const scale = VISUAL_SCALE[kind];
  if (scale !== undefined) {
    mesh.scale.copy(scale);
  }

  const glow = new Mesh(GLOW_GEOMETRY, glowMaterialForColor(color));
  glow.name = `${kind}-fake-glow`;
  glow.renderOrder = 8;
  glow.scale.copy(GLOW_SCALE[kind] ?? DEFAULT_GLOW_SCALE);
  mesh.add(glow);
  return mesh;
}

export function alignProjectileVisual(object: Object3D, direction: Vector3): void {
  object.quaternion.setFromUnitVectors(PROJECTILE_FORWARD, direction);
}

function materialForColor(color: number): MeshBasicMaterial {
  const existing = MATERIAL_CACHE.get(color);
  if (existing !== undefined) {
    return existing;
  }

  const material = new MeshBasicMaterial({ color });
  MATERIAL_CACHE.set(color, material);
  return material;
}

function glowMaterialForColor(color: number): MeshBasicMaterial {
  const existing = GLOW_MATERIAL_CACHE.get(color);
  if (existing !== undefined) {
    return existing;
  }

  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: AdditiveBlending
  });
  GLOW_MATERIAL_CACHE.set(color, material);
  return material;
}
