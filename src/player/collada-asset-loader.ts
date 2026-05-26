// Path: /Users/johann/MyBrew/funnel-real/src/player/collada-asset-loader.ts

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
const colladaXmlLoads = new Map<string, Promise<{ xml: string; innerPath: string | null }>>();

function fetchColladaXmlCached(url: string): Promise<{ xml: string; innerPath: string | null }> {
  let pending = colladaXmlLoads.get(url);
  if (pending === undefined) {
    pending = fetchColladaXml(url);
    colladaXmlLoads.set(url, pending);
    pending.catch(() => {
      colladaXmlLoads.delete(url);
    });
  }

  return pending;
}

export async function loadColladaFromUrl(url: string): Promise<ParsedColladaAsset> {
  const { xml, innerPath } = await fetchColladaXmlCached(url);
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
