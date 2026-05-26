// Path: /Users/johann/MyBrew/funnel-real/src/render/unit-cylinder-geometry.ts

import { CylinderGeometry } from 'three/webgpu';

const UNIT_CYLINDER_RADIAL_SEGMENTS = 12;

let unitCylinderGeometry: CylinderGeometry | null = null;

export function getUnitCylinderGeometry(): CylinderGeometry {
  if (unitCylinderGeometry === null) {
    unitCylinderGeometry = new CylinderGeometry(1, 1, 1, UNIT_CYLINDER_RADIAL_SEGMENTS, 1);
  }
  return unitCylinderGeometry;
}
