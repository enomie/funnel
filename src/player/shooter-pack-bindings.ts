/** Clips wired into `locomotion-anim-controller` (or other systems). */
export const SHOOTER_PACK_KNOWN_BINDINGS: Record<string, string> = {
  'firing-rifle': 'combat.fire',
  'jump-backward': 'locomotion.jumpBack',
  'jump-forward': 'locomotion.jumpForward',
  'rifle-aiming-idle': 'locomotion.idle',
  'rifle-run': 'locomotion.forwardRun',
  'run-backwards': 'locomotion.backwardRun',
  'start-walking': 'locomotion.forwardStart',
  'start-walking-backwards': 'locomotion.backwardStart',
  'stop-walking': 'locomotion.forwardStop',
  'strafe-2': 'locomotion.strafeLeft',
  strafe: 'locomotion.strafeRight',
  'walk-backwards-stop': 'locomotion.backwardStop',
  'walking-backwards': 'locomotion.backwardWalk',
  'walking-to-dying': 'vitals.death',
  walking: 'locomotion.forwardWalk'
};

export function logUnboundShooterPackClips(clipIds: readonly string[]): void {
  const unbound = clipIds.filter((clipId) => !(clipId in SHOOTER_PACK_KNOWN_BINDINGS));
  if (unbound.length === 0) {
    return;
  }

  console.info(
    '[Shooter-Pack] Loaded clips without gameplay binding (add to locomotion FSM or bindings):',
    unbound
  );
}
