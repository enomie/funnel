// Path: /Users/johann/MyBrew/funnel-real/src/player/shooter-pack-bindings.ts


export const SHOOTER_PACK_KNOWN_BINDINGS: Record<string, string> = {
  'firing-rifle': 'combat.fire',
  'jump-backward': 'locomotion.jumpBack',
  'jump-down': 'locomotion.jumpDownFull',
  'jump-down-land': 'locomotion.jumpLand',
  'jump-forward': 'locomotion.jumpForward',
  'jump-up': 'locomotion.jumpUpFull',
  'jump-up-takeoff': 'locomotion.jumpTakeoff',
  'crouch-idle': 'locomotion.crouchIdle',
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
