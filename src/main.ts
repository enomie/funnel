import './style.css';
import { startFunnelApp } from './app/funnel-app';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (appRoot === null) {
  throw new Error('FUNNEL mount node #app was not found.');
}

await startFunnelApp(appRoot);
