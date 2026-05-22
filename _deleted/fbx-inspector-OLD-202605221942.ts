import {
  Bone,
  Mesh,
  SkinnedMesh,
  type AnimationClip,
  type BufferGeometry,
  type Euler,
  type KeyframeTrack,
  type Material,
  type Matrix4,
  type Object3D,
  type Vector3
} from 'three/webgpu';

interface FbxInspectionOptions {
  label: string;
  sourceUrl: string;
}

interface ObjectTreeRow {
  depth: number;
  type: string;
  name: string;
  children: number;
  position: string;
  rotation: string;
  scale: string;
}

interface MeshRow {
  name: string;
  type: string;
  vertices: number;
  indexed: boolean;
  attributes: string;
  morphTargets: string;
  materials: string;
  bones: number;
}

interface BoneRow {
  index: number;
  name: string;
  parent: string;
  children: string;
  position: string;
  rotation: string;
  scale: string;
}

interface AnimationRow {
  name: string;
  durationSeconds: number;
  tracks: number;
  targets: number;
  firstKey: number | null;
  lastKey: number | null;
}

interface TrackRow {
  clip: string;
  target: string;
  property: string;
  trackType: string;
  keyframes: number;
  valueSize: number;
  firstKey: number | null;
  lastKey: number | null;
}

export function inspectFbxAsset(asset: Object3D, options: FbxInspectionOptions): void {
  const objects = collectObjects(asset);
  const meshes = objects.filter((object): object is Mesh => object instanceof Mesh);
  const skinnedMeshes = objects.filter((object): object is SkinnedMesh => object instanceof SkinnedMesh);
  const bones = objects.filter((object): object is Bone => object instanceof Bone);
  const animations = extractAnimations(asset);

  console.groupCollapsed(`[FBX] ${options.label} loaded`);
  console.info({
    sourceUrl: options.sourceUrl,
    rootName: printableName(asset),
    rootType: asset.type,
    objectCount: objects.length,
    meshCount: meshes.length,
    skinnedMeshCount: skinnedMeshes.length,
    boneCount: bones.length,
    animationCount: animations.length
  });

  console.groupCollapsed('[FBX] Object hierarchy');
  console.table(createObjectTreeRows(asset));
  console.groupEnd();

  if (meshes.length > 0) {
    console.groupCollapsed('[FBX] Meshes and geometry');
    console.table(meshes.map(createMeshRow));
    console.groupEnd();
  }

  if (bones.length > 0) {
    console.groupCollapsed('[FBX] Bones / joints');
    console.table(createBoneRows(bones));
    console.groupEnd();
  }

  if (skinnedMeshes.length > 0) {
    console.groupCollapsed('[FBX] Skeletons');
    for (const mesh of skinnedMeshes) {
      console.groupCollapsed(`${printableName(mesh)} skeleton`);
      console.info({
        boneCount: mesh.skeleton.bones.length,
        boneInverseCount: mesh.skeleton.boneInverses.length,
        bindMode: mesh.bindMode,
        bindMatrix: formatMatrix(mesh.bindMatrix)
      });
      console.table(createBoneRows(mesh.skeleton.bones));
      console.groupEnd();
    }
    console.groupEnd();
  }

  if (animations.length > 0) {
    console.groupCollapsed('[FBX] Embedded animations');
    console.table(animations.map(createAnimationRow));
    console.table(animations.flatMap(createTrackRows));
    console.groupEnd();
  }

  console.groupEnd();
}

function collectObjects(root: Object3D): Object3D[] {
  const objects: Object3D[] = [];
  root.traverse((object) => objects.push(object));
  return objects;
}

function extractAnimations(asset: Object3D): AnimationClip[] {
  return 'animations' in asset ? asset.animations : [];
}

function createObjectTreeRows(root: Object3D): ObjectTreeRow[] {
  const rows: ObjectTreeRow[] = [];

  function walk(object: Object3D, depth: number): void {
    rows.push({
      depth,
      type: object.type,
      name: printableName(object),
      children: object.children.length,
      position: formatVector(object.position),
      rotation: formatEuler(object.rotation),
      scale: formatVector(object.scale)
    });

    for (const child of object.children) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return rows;
}

function createMeshRow(mesh: Mesh): MeshRow {
  return {
    name: printableName(mesh),
    type: mesh.type,
    vertices: vertexCount(mesh.geometry),
    indexed: mesh.geometry.index !== null,
    attributes: Object.keys(mesh.geometry.attributes).join(', ') || '(none)',
    morphTargets: Object.keys(mesh.geometry.morphAttributes).join(', ') || '(none)',
    materials: materialNames(mesh.material),
    bones: mesh instanceof SkinnedMesh ? mesh.skeleton.bones.length : 0
  };
}

function createBoneRows(bones: Bone[]): BoneRow[] {
  return bones.map((bone, index) => ({
    index,
    name: printableName(bone),
    parent: bone.parent === null ? '(none)' : printableName(bone.parent),
    children: bone.children.map(printableName).join(', ') || '(none)',
    position: formatVector(bone.position),
    rotation: formatEuler(bone.rotation),
    scale: formatVector(bone.scale)
  }));
}

function createAnimationRow(clip: AnimationClip): AnimationRow {
  const trackTimes = clip.tracks.flatMap((track) => [firstTime(track), lastTime(track)]);
  const concreteTimes = trackTimes.filter((time): time is number => time !== null);

  return {
    name: clip.name || '(unnamed clip)',
    durationSeconds: roundNumber(clip.duration),
    tracks: clip.tracks.length,
    targets: new Set(clip.tracks.map((track) => parseTrackName(track.name).target)).size,
    firstKey: concreteTimes.length === 0 ? null : roundNumber(Math.min(...concreteTimes)),
    lastKey: concreteTimes.length === 0 ? null : roundNumber(Math.max(...concreteTimes))
  };
}

function createTrackRows(clip: AnimationClip): TrackRow[] {
  return clip.tracks.map((track) => {
    const parsed = parseTrackName(track.name);

    return {
      clip: clip.name || '(unnamed clip)',
      target: parsed.target,
      property: parsed.property,
      trackType: track.ValueTypeName,
      keyframes: track.times.length,
      valueSize: track.getValueSize(),
      firstKey: firstTime(track),
      lastKey: lastTime(track)
    };
  });
}

function parseTrackName(name: string): { target: string; property: string } {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) {
    return { target: name, property: '(unknown)' };
  }

  return {
    target: name.slice(0, lastDot) || '(root)',
    property: name.slice(lastDot + 1) || '(unknown)'
  };
}

function vertexCount(geometry: BufferGeometry): number {
  return geometry.getAttribute('position').count;
}

function materialNames(material: Material | Material[]): string {
  const materials = Array.isArray(material) ? material : [material];
  return materials
    .map((entry) => `${entry.name || '(unnamed)'}:${entry.type}`)
    .join(', ');
}

function printableName(object: Object3D): string {
  return object.name || `(${object.type})`;
}

function formatVector(vector: Vector3): string {
  return [vector.x, vector.y, vector.z].map(roundNumber).join(', ');
}

function formatEuler(euler: Euler): string {
  return [euler.x, euler.y, euler.z].map(roundNumber).join(', ');
}

function formatMatrix(matrix: Matrix4): string {
  return matrix.elements.map(roundNumber).join(', ');
}

function firstTime(track: KeyframeTrack): number | null {
  return track.times.length === 0 ? null : roundNumber(track.times[0]);
}

function lastTime(track: KeyframeTrack): number | null {
  return track.times.length === 0 ? null : roundNumber(track.times[track.times.length - 1]);
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
