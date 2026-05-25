// Path: /Users/johann/MyBrew/funnel-real/src/player/humanoid-eye-visual.ts

import { Bone, Mesh, Quaternion, type Object3D, Vector3 } from 'three/webgpu';
import type { RelativeTeamRole } from '../combat/team-color-derive';
import { getUnitLowPolySphereGeometry } from '../render/low-poly-sphere-geometry';
import { getTeamJointMaterial, isHumanoidEyeMeshName } from './team-visual-colors';

const HEAD_BONE = 'mixamorig_Head';

const EYE_RADIUS_CM = 3;
const EYE_SCALE_Y = 0.55;
const EYE_SCALE_XZ = 0.92;

const EYE_FORWARD_CM = 13.2;
const EYE_LATERAL_CM = 3.2;
const EYE_VERTICAL_CM = 12.5;

export const HUMANOID_EYE_BIND_POSE_VERTICAL_CM = EYE_VERTICAL_CM - 5;

const _headOffset = new Vector3();
const _world = new Vector3();
const _headWorld = new Vector3();
const _headWorldQuat = new Quaternion();
const _characterWorldQuat = new Quaternion();
const _headLocalQuat = new Quaternion();

export interface HeadBoneEyeSyncGate {
  lastClipId: string;
  headX: number;
  headY: number;
  headZ: number;
  headQx: number;
  headQy: number;
  headQz: number;
  headQw: number;
}

export function createHeadBoneEyeSyncGate(): HeadBoneEyeSyncGate {
  return {
    lastClipId: '',
    headX: NaN,
    headY: NaN,
    headZ: NaN,
    headQx: NaN,
    headQy: NaN,
    headQz: NaN,
    headQw: NaN
  };
}

export function resetHeadBoneEyeSyncGate(gate: HeadBoneEyeSyncGate): void {
  gate.lastClipId = '';
  gate.headX = NaN;
  gate.headY = NaN;
  gate.headZ = NaN;
  gate.headQx = NaN;
  gate.headQy = NaN;
  gate.headQz = NaN;
  gate.headQw = NaN;
}


export function shouldSyncHumanoidEyes(
  character: Object3D,
  clipId: string,
  gate: HeadBoneEyeSyncGate
): boolean {
  if (clipId !== gate.lastClipId) {
    gate.lastClipId = clipId;
    return true;
  }

  const head = findHeadBone(character);
  if (head === null) {
    return false;
  }

  head.updateWorldMatrix(true, false);
  _headWorld.setFromMatrixPosition(head.matrixWorld);
  head.getWorldQuaternion(_headWorldQuat);
  if (
    _headWorld.x === gate.headX &&
    _headWorld.y === gate.headY &&
    _headWorld.z === gate.headZ &&
    _headWorldQuat.x === gate.headQx &&
    _headWorldQuat.y === gate.headQy &&
    _headWorldQuat.z === gate.headQz &&
    _headWorldQuat.w === gate.headQw
  ) {
    return false;
  }

  gate.headX = _headWorld.x;
  gate.headY = _headWorld.y;
  gate.headZ = _headWorld.z;
  gate.headQx = _headWorldQuat.x;
  gate.headQy = _headWorldQuat.y;
  gate.headQz = _headWorldQuat.z;
  gate.headQw = _headWorldQuat.w;
  return true;
}

export const HUMANOID_EYE_LEFT = 'humanoid-eye-left';
export const HUMANOID_EYE_RIGHT = 'humanoid-eye-right';

function findHeadBone(character: Object3D): Bone | null {
  let head: Bone | null = null;
  character.traverse((object) => {
    if (head === null && object instanceof Bone && object.name === HEAD_BONE) {
      head = object;
    }
  });
  return head;
}

function bindEyeMesh(mesh: Mesh, lateralSign: number): void {
  mesh.frustumCulled = false;
  mesh.scale.set(
    EYE_RADIUS_CM * EYE_SCALE_XZ,
    EYE_RADIUS_CM * EYE_SCALE_Y,
    EYE_RADIUS_CM * EYE_SCALE_XZ
  );
  mesh.userData.eyeLateralSign = lateralSign;
}

function createEyeMesh(name: string, role: RelativeTeamRole, lateralSign: number): Mesh {
  const mesh = new Mesh(getUnitLowPolySphereGeometry(), getTeamJointMaterial(role));
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  bindEyeMesh(mesh, lateralSign);
  return mesh;
}

function ensureEyeOnCharacter(
  character: Object3D,
  name: string,
  role: RelativeTeamRole,
  lateralSign: number
): Mesh {
  let eye = findHumanoidEye(character, name);
  if (eye === null) {
    eye = createEyeMesh(name, role, lateralSign);
    character.add(eye);
    return eye;
  }

  if (eye.parent !== character) {
    eye.removeFromParent();
    character.add(eye);
  }

  bindEyeMesh(eye, lateralSign);
  return eye;
}

function eyeVerticalCmFor(character: Object3D): number {
  const override: unknown = character.userData.eyeVerticalCm;
  return typeof override === 'number' ? override : EYE_VERTICAL_CM;
}


export function attachHumanoidEyes(
  character: Object3D,
  role: RelativeTeamRole,
  verticalCm?: number
): void {
  if (verticalCm === undefined) {
    delete character.userData.eyeVerticalCm;
  } else {
    character.userData.eyeVerticalCm = verticalCm;
  }

  ensureEyeOnCharacter(character, HUMANOID_EYE_LEFT, role, -1);
  ensureEyeOnCharacter(character, HUMANOID_EYE_RIGHT, role, 1);
  refreshHumanoidEyeMaterials(character, role);
  syncHumanoidEyes(character);
}


export function syncHumanoidEyes(character: Object3D): void {
  const head = findHeadBone(character);
  if (head === null) {
    return;
  }

  head.updateWorldMatrix(true, false);
  character.updateWorldMatrix(true, false);

  head.getWorldQuaternion(_headWorldQuat);
  character.getWorldQuaternion(_characterWorldQuat);
  _headLocalQuat.copy(_characterWorldQuat).invert().multiply(_headWorldQuat);

  character.traverse((object) => {
    if (!(object instanceof Mesh) || !isHumanoidEyeMeshName(object.name)) {
      return;
    }

    const lateralSign = object.userData.eyeLateralSign as number | undefined;
    if (lateralSign === undefined) {
      return;
    }

    _headOffset.set(lateralSign * EYE_LATERAL_CM, eyeVerticalCmFor(character), EYE_FORWARD_CM);
    _world.copy(_headOffset).applyMatrix4(head.matrixWorld);
    character.worldToLocal(_world);
    object.position.copy(_world);
    object.quaternion.copy(_headLocalQuat);
  });
}

export function findHumanoidEye(character: Object3D, name: string): Mesh | null {
  let eye: Mesh | null = null;
  character.traverse((object) => {
    if (eye === null && object instanceof Mesh && object.name === name) {
      eye = object;
    }
  });
  return eye;
}

export function refreshHumanoidEyeMaterials(
  character: Object3D,
  role: RelativeTeamRole,
  hitFlash = false
): void {
  const material = getTeamJointMaterial(role, hitFlash);
  character.traverse((object) => {
    if (object instanceof Mesh && isHumanoidEyeMeshName(object.name)) {
      object.material = material;
    }
  });
}

export function isHumanoidEyeMesh(object: Object3D): boolean {
  return object instanceof Mesh && isHumanoidEyeMeshName(object.name);
}
