// Path: /Users/johann/MyBrew/funnel-real/src/render/dispose-three.ts

import { Material, Mesh, type Object3D, type Scene } from 'three/webgpu';

export type MaterialDisposePredicate = (material: Material) => boolean;

export function disposeMaterials(
  material: Material | Material[],
  shouldDispose: MaterialDisposePredicate = () => true
): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (shouldDispose(entry)) {
      entry.dispose();
    }
  }
}

export interface DisposeMeshResourcesOptions {
  
  geometry?: boolean;
  
  materials?: boolean;
  shouldDisposeMaterial?: MaterialDisposePredicate;
}

export function disposeMeshResources(object: Object3D, options: DisposeMeshResourcesOptions = {}): void {
  if (!(object instanceof Mesh)) {
    return;
  }

  const { geometry = true, materials = true, shouldDisposeMaterial } = options;
  if (geometry) {
    object.geometry.dispose();
  }
  if (materials) {
    disposeMaterials(object.material, shouldDisposeMaterial);
  }
}

export interface DetachSceneObjectOptions extends DisposeMeshResourcesOptions {
  scene?: Scene;
  
  disposeSubtree?: boolean;
}


export function detachSceneObject(
  object: Object3D | null,
  options: DetachSceneObjectOptions = {}
): void {
  if (object === null) {
    return;
  }

  const { scene, disposeSubtree = false, geometry, materials, shouldDisposeMaterial } = options;
  scene?.remove(object);
  object.removeFromParent();

  if (!disposeSubtree) {
    return;
  }

  object.traverse((node) => {
    disposeMeshResources(node, { geometry, materials, shouldDisposeMaterial });
  });
}


export function disposeObject3DMeshes(root: Object3D): void {
  root.traverse((node) => {
    disposeMeshResources(node);
  });
}
