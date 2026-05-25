import { markFunnelBootIntent } from './boot-gate';
import { initRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import './home.css';

initRuntimeProfile();

const startButton = document.querySelector<HTMLButtonElement>('.funnel-home__start');

if (startButton === null) {
  throw new Error('FUNNEL home start button was not found.');
}

startButton.addEventListener('click', () => {
  markFunnelBootIntent();
  window.location.assign('./game.html');
});
