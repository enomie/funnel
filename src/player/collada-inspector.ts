// Path: /Users/johann/MyBrew/funnel-real/src/player/collada-inspector.ts

import type { AnimationClip, Object3D } from 'three/webgpu';
import type { ParsedColladaAsset } from './collada-asset-loader';
import {
  collectSkeletonBoneNames,
  type SkeletonValidationResult,
  validateClipsAgainstSkeleton
} from './skeleton-validation';

export interface ShooterPackInspection {
  base: ParsedColladaAsset;
  validation: SkeletonValidationResult;
  registeredClipIds: string[];
}

export function inspectShooterPackLoad(
  characterRoot: Object3D,
  base: ParsedColladaAsset,
  clips: ReadonlyArray<{ clipId: string; clip: AnimationClip }>,
  registeredClipIds: string[]
): ShooterPackInspection {
  const boneNames = collectSkeletonBoneNames(characterRoot);
  const validation = validateClipsAgainstSkeleton(boneNames, clips);

  console.groupCollapsed('[Shooter-Pack] Collada character loaded');
  console.info({
    sourceUrl: base.sourceUrl,
    innerPath: base.innerPath,
    rootScale: {
      x: characterRoot.scale.x,
      y: characterRoot.scale.y,
      z: characterRoot.scale.z
    },
    embeddedAnimations: base.animations.length,
    loadedClipCount: clips.length,
    registeredClipIds,
    boneCount: validation.boneCount,
    allClipsCompatible: validation.allClipsCompatible
  });

  console.groupCollapsed('[Shooter-Pack] Animation clips');
  console.table(
    validation.clipResults.map((row) => ({
      clipId: row.clipId,
      durationSeconds: row.durationSeconds,
      tracks: row.trackCount,
      compatible: row.compatible,
      missingBones: row.missingBones.length
    }))
  );
  console.groupEnd();

  const incompatible = validation.clipResults.filter((row) => !row.compatible);
  if (incompatible.length > 0) {
    console.warn('[Shooter-Pack] Clips with missing bone targets', incompatible);
  }

  console.groupEnd();

  return { base, validation, registeredClipIds };
}

export function formatInspectionForDocs(inspection: ShooterPackInspection): {
  animationsText: string;
  bonesText: string;
} {
  const lines: string[] = [
    '# Shooter-Pack — inspected Collada assets',
    `# Generated from runtime validation (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Base: ${inspection.base.sourceUrl}`,
    `Bones: ${String(inspection.validation.boneCount)}`,
    `All clips compatible: ${String(inspection.validation.allClipsCompatible)}`,
    '',
    '## Clips',
    ''
  ];

  for (const row of inspection.validation.clipResults) {
    lines.push(
      `- ${row.clipId}: duration=${String(row.durationSeconds)}s tracks=${String(row.trackCount)} compatible=${String(row.compatible)}`
    );
    if (row.missingBones.length > 0) {
      lines.push(`  missing: ${row.missingBones.slice(0, 8).join(', ')}${row.missingBones.length > 8 ? '…' : ''}`);
    }
  }

  const bonesText = [
    '# Shooter-Pack — skeleton bone names',
    `# ${String(inspection.validation.boneCount)} bones on animation-model-y-bot`,
    '',
    ...inspection.validation.boneNames.map((name) => `- ${name}`)
  ].join('\n');

  return {
    animationsText: lines.join('\n'),
    bonesText
  };
}
