// Path: /Users/johann/MyBrew/funnel-real/src/home/main.ts

import {
  renderCarousels,
  renderFooter,
  renderHeroCta,
  renderKeys,
  type HomeInformation
} from './home-render';
import { bindHomeStartMatch } from './start-match';
import './home.css';

import weaponInfos from '../texts/weapon-infos.json';
import quicktips from '../texts/quicktips.json';
import pickups from '../texts/pickups.json';
import keys from '../texts/keys.json';
import information from '../texts/Information.json';

const sliderRoot = document.getElementById('home-sliders');
const keysRoot = document.getElementById('home-keys-root');
const footerRoot = document.getElementById('home-footer-root');
const heroCtaRoot = document.getElementById('home-hero-cta-root');
const heroBlurb = document.getElementById('home-hero-blurb');
const info = information as HomeInformation;

if (heroBlurb) {
  heroBlurb.textContent = info.tagline;
}
if (heroCtaRoot) {
  renderHeroCta(heroCtaRoot, info);
}

const startButtons = document.querySelectorAll<HTMLButtonElement>('.home-start');
if (startButtons.length === 0) {
  throw new Error('FUNNEL home start button was not found.');
}

bindHomeStartMatch(startButtons);

const paintHomeContent = (): void => {
  if (sliderRoot) {
    renderCarousels(sliderRoot, weaponInfos, quicktips, pickups);
  }
  if (keysRoot) {
    renderKeys(keysRoot, keys);
  }
  if (footerRoot) {
    renderFooter(footerRoot, info);
  }
};

requestAnimationFrame(paintHomeContent);

interface VisitorResponse {
  status: string;
  visits: number;
}

const visitorCountEl = document.getElementById('visitor-count');
if (visitorCountEl) {
  fetch('counter.php')
    .then((res) => {
      if (!res.ok) throw new Error('Not OK');
      return res.json() as Promise<VisitorResponse>;
    })
    .then((data) => {
      visitorCountEl.textContent =
        typeof data.visits === 'number' ? data.visits.toLocaleString() : 'Active';
    })
    .catch(() => {
      visitorCountEl.textContent = 'Active';
    });
}
