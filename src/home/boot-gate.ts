/** Session flag: home Start Match → game.html auto-boot. */

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
