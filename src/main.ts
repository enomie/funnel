import './style.css';
import { initAppFullscreen } from './platform/browser-fullscreen';
import { initRuntimeProfile } from './platform/chrome-macos-arm-profile';
import { consumeFunnelBootIntent } from './home/boot-gate';

initRuntimeProfile();
initAppFullscreen();

if (!consumeFunnelBootIntent()) {
  window.location.replace('./index.html');
} else {
  const appRoot = document.querySelector<HTMLDivElement>('#app');

  if (appRoot === null) {
    throw new Error('FUNNEL mount node #app was not found.');
  }

  const { startFunnelApp } = await import('./app/funnel-app');
  await startFunnelApp(appRoot);
}
