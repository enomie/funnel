// Path: /Users/johann/MyBrew/funnel-real/src/player/player-camera.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, World } from '@dimforge/rapier3d-simd-compat';
import { Group, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import {
  firstPersonMuzzleSocketPosition,
  FIRST_PERSON_WEAPON_SOCKET_POSITION,
  thirdPersonMuzzleSocketPosition,
  THIRD_PERSON_WEAPON_SOCKET_POSITION
} from '../combat/weapon-placeholder-visual';
import { WEAPON_DEFINITIONS } from '../combat/weapon-definitions';
import type { GuidedRedeemerCameraState } from '../combat/redeemer-guided';
import { PLAYER_CONFIG } from '../config/game-config';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import { eyeHeightOffsetFromCapsule } from './humanoid-eye-height';
import type { PlayerFrame } from './player-controller';


const LOOK_AT_DISTANCE = 12;
const THIRD_PERSON_SHOULDER = PLAYER_CONFIG.cameraSide;
const FIRST_PERSON_FOV = 74;
const THIRD_PERSON_FOV = 72;
const GUIDED_REDEEMER_FOV = 68;
const COLLISION_PADDING = 0.22;
const MIN_CAMERA_DISTANCE = 0.4;

/** FOV-matched look scale for weapon zoom (same cm/360 on screen as hip fire). */
export function playerHipFovDeg(firstPersonView: boolean): number {
  return firstPersonView ? FIRST_PERSON_FOV : THIRD_PERSON_FOV;
}

export function weaponZoomLookSensitivityScale(
  zoomFovScale: number,
  hipFovDeg: number,
  adsMultiplier = PLAYER_CONFIG.adsLookSensitivityMultiplier
): number {
  if (zoomFovScale >= 0.999) {
    return 1;
  }

  const clampedZoom = Math.max(0.22, Math.min(1, zoomFovScale));
  const hipHalfRad = (hipFovDeg * Math.PI) / 360;
  const zoomHalfRad = (hipFovDeg * clampedZoom * Math.PI) / 360;
  return (Math.tan(zoomHalfRad) / Math.tan(hipHalfRad)) * adsMultiplier;
}

const DEFAULT_FIRST_PERSON_MUZZLE_OFFSET = firstPersonMuzzleSocketPosition(WEAPON_DEFINITIONS[0]);
const DEFAULT_THIRD_PERSON_MUZZLE_OFFSET = thirdPersonMuzzleSocketPosition(WEAPON_DEFINITIONS[0]);
const _viewForward = new Vector3();
const _lookAtPoint = new Vector3();
const _flatForward = new Vector3();
const _flatRight = new Vector3();
const _offsetScratch = new Vector3();
const _boomAxis = new Vector3();
const _toPivotDir = new Vector3();
const _clampedCamera = new Vector3();

let _cameraLosRay: RAPIER.Ray | null = null;

export interface CameraVectors {
  origin: Vector3;
  direction: Vector3;
  target: Vector3;
}

export interface CameraUpdateResult {
  vectors: CameraVectors;
  firstPersonBlend: number;
}

type MutableCameraUpdateResult = {
  vectors: CameraVectors;
  firstPersonBlend: number;
};

export class PlayerCamera {
  readonly #camera: PerspectiveCamera;
  readonly #world: World;
  readonly #playerCollider: Collider;
  readonly #viewmodelRig: Group;
  readonly #pivot = new Vector3();
  readonly #thirdPersonDesired = new Vector3();
  readonly #eyeOrigin = new Vector3();
  readonly #cameraVectors: CameraVectors = {
    origin: new Vector3(),
    direction: new Vector3(),
    target: new Vector3()
  };
  #firstPersonBlend = 0;
  #weaponZoomFovScale = 1;
  #weaponSocket: Object3D | null = null;
  #muzzleSocket: Object3D | null = null;
  #thirdPersonWeaponParent: Object3D | null = null;
  #resolveThirdPersonMuzzleOffset: (() => Vector3) | null = null;
  #resolveFirstPersonMuzzleOffset: (() => Vector3) | null = null;
  #viewmodelOnRig = false;
  #guidedOverride: GuidedRedeemerCameraState | null = null;
  readonly #cameraUpdateResult: MutableCameraUpdateResult = {
    vectors: null as unknown as CameraVectors,
    firstPersonBlend: 0
  };

  constructor(camera: PerspectiveCamera, world: World, playerCollider: Collider, scene: Scene) {
    this.#camera = camera;
    this.#world = world;
    this.#playerCollider = playerCollider;
    this.#viewmodelRig = new Group();
    this.#viewmodelRig.name = 'fps-viewmodel-rig';
    scene.add(this.#viewmodelRig);
    this.#cameraUpdateResult.vectors = this.#cameraVectors;
  }

  attachViewmodel(
    thirdPersonParent: Object3D,
    weaponSocket: Object3D,
    muzzleSocket: Object3D,
    resolveThirdPersonMuzzleOffset: () => Vector3,
    resolveFirstPersonMuzzleOffset: () => Vector3
  ): void {
    this.#thirdPersonWeaponParent = thirdPersonParent;
    this.#weaponSocket = weaponSocket;
    this.#muzzleSocket = muzzleSocket;
    this.#resolveThirdPersonMuzzleOffset = resolveThirdPersonMuzzleOffset;
    this.#resolveFirstPersonMuzzleOffset = resolveFirstPersonMuzzleOffset;
    if (muzzleSocket.parent !== weaponSocket) {
      weaponSocket.add(muzzleSocket);
    }
  }

  setWeaponZoomFovScale(scale: number): void {
    this.#weaponZoomFovScale = Math.max(0.22, Math.min(1, scale));
  }

  setGuidedOverride(state: GuidedRedeemerCameraState | null): void {
    this.#guidedOverride = state;
  }

  update(frame: PlayerFrame, _deltaSeconds: number): CameraUpdateResult {
    if (this.#guidedOverride !== null) {
      return this.#updateGuidedCamera();
    }

    this.#firstPersonBlend = frame.firstPersonView ? 1 : 0;

    this.#updatePivot(frame);
    this.#updateViewForward(frame.yaw, frame.pitch);
    _lookAtPoint.copy(this.#pivot).addScaledVector(_viewForward, LOOK_AT_DISTANCE);

    this.#computeThirdPersonDesired(frame.yaw);
    this.#camera.position.lerpVectors(
      this.#thirdPersonDesired,
      this.#pivot,
      this.#firstPersonBlend
    );
    this.#camera.lookAt(_lookAtPoint);
    this.#camera.updateMatrixWorld(true);

    const baseFov =
      THIRD_PERSON_FOV + (FIRST_PERSON_FOV - THIRD_PERSON_FOV) * this.#firstPersonBlend;
    this.#camera.fov = baseFov * this.#weaponZoomFovScale;
    this.#camera.near = 0.05;
    this.#camera.far = 500;
    this.#camera.updateProjectionMatrix();

    this.#syncViewmodelHierarchy();

    if (this.#firstPersonBlend > 0.5) {
      this.#eyeOrigin.copy(this.#camera.position);
    } else {
      this.#eyeOrigin.copy(this.#pivot);
    }

    this.#vectorsFromFrame();

    const result = this.#cameraUpdateResult;
    result.firstPersonBlend = this.#firstPersonBlend;
    return result as CameraUpdateResult;
  }

  #vectorsFromFrame(): void {
    this.#cameraVectors.origin.copy(this.#eyeOrigin);
    this.#cameraVectors.direction.copy(_viewForward);
    this.#cameraVectors.target.copy(_lookAtPoint);
  }

  #updateGuidedCamera(): CameraUpdateResult {
    const guided = this.#guidedOverride;
    if (guided === null) {
      this.#vectorsFromFrame();
      const result = this.#cameraUpdateResult;
      result.firstPersonBlend = 0;
      return result as CameraUpdateResult;
    }

    this.#firstPersonBlend = 0;
    this.#camera.position.copy(guided.position);
    this.#camera.lookAt(guided.lookAt);
    this.#camera.fov = GUIDED_REDEEMER_FOV;
    this.#camera.near = 0.05;
    this.#camera.far = 500;
    this.#camera.updateProjectionMatrix();
    this.#camera.updateMatrixWorld(true);
    this.#syncViewmodelHierarchy();

    this.#cameraVectors.origin.copy(guided.position);
    this.#cameraVectors.direction.copy(guided.direction);
    this.#cameraVectors.target.copy(guided.lookAt);

    const result = this.#cameraUpdateResult;
    result.firstPersonBlend = 0;
    return result as CameraUpdateResult;
  }

  resolveMuzzleWorldPosition(out: Vector3, vectors: CameraVectors): Vector3 {
    if (this.#muzzleSocket !== null) {
      this.#muzzleSocket.updateWorldMatrix(true, false);
      return this.#muzzleSocket.getWorldPosition(out);
    }

    return out.copy(vectors.origin).addScaledVector(vectors.direction, 0.35);
  }

  #updateViewForward(yaw: number, pitch: number): void {
    const cosPitch = Math.cos(pitch);
    _viewForward.set(
      Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      Math.cos(yaw) * cosPitch
    );
    _viewForward.normalize();
  }

  #updatePivot(frame: PlayerFrame): void {
    const eyeHeight = eyeHeightOffsetFromCapsule({
      isDead: frame.isDead,
      crouching: frame.crouching
    });
    this.#pivot.set(frame.position.x, frame.position.y + eyeHeight, frame.position.z);
  }

  
  #computeThirdPersonDesired(yaw: number): void {
    _flatForward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    _flatRight.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();

    _offsetScratch
      .copy(_flatForward)
      .multiplyScalar(-PLAYER_CONFIG.thirdPersonDistance)
      .addScaledVector(_flatRight, THIRD_PERSON_SHOULDER);

    this.#thirdPersonDesired.copy(this.#pivot).add(_offsetScratch);
    this.#thirdPersonDesired.copy(
      this.#clampThirdPersonWithLineOfSight(this.#pivot, this.#thirdPersonDesired)
    );
  }

  #syncViewmodelHierarchy(): void {
    if (
      this.#weaponSocket === null ||
      this.#muzzleSocket === null ||
      this.#thirdPersonWeaponParent === null
    ) {
      return;
    }

    const useFirstPerson = this.#firstPersonBlend > 0.5;

    if (useFirstPerson !== this.#viewmodelOnRig) {
      if (useFirstPerson) {
        this.#viewmodelRig.add(this.#weaponSocket);
        this.#weaponSocket.position.copy(FIRST_PERSON_WEAPON_SOCKET_POSITION);
        this.#muzzleSocket.position.copy(
          this.#resolveFirstPersonMuzzleOffset?.() ?? DEFAULT_FIRST_PERSON_MUZZLE_OFFSET
        );
      } else {
        this.#thirdPersonWeaponParent.add(this.#weaponSocket);
        this.#weaponSocket.position.copy(THIRD_PERSON_WEAPON_SOCKET_POSITION);
        this.#muzzleSocket.position.copy(
          this.#resolveThirdPersonMuzzleOffset?.() ?? DEFAULT_THIRD_PERSON_MUZZLE_OFFSET
        );
      }

      this.#viewmodelOnRig = useFirstPerson;
    }

    if (useFirstPerson) {
      this.#viewmodelRig.position.copy(this.#camera.position);
      this.#viewmodelRig.quaternion.copy(this.#camera.quaternion);
      this.#viewmodelRig.updateMatrixWorld(true);
    }
  }

  
  #clampThirdPersonWithLineOfSight(pivot: Vector3, desired: Vector3): Vector3 {
    _boomAxis.subVectors(desired, pivot);
    const boomLength = _boomAxis.length();
    if (boomLength <= MIN_CAMERA_DISTANCE) {
      return _clampedCamera.copy(desired);
    }

    _toPivotDir.copy(_boomAxis).negate().normalize();
    if (_cameraLosRay === null) {
      _cameraLosRay = new RAPIER.Ray(
        { x: desired.x, y: desired.y, z: desired.z },
        { x: _toPivotDir.x, y: _toPivotDir.y, z: _toPivotDir.z }
      );
    } else {
      _cameraLosRay.origin.x = desired.x;
      _cameraLosRay.origin.y = desired.y;
      _cameraLosRay.origin.z = desired.z;
      _cameraLosRay.dir.x = _toPivotDir.x;
      _cameraLosRay.dir.y = _toPivotDir.y;
      _cameraLosRay.dir.z = _toPivotDir.z;
    }

    const excludeBody = this.#playerCollider.parent();
    const hit = this.#world.castRay(
      _cameraLosRay,
      boomLength,
      true,
      undefined,
      ACTOR_RAY_QUERY_GROUPS,
      undefined,
      excludeBody ?? undefined
    );

    if (hit === null) {
      return _clampedCamera.copy(desired);
    }

    const pullForward = Math.max(0, hit.timeOfImpact - COLLISION_PADDING);
    return _clampedCamera.copy(desired).addScaledVector(_toPivotDir, pullForward);
  }
}
