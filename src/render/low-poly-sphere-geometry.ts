// Path: /Users/johann/MyBrew/funnel-real/src/render/low-poly-sphere-geometry.ts

import { IcosahedronGeometry } from 'three/webgpu';


const LOW_POLY_SPHERE_DETAIL = 5;

let unitLowPolySphere: IcosahedronGeometry | null = null;

export function getUnitLowPolySphereGeometry(): IcosahedronGeometry {
  if (unitLowPolySphere === null) {
    unitLowPolySphere = new IcosahedronGeometry(1, LOW_POLY_SPHERE_DETAIL);
  }
  return unitLowPolySphere;
}
