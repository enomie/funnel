import type { AnimationClip } from 'three/webgpu';
import { isLowerBodyTrack } from './animation-bone-groups';

/** Keep spine/arms/head only so locomotion legs can keep running under fire. */
export function clipToUpperBodyOnly(clip: AnimationClip): AnimationClip {
  const tracks = clip.tracks.filter((track) => !isLowerBodyTrack(track.name));

  if (tracks.length === clip.tracks.length) {
    return clip;
  }

  const upper = clip.clone();
  upper.tracks = tracks;
  upper.resetDuration();
  return upper;
}
