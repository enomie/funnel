// Path: /Users/johann/MyBrew/funnel-real/src/main.ts

import './style.css';
import { injectGameTeamCssVars } from './combat/team-css-vars';
import { waitForGameAudioUnlock } from './game-audio/audio-unlock';
import { initAppFullscreen } from './platform/browser-fullscreen';
import { initRuntimeProfile } from './platform/chrome-macos-arm-profile';
import { consumeFunnelBootIntent } from './home/boot-gate';

injectGameTeamCssVars();
initRuntimeProfile();
initAppFullscreen();

if (!consumeFunnelBootIntent()) {
  window.location.replace('./index.html');
} else {
  const appRoot = document.querySelector<HTMLDivElement>('#app');

  if (appRoot === null) {
    throw new Error('FUNNEL mount node #app was not found.');
  }

  await waitForGameAudioUnlock();

  const { startFunnelApp } = await import('./app/funnel-app');
  await startFunnelApp(appRoot);
}
