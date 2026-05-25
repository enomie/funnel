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
  /** Default true — false for shared unit geometry (low-poly sphere, ripper torus). */
  geometry?: boolean;
  /** Default true — false for module material caches / team pools. */
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
  /** Traverse subtree and dispose mesh GPU resources after detach. */
  disposeSubtree?: boolean;
}

/** Remove from scene/parent — optional subtree dispose (shared caches: geometry/materials false). */
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

/** Collada / unique mesh hierarchies — geometry + all materials. */
export function disposeObject3DMeshes(root: Object3D): void {
  root.traverse((node) => {
    disposeMeshResources(node);
  });
}
