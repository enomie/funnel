// Path: /Users/johann/MyBrew/funnel-real/src/home/boot-gate.ts



export const FUNNEL_BOOT_SESSION_KEY = 'funnel:boot';

export function markFunnelBootIntent(): void {
  sessionStorage.setItem(FUNNEL_BOOT_SESSION_KEY, '1');
}

export function consumeFunnelBootIntent(): boolean {
  if (sessionStorage.getItem(FUNNEL_BOOT_SESSION_KEY) !== '1') {
    return false;
  }

  sessionStorage.removeItem(FUNNEL_BOOT_SESSION_KEY);
  return true;
}
