// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-nav-ray-budget.ts

import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';


export const NAV_RAY_REFRESH_BUDGET_PER_FRAME = getRuntimeProfile().navRayBudgetPerFrame;


export const ROUTE_STEER_FAN_BUDGET_PER_FRAME = getRuntimeProfile().routeSteerFanBudgetPerFrame;

let frameIndex = 0;
let navRefreshesThisFrame = 0;
let routeSteerFanRefreshesThisFrame = 0;

export function beginNavRayBudgetFrame(): void {
  frameIndex += 1;
  navRefreshesThisFrame = 0;
  routeSteerFanRefreshesThisFrame = 0;
}


export function isRouteSteerProbeDue(phaseSlot: number, phaseSlotCount: number): boolean {
  const slots = Math.max(1, phaseSlotCount);
  return (frameIndex + phaseSlot) % slots === 0;
}


export function tryAcquireNavRayRefresh(): boolean {
  if (navRefreshesThisFrame >= NAV_RAY_REFRESH_BUDGET_PER_FRAME) {
    return false;
  }

  navRefreshesThisFrame += 1;
  return true;
}


export function tryAcquireRouteSteerFanRefresh(): boolean {
  if (routeSteerFanRefreshesThisFrame >= ROUTE_STEER_FAN_BUDGET_PER_FRAME) {
    return false;
  }

  routeSteerFanRefreshesThisFrame += 1;
  return true;
}
