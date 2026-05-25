import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { ColliderDesc } from '@dimforge/rapier3d-simd-compat';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry
} from 'three/webgpu';

/** Octagonal prism — industrial barrel / pipe look; never more round than this for rain. */
export const OCT_PRISM_RADIAL_SIDES = 8;

export type DynamicBoxSize = readonly [number, number, number];

export type DynamicPropSpec =
  | { readonly kind: 'box'; readonly size: DynamicBoxSize }
  | { readonly kind: 'ramp'; readonly width: number; readonly height: number; readonly depth: number }
  | { readonly kind: 'octCylinder'; readonly radius: number; readonly height: number }
  | { readonly kind: 'icosahedron'; readonly radius: number }
  | { readonly kind: 'dodecahedron'; readonly radius: number };

/** Phase 2 gib spawner — few faces, still reads round / chunky when tumbling. */
export const GIB_SHAPE_PRESETS = {
  octPeg: { kind: 'octCylinder', radius: 0.2, height: 0.4 },
  icosaShard: { kind: 'icosahedron', radius: 0.25 },
  dodecaChunk: { kind: 'dodecahedron', radius: 0.22 }
} as const satisfies Record<string, DynamicPropSpec>;

export function dynamicPropKey(spec: DynamicPropSpec): string {
  switch (spec.kind) {
    case 'box':
      return `box-${String(spec.size[0])}x${String(spec.size[1])}x${String(spec.size[2])}`;
    case 'ramp':
      return `ramp-${String(spec.width)}x${String(spec.height)}x${String(spec.depth)}`;
    case 'octCylinder':
      return `octCyl-${String(spec.radius)}r-${String(spec.height)}h`;
    case 'icosahedron':
      return `icosa-${String(spec.radius)}r`;
    case 'dodecahedron':
      return `dodeca-${String(spec.radius)}r`;
  }
}

export function dynamicPropVerticalExtent(spec: DynamicPropSpec): number {
  switch (spec.kind) {
    case 'box':
      return spec.size[1];
    case 'ramp':
      return spec.height;
    case 'octCylinder':
      return spec.height;
    case 'icosahedron':
    case 'dodecahedron':
      return spec.radius * 2;
  }
}

/** Right triangle in YZ (legs = height × depth), extruded along X (width). Origin-centered. */
export function createRampGeometry(width: number, height: number, depth: number): BufferGeometry {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const halfDepth = depth * 0.5;

  // A = right angle (y−, z−), B = y+ leg, C = z+ leg; 0 = x−, 1 = x+.
  const ax0 = -halfWidth;
  const ax1 = halfWidth;
  const ayA = -halfHeight;
  const ayB = halfHeight;
  const azA = -halfDepth;
  const azC = halfDepth;

  const positions: number[] = [];
  const normals: number[] = [];

  const pushFlatTriangle = (
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ): void => {
    const e1x = x1 - x0;
    const e1y = y1 - y0;
    const e1z = z1 - z0;
    const e2x = x2 - x0;
    const e2y = y2 - y0;
    const e2z = z2 - z0;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const invLen = 1 / Math.hypot(nx, ny, nz);

    positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    for (let vertex = 0; vertex < 3; vertex += 1) {
      normals.push(nx * invLen, ny * invLen, nz * invLen);
    }
  };

  // Front cap (−X): A → C → B
  pushFlatTriangle(ax0, ayA, azA, ax0, ayA, azC, ax0, ayB, azA);
  // Back cap (+X): A → B → C
  pushFlatTriangle(ax1, ayA, azA, ax1, ayB, azA, ax1, ayA, azC);
  // Y-leg wall (−Z): A′ → A → B → B′
  pushFlatTriangle(ax1, ayA, azA, ax0, ayA, azA, ax0, ayB, azA);
  pushFlatTriangle(ax1, ayA, azA, ax0, ayB, azA, ax1, ayB, azA);
  // Z-leg floor (−Y): A → C′ → C → A′
  pushFlatTriangle(ax0, ayA, azA, ax1, ayA, azC, ax0, ayA, azC);
  pushFlatTriangle(ax0, ayA, azA, ax1, ayA, azA, ax1, ayA, azC);
  // Slope (+Y/+Z): B → C → C′ → B′
  pushFlatTriangle(ax0, ayB, azA, ax0, ayA, azC, ax1, ayA, azC);
  pushFlatTriangle(ax0, ayB, azA, ax1, ayA, azC, ax1, ayB, azA);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

function rampConvexHullPoints(width: number, height: number, depth: number): Float32Array {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const halfDepth = depth * 0.5;

  return new Float32Array([
    -halfWidth,
    -halfHeight,
    -halfDepth,
    -halfWidth,
    halfHeight,
    -halfDepth,
    -halfWidth,
    -halfHeight,
    halfDepth,
    halfWidth,
    -halfHeight,
    -halfDepth,
    halfWidth,
    halfHeight,
    -halfDepth,
    halfWidth,
    -halfHeight,
    halfDepth
  ]);
}

export function createDynamicPropGeometry(spec: DynamicPropSpec): BufferGeometry {
  switch (spec.kind) {
    case 'box':
      return new BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
    case 'ramp':
      return createRampGeometry(spec.width, spec.height, spec.depth);
    case 'octCylinder':
      return new CylinderGeometry(
        spec.radius,
        spec.radius,
        spec.height,
        OCT_PRISM_RADIAL_SIDES,
        1
      );
    case 'icosahedron':
      return new IcosahedronGeometry(spec.radius, 0);
    case 'dodecahedron':
      return new DodecahedronGeometry(spec.radius, 0);
  }
}

function octPrismConvexHullPoints(radius: number, halfHeight: number): Float32Array {
  const points: number[] = [];
  for (let index = 0; index < OCT_PRISM_RADIAL_SIDES; index += 1) {
    const angle = (index / OCT_PRISM_RADIAL_SIDES) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    points.push(x, halfHeight, z, x, -halfHeight, z);
  }
  return new Float32Array(points);
}

function convexHullFromGeometry(geometry: BufferGeometry): Float32Array {
  const position = geometry.getAttribute('position');
  const points = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    points[index * 3] = position.getX(index);
    points[index * 3 + 1] = position.getY(index);
    points[index * 3 + 2] = position.getZ(index);
  }
  return points;
}

function convexHullColliderDesc(points: Float32Array, label: string): ColliderDesc {
  const desc = RAPIER.ColliderDesc.convexHull(points);
  if (desc === null) {
    throw new Error(`FUNNEL convex hull failed: ${label}.`);
  }
  return desc;
}

export function createDynamicPropColliderDesc(spec: DynamicPropSpec): ColliderDesc {
  switch (spec.kind) {
    case 'box':
      return RAPIER.ColliderDesc.cuboid(
        spec.size[0] * 0.5,
        spec.size[1] * 0.5,
        spec.size[2] * 0.5
      );
    case 'ramp':
      return convexHullColliderDesc(
        rampConvexHullPoints(spec.width, spec.height, spec.depth),
        dynamicPropKey(spec)
      );
    case 'octCylinder':
      return convexHullColliderDesc(
        octPrismConvexHullPoints(spec.radius, spec.height * 0.5),
        dynamicPropKey(spec)
      );
    case 'icosahedron':
    case 'dodecahedron':
      return convexHullColliderDesc(
        convexHullFromGeometry(createDynamicPropGeometry(spec)),
        dynamicPropKey(spec)
      );
  }
}
