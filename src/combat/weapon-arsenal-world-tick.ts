// Path: /Users/johann/MyBrew/funnel-real/src/combat/weapon-arsenal-world-tick.ts

/**
 * Pending-queue dispatcher for WeaponArsenal world ticks — avoids scanning every
 * idle arsenal via the global world-effects Set each frame (15v15 ≈ 30 actors).
 */

export interface WeaponArsenalWorldTickable {
  needsWorldTick(nowMs: number): boolean;
  tickWorld(nowMs: number, deltaSeconds: number, shedNonCritical?: boolean): void;
}

const REGISTERED: WeaponArsenalWorldTickable[] = [];
const PENDING = new Set<WeaponArsenalWorldTickable>();
const PENDING_LIST: WeaponArsenalWorldTickable[] = [];

export function registerWeaponArsenal(arsenal: WeaponArsenalWorldTickable): void {
  REGISTERED.push(arsenal);
}

export function unregisterWeaponArsenal(arsenal: WeaponArsenalWorldTickable): void {
  unscheduleWeaponArsenalWorldTick(arsenal);
  const index = REGISTERED.indexOf(arsenal);
  if (index < 0) {
    return;
  }

  REGISTERED[index] = REGISTERED[REGISTERED.length - 1];
  REGISTERED.length -= 1;
}

export function scheduleWeaponArsenalWorldTick(arsenal: WeaponArsenalWorldTickable): void {
  if (PENDING.has(arsenal)) {
    return;
  }

  PENDING.add(arsenal);
  PENDING_LIST.push(arsenal);
}

export function unscheduleWeaponArsenalWorldTick(arsenal: WeaponArsenalWorldTickable): void {
  PENDING.delete(arsenal);
}

export function tickAllWeaponArsenalWorldTicks(
  nowMs: number,
  deltaSeconds: number,
  shedNonCritical = false
): void {
  for (let index = PENDING_LIST.length - 1; index >= 0; index -= 1) {
    const arsenal = PENDING_LIST[index];
    if (!PENDING.has(arsenal)) {
      continue;
    }

    if (!arsenal.needsWorldTick(nowMs)) {
      PENDING.delete(arsenal);
      PENDING_LIST[index] = PENDING_LIST[PENDING_LIST.length - 1];
      PENDING_LIST.pop();
      continue;
    }

    arsenal.tickWorld(nowMs, deltaSeconds, shedNonCritical);

    if (!arsenal.needsWorldTick(nowMs)) {
      PENDING.delete(arsenal);
      PENDING_LIST[index] = PENDING_LIST[PENDING_LIST.length - 1];
      PENDING_LIST.pop();
    }
  }

  compactPendingListIfNeeded();
}

export function drainAllWeaponArsenalWorldTicks(): void {
  PENDING.clear();
  PENDING_LIST.length = 0;
  REGISTERED.length = 0;
}

function compactPendingListIfNeeded(): void {
  if (PENDING_LIST.length <= PENDING.size + 8) {
    return;
  }

  let write = 0;
  for (let read = 0; read < PENDING_LIST.length; read += 1) {
    const arsenal = PENDING_LIST[read];
    if (PENDING.has(arsenal)) {
      PENDING_LIST[write] = arsenal;
      write += 1;
    }
  }
  PENDING_LIST.length = write;
}
