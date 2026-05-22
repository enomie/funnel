import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import {
  BufferGeometry,
  Mesh,
  type AnimationClip,
  type Material,
  type Object3D
} from 'three/webgpu';
import { fetchColladaXml } from './collada-zip';

export interface ParsedColladaAsset {
  scene: Object3D;
  animations: AnimationClip[];
  sourceUrl: string;
  innerPath: string | null;
}

const colladaLoader = new ColladaLoader();

export async function loadColladaFromUrl(url: string): Promise<ParsedColladaAsset> {
  const { xml, innerPath } = await fetchColladaXml(url);
  const basePath = url.slice(0, url.lastIndexOf('/') + 1);
  const parsed = colladaLoader.parse(xml, basePath);
  if (parsed === null) {
    throw new Error(`ColladaLoader could not parse: ${url}`);
  }

  const animations = parsed.scene.animations;
  return {
    scene: parsed.scene,
    animations,
    sourceUrl: url,
    innerPath
  };
}

export function disposeColladaScene(scene: Object3D): void {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    (object.geometry as BufferGeometry).dispose();
    disposeMeshMaterials(object.material as Material | Material[]);
  });
}

function disposeMeshMaterials(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    entry.dispose();
  }
}
