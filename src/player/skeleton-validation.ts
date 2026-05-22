import { Bone, SkinnedMesh, type AnimationClip, type Object3D } from 'three/webgpu';

export interface SkeletonValidationResult {
  boneCount: number;
  boneNames: string[];
  clipResults: ClipSkeletonValidation[];
  allClipsCompatible: boolean;
}

export interface ClipSkeletonValidation {
  clipId: string;
  trackCount: number;
  durationSeconds: number;
  missingBones: string[];
  compatible: boolean;
}

export function collectSkeletonBoneNames(root: Object3D): Set<string> {
  const names = new Set<string>();
  root.traverse((object) => {
    if (object instanceof Bone) {
      names.add(object.name);
    }
  });

  root.traverse((object) => {
    if (object instanceof SkinnedMesh) {
      for (const bone of object.skeleton.bones) {
        names.add(bone.name);
      }
    }
  });

  return names;
}

export function trackTargetBoneName(trackName: string): string {
  const dot = trackName.lastIndexOf('.');
  return dot === -1 ? trackName : trackName.slice(0, dot);
}

export function validateClipsAgainstSkeleton(
  boneNames: Set<string>,
  clips: ReadonlyArray<{ clipId: string; clip: AnimationClip }>
): SkeletonValidationResult {
  const clipResults: ClipSkeletonValidation[] = clips.map(({ clipId, clip }) => {
    const targets = new Set(clip.tracks.map((track) => trackTargetBoneName(track.name)));
    const missingBones = [...targets].filter(
      (name) => name.length > 0 && !boneNames.has(name)
    );

    return {
      clipId,
      trackCount: clip.tracks.length,
      durationSeconds: round3(clip.duration),
      missingBones,
      compatible: missingBones.length === 0
    };
  });

  return {
    boneCount: boneNames.size,
    boneNames: [...boneNames].sort(),
    clipResults,
    allClipsCompatible: clipResults.every((result) => result.compatible)
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
