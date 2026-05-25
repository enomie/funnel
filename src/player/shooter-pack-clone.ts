// Path: /Users/johann/MyBrew/funnel-real/src/player/shooter-pack-clone.ts

import * as skeletonUtilsUntyped from 'three/addons/utils/SkeletonUtils.js';
import type { Object3D } from 'three/webgpu';

interface SkeletonUtilsApi {
  clone: (source: Object3D) => Object3D;
}

const skeletonUtils = skeletonUtilsUntyped as unknown as SkeletonUtilsApi;


export function cloneShooterPackModel(source: Object3D): Object3D {
  const clone = skeletonUtils.clone(source);
  clone.name = `${source.name}-clone`;
  return clone;
}
