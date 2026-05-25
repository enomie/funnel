// Path: /Users/johann/MyBrew/funnel-real/src/combat/beam-stream-visual.ts

import {
  AdditiveBlending,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import { detachSceneObject } from '../render/dispose-three';

const BEAM_UNIT_HEIGHT = 1;
const BEAM_RADIUS = 0.058;
const BEAM_OPACITY = 0.82;

const _axis = new Vector3(0, 1, 0);
const _direction = new Vector3();
const _midpoint = new Vector3();
const _orientation = new Quaternion();

export interface BeamStreamVisual {
  root: Object3D;
  mesh: Mesh;
  readonly material: MeshBasicMaterial;
}

export function createBeamStreamVisual(scene: Scene, color: number): BeamStreamVisual {
  const geometry = new CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, BEAM_UNIT_HEIGHT, 10, 1, true);
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: BEAM_OPACITY,
    depthWrite: false,
    blending: AdditiveBlending
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 12;

  const root = new Object3D();
  root.name = 'beam-stream';
  root.add(mesh);
  scene.add(root);

  return { root, mesh, material };
}

export function updateBeamStreamVisual(visual: BeamStreamVisual, start: Vector3, end: Vector3): void {
  _direction.subVectors(end, start);
  const length = _direction.length();
  if (length <= 0.001) {
    visual.root.visible = false;
    return;
  }

  visual.root.visible = true;
  _direction.multiplyScalar(1 / length);
  _midpoint.copy(start).add(end).multiplyScalar(0.5);
  _orientation.setFromUnitVectors(_axis, _direction);

  visual.root.position.copy(_midpoint);
  visual.root.quaternion.copy(_orientation);
  visual.mesh.scale.set(1, length, 1);
}

export function disposeBeamStreamVisual(visual: BeamStreamVisual, scene: Scene): void {
  detachSceneObject(visual.root, { scene, disposeSubtree: true });
}
