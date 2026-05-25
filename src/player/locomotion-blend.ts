// Path: /Users/johann/MyBrew/funnel-real/src/player/locomotion-blend.ts



export type LocomotionBlendRole = 'forward' | 'strafe';

export interface LocomotionBlendLayer {
  role: LocomotionBlendRole;
  clipId: string;
  weight: number;
}

export interface LocomotionBlendInput {
  movement: {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
  };
  sprint: boolean;
}

const CLIP = {
  idle: 'rifle-aiming-idle',
  forwardWalk: 'walking',
  forwardRun: 'rifle-run',
  backwardWalk: 'walking-backwards',
  backwardRun: 'run-backwards',
  strafeLeft: 'strafe-2',
  strafeRight: 'strafe'
} as const;


export function normalizedLocomotionAxes(input: LocomotionBlendInput): {
  forward: number;
  strafe: number;
} {
  let forward = 0;
  let strafe = 0;

  if (input.movement.forward) {
    forward += 1;
  }
  if (input.movement.back) {
    forward -= 1;
  }
  if (input.movement.right) {
    strafe += 1;
  }
  if (input.movement.left) {
    strafe -= 1;
  }

  const length = Math.hypot(forward, strafe);
  if (length < 0.001) {
    return { forward: 0, strafe: 0 };
  }

  return { forward: forward / length, strafe: strafe / length };
}

function forwardClipId(axis: number, sprint: boolean): string {
  if (axis > 0) {
    return sprint ? CLIP.forwardRun : CLIP.forwardWalk;
  }
  return sprint ? CLIP.backwardRun : CLIP.backwardWalk;
}

function strafeClipId(axis: number): string {
  return axis < 0 ? CLIP.strafeLeft : CLIP.strafeRight;
}

export interface LocomotionBlendResult {
  idle: boolean;
  layers: LocomotionBlendLayer[];
  dominantClipId: string;
}


export function resolveLocomotionBlendInto(
  out: LocomotionBlendResult,
  input: LocomotionBlendInput
): LocomotionBlendResult {
  const { forward, strafe } = normalizedLocomotionAxes(input);
  const absForward = Math.abs(forward);
  const absStrafe = Math.abs(strafe);
  const sum = absForward + absStrafe;

  if (sum < 0.001) {
    out.idle = true;
    out.layers.length = 0;
    out.dominantClipId = CLIP.idle;
    return out;
  }

  let layerCount = 0;

  if (absForward > 0.001) {
    const slot = out.layers[layerCount] ?? {
      role: 'forward' as LocomotionBlendRole,
      clipId: CLIP.forwardWalk,
      weight: 0
    };
    slot.role = 'forward';
    slot.clipId = forwardClipId(forward, input.sprint);
    slot.weight = absForward / sum;
    out.layers[layerCount] = slot;
    layerCount += 1;
  }

  if (absStrafe > 0.001) {
    const slot = out.layers[layerCount] ?? {
      role: 'strafe' as LocomotionBlendRole,
      clipId: CLIP.strafeLeft,
      weight: 0
    };
    slot.role = 'strafe';
    slot.clipId = strafeClipId(strafe);
    slot.weight = absStrafe / sum;
    out.layers[layerCount] = slot;
    layerCount += 1;
  }

  out.layers.length = layerCount;
  out.idle = false;

  let dominant = out.layers[0];
  for (let index = 1; index < layerCount; index += 1) {
    const layer = out.layers[index];
    if (layer.weight > dominant.weight) {
      dominant = layer;
    }
  }

  out.dominantClipId = dominant.clipId;
  return out;
}

export function resolveLocomotionBlend(input: LocomotionBlendInput): LocomotionBlendResult {
  return resolveLocomotionBlendInto({ idle: true, layers: [], dominantClipId: CLIP.idle }, input);
}
