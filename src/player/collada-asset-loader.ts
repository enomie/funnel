import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import type { AnimationClip, Object3D } from 'three/webgpu';
import { disposeObject3DMeshes } from '../render/dispose-three';
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
  disposeObject3DMeshes(scene);
}
