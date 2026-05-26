// Path: /Users/johann/MyBrew/funnel-real/src/home/start-match.ts

import { injectGameTeamCssVars } from '../combat/team-css-vars';
import { resumeGameAudio } from '../game-audio/audio-manager';
import { initAppFullscreen } from '../platform/browser-fullscreen';
import { initRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import '../style.css';

const HOME_CHROME_SELECTOR =
  '.home-nav, .home-intro, .home-sliders, #home-keys-root, #home-footer-root';

let launchInFlight = false;

export function bindHomeStartMatch(startButtons: Iterable<HTMLButtonElement>): void {
  for (const startButton of startButtons) {
    startButton.addEventListener('click', () => {
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

  resumeGameAudio();

  hideHomeChrome();
  prepareGameDocument();

  const appRoot = ensureAppRoot();
  const { startFunnelApp } = await import('../app/funnel-app');
  await startFunnelApp(appRoot);
}

function hideHomeChrome(): void {
  document.body.classList.remove('home');

  for (const node of document.querySelectorAll(HOME_CHROME_SELECTOR)) {
    (node as HTMLElement).hidden = true;
  }
}

function prepareGameDocument(): void {
  injectGameTeamCssVars();
  initRuntimeProfile();
  initAppFullscreen();
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
