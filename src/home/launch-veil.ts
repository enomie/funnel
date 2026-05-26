// Path: /Users/johann/MyBrew/funnel-real/src/home/launch-veil.ts

const LAUNCH_VEIL_ID = 'funnel-launch-veil';

export function showLaunchVeil(): void {
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  let veil = document.getElementById(LAUNCH_VEIL_ID);
  if (veil === null) {
    veil = document.createElement('div');
    veil.id = LAUNCH_VEIL_ID;
    veil.setAttribute('aria-hidden', 'true');
    document.body.append(veil);
  }

  veil.style.cssText =
    'position:fixed;inset:0;z-index:99999;background-color:#070c13;pointer-events:none';
  veil.hidden = false;
}

export function dismissLaunchVeil(): void {
  const veil = document.getElementById(LAUNCH_VEIL_ID);
  if (veil !== null) {
    veil.hidden = true;
  }
}
