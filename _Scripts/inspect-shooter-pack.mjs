/**
 * Phase 0: inspect Shooter-Pack Collada (base + zipped animations) and write docs/animations.txt + docs/bones.txt
 */
import { DOMParser } from '@xmldom/xmldom';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

globalThis.DOMParser = DOMParser;
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { unzipSync } from 'three/addons/libs/fflate.module.js';
import { Bone, SkinnedMesh } from 'three';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = join(root, 'public/Shooter-Pack');

const BASE_MODEL = 'animation-model-y-bot.dae';
const ANIMATION_FILES = readdirSync(packDir)
  .filter(
    (name) =>
      name.startsWith('animation-') && name.endsWith('.dae') && name !== BASE_MODEL
  )
  .sort();

const loader = new ColladaLoader();

function readDaeXml(filePath) {
  const buffer = readFileSync(join(packDir, filePath));

  const bytes = new Uint8Array(buffer);
  // PK signature — same check as src/player/collada-zip.ts (avoid broken uint32LE in JS)
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const zip = unzipSync(bytes);
    const inner = Object.keys(zip).find((p) => p.toLowerCase().endsWith('.dae'));
    if (!inner) throw new Error(`No inner .dae in zip: ${filePath}`);
    return new TextDecoder().decode(zip[inner]);
  }

  return new TextDecoder().decode(bytes);
}

function clipIdFromFile(fileName) {
  return fileName.replace(/\.dae$/i, '').replace(/^animation-/, '');
}

function collectBones(scene) {
  const names = new Set();
  scene.traverse((object) => {
    if (object instanceof Bone) names.add(object.name);
    if (object instanceof SkinnedMesh && object.skeleton) {
      for (const bone of object.skeleton.bones) names.add(bone.name);
    }
  });
  return [...names].sort();
}

function trackBone(trackName) {
  const dot = trackName.lastIndexOf('.');
  return dot === -1 ? trackName : trackName.slice(0, dot);
}

function remapClipToBoneNames(clip, sourceScene) {
  const uuidToName = new Map();
  sourceScene.traverse((object) => {
    if (object instanceof Bone) {
      uuidToName.set(object.uuid, object.name);
    }
  });

  const remapped = clip.clone();
  for (const track of remapped.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeUuid = dot === -1 ? track.name : track.name.slice(0, dot);
    const suffix = dot === -1 ? '' : track.name.slice(dot);
    const boneName = uuidToName.get(nodeUuid);
    if (boneName) {
      track.name = `${boneName}${suffix}`;
    }
  }

  return remapped;
}

const baseXml = readDaeXml(BASE_MODEL);
const base = loader.parse(baseXml, packDir + '/');
const boneNames = new Set(collectBones(base.scene));

const clipRows = [];
for (const fileName of ANIMATION_FILES) {
  const parsed = loader.parse(readDaeXml(fileName), packDir + '/');
  const clipId = clipIdFromFile(fileName);
  for (const clip of parsed.scene.animations ?? []) {
    const remapped = remapClipToBoneNames(clip, parsed.scene);
    const targets = new Set(remapped.tracks.map((t) => trackBone(t.name)));
    const missing = [...targets].filter((n) => n && !boneNames.has(n));
    clipRows.push({
      clipId,
      colladaName: remapped.name,
      durationSeconds: Math.round(remapped.duration * 1000) / 1000,
      tracks: remapped.tracks.length,
      compatible: missing.length === 0,
      missingBoneCount: missing.length
    });
  }
}

const animationsText = [
  '# Shooter-Pack — Collada animation clips',
  `# Inspected via _Scripts/inspect-shooter-pack.mjs (${new Date().toISOString()})`,
  '',
  `Base model: public/Shooter-Pack/${BASE_MODEL}`,
  `Skeleton bones: ${boneNames.size}`,
  `Animation files: ${ANIMATION_FILES.length}`,
  '',
  '## Clips',
  '',
  ...clipRows.map(
    (r) =>
      `- ${r.clipId} (collada="${r.colladaName}"): ${r.durationSeconds}s, tracks=${r.tracks}, compatible=${r.compatible}${r.missingBoneCount ? `, missing=${r.missingBoneCount}` : ''}`
  )
].join('\n');

const bonesText = [
  '# Shooter-Pack — skeleton (animation-model-y-bot)',
  `# ${boneNames.size} bones`,
  '',
  ...collectBones(base.scene).map((name) => `- ${name}`)
].join('\n');

writeFileSync(join(root, 'docs/animations.txt'), `${animationsText}\n`);
writeFileSync(join(root, 'docs/bones.txt'), `${bonesText}\n`);

console.log(`Wrote docs/animations.txt (${clipRows.length} clips)`);
console.log(`Wrote docs/bones.txt (${boneNames.size} bones)`);
console.log(
  'Compatible:',
  clipRows.every((r) => r.compatible) ? 'yes' : 'NO — see missingBoneCount'
);
