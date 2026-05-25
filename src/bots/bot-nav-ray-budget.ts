import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';

/** Max nav goal refreshes (~115 Rapier rays each) per render frame — all stuck phases included. */
export const NAV_RAY_REFRESH_BUDGET_PER_FRAME = getRuntimeProfile().navRayBudgetPerFrame;

/** Max route-steer fan solves (~12 capsule shape casts each) per render frame. */
export const ROUTE_STEER_FAN_BUDGET_PER_FRAME = getRuntimeProfile().routeSteerFanBudgetPerFrame;

let frameIndex = 0;
let navRefreshesThisFrame = 0;
let routeSteerFanRefreshesThisFrame = 0;

export function beginNavRayBudgetFrame(): void {
  frameIndex += 1;
  navRefreshesThisFrame = 0;
  routeSteerFanRefreshesThisFrame = 0;
}

/** Stagger cheap forward probes — one slot group per frame (`phaseSlotCount` bots spread). */
export function isRouteSteerProbeDue(phaseSlot: number, phaseSlotCount: number): boolean {
  const slots = Math.max(1, phaseSlotCount);
  return (frameIndex + phaseSlot) % slots === 0;
}

/** Returns false when the per-frame ray budget is exhausted — caller keeps accumulator due. */
export function tryAcquireNavRayRefresh(): boolean {
  if (navRefreshesThisFrame >= NAV_RAY_REFRESH_BUDGET_PER_FRAME) {
    return false;
  }

  navRefreshesThisFrame += 1;
  return true;
}

/** Returns false when the per-frame fan budget is exhausted — caller keeps prior steer snapshot. */
export function tryAcquireRouteSteerFanRefresh(): boolean {
  if (routeSteerFanRefreshesThisFrame >= ROUTE_STEER_FAN_BUDGET_PER_FRAME) {
    return false;
  }

  routeSteerFanRefreshesThisFrame += 1;
  return true;
}
