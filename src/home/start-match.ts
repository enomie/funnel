// Path: /Users/johann/MyBrew/funnel-real/src/home/start-match.ts

import { AudioContextEngine } from '../game-audio/audio-mixer';
import { showLaunchVeil } from './launch-veil';

const HOME_CHROME_SELECTOR =
  '.home-nav, .home-intro, .home-sliders, #home-keys-root, #home-footer-root';

let launchInFlight = false;

export function bindHomeStartMatch(startButtons: Iterable<HTMLButtonElement>): void {
  for (const startButton of startButtons) {
    startButton.addEventListener('click', () => {
      AudioContextEngine.get().resume();
      void launchMatchFromHome(startButton);
    });
  }
}

async function launchMatchFromHome(trigger: HTMLButtonElement): Promise<void> {
  if (launchInFlight) {
    return;
  }

  launchInFlight = true;
  trigger.disabled = true;

  showLaunchVeil();
  hideHomeChrome();

  const [{ injectGameTeamCssVars }, { initAppFullscreen }, { initRuntimeProfile }] =
    await Promise.all([
      import('../combat/team-css-vars'),
      import('../platform/browser-fullscreen'),
      import('../platform/chrome-macos-arm-profile'),
      import('../style.css')
    ]);

  injectGameTeamCssVars();
  initRuntimeProfile();
  initAppFullscreen();

  const appRoot = ensureAppRoot();
  const { startFunnelApp } = await import('../app/funnel-app');
  await startFunnelApp(appRoot);
}

function hideHomeChrome(): void {
  document.body.classList.remove('home');

  for (const node of document.querySelectorAll(HOME_CHROME_SELECTOR)) {
    const el = node as HTMLElement;
    el.hidden = true;
    el.style.display = 'none';
  }
}

function ensureAppRoot(): HTMLDivElement {
  let appRoot = document.getElementById('app');

  if (appRoot === null) {
    appRoot = document.createElement('div');
    appRoot.id = 'app';
    document.body.append(appRoot);
  }

  appRoot.hidden = false;
  return appRoot as HTMLDivElement;
}
