// Path: /Users/johann/MyBrew/funnel-real/src/player/collada-strip-root-motion.ts

import type { AnimationClip } from 'three/webgpu';


const STRIP_POSITION_TRACK_PREFIXES = ['mixamorig_Hips'];

export function stripInPlaceRootMotion(clip: AnimationClip, _clipId?: string): AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    if (!track.name.endsWith('.position')) {
      return true;
    }

    return !STRIP_POSITION_TRACK_PREFIXES.some((prefix) => track.name.startsWith(prefix));
  });

  if (tracks.length === clip.tracks.length) {
    return clip;
  }

  const stripped = clip.clone();
  stripped.tracks = tracks;
  stripped.resetDuration();
  return stripped;
}
