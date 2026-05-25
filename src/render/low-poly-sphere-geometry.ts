import { IcosahedronGeometry } from 'three/webgpu';

/** Detail 0 — 20 faces; scale via instance/world matrix, not per-radius geometry clones. */
const LOW_POLY_SPHERE_DETAIL = 5;

let unitLowPolySphere: IcosahedronGeometry | null = null;

export function getUnitLowPolySphereGeometry(): IcosahedronGeometry {
  if (unitLowPolySphere === null) {
    unitLowPolySphere = new IcosahedronGeometry(1, LOW_POLY_SPHERE_DETAIL);
  }
  return unitLowPolySphere;
}
