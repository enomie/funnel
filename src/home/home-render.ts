// Path: /Users/johann/MyBrew/funnel-real/src/home/home-render.ts

interface WeaponInfo {
  name: string;
  shortName: string;
  color: string;
  description: string;
  lmbDescription: string;
  rmbDescription: string;
  comboDescription: string;
}

interface QuickTip {
  name: string;
  description: string;
}

interface PickupInfo {
  name: string;
  color?: string;
  description: string;
}

interface KeyBinding {
  action: string;
  keys: string;
}

interface PlatformChip {
  icon: string;
  label: string;
}

export interface HomeInformation {
  version: string;
  versionDate: string;
  license: string;
  licenseUrl: string;
  technology: string;
  publisher: { name: string; url: string; label: string };
  publishedAt: { name: string; url: string; label: string };
  tagline: string;
  warning: string;
  platforms: PlatformChip[];
  matchGoal: string;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function externalLink(href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function weaponCard(slot: string, weapon: WeaponInfo): HTMLElement {
  const card = el('article', 'home-card home-card--weapon');
  card.style.setProperty('--card-accent', weapon.color);

  const head = el('header', 'home-card__head');
  head.append(el('span', 'home-card__slot', slot), el('h3', 'home-card__title', weapon.name));
  card.append(head);

  const body = el('div', 'home-card__body');
  body.append(el('p', 'home-card__lead', weapon.description));
  body.append(el('p', 'home-card__fire', `LMB — ${weapon.lmbDescription}`));
  body.append(el('p', 'home-card__fire', `RMB — ${weapon.rmbDescription}`));
  if (weapon.comboDescription) {
    body.append(el('p', 'home-card__combo', weapon.comboDescription));
  }
  card.append(body);
  return card;
}

function tipCard(tip: QuickTip): HTMLElement {
  const card = el('article', 'home-card home-card--tip');
  card.append(el('h3', 'home-card__title', tip.name));
  card.append(el('p', 'home-card__lead', tip.description));
  return card;
}

function pickupCard(pickup: PickupInfo): HTMLElement {
  const card = el('article', 'home-card home-card--pickup');
  if (pickup.color) card.style.setProperty('--card-accent', pickup.color);
  card.append(el('h3', 'home-card__title', pickup.name));
  card.append(el('p', 'home-card__lead', pickup.description));
  return card;
}

function buildInfiniteTrack(cards: HTMLElement[]): HTMLElement {
  const track = el('div', 'home-slider__track');
  const groupA = el('div', 'home-slider__group');
  const groupB = el('div', 'home-slider__group');
  for (const card of cards) {
    groupA.append(card);
    groupB.append(card.cloneNode(true));
  }
  track.append(groupA, groupB);
  return track;
}

function cardsOverflowViewport(viewport: HTMLElement, cards: HTMLElement[]): boolean {
  const probe = el('div', 'home-slider__static home-slider__static--probe');
  for (const card of cards) {
    probe.append(card.cloneNode(true));
  }
  viewport.append(probe);
  const overflow = probe.scrollWidth > viewport.clientWidth + 1;
  probe.remove();
  return overflow;
}

function mountCardSection(
  container: HTMLElement,
  title: string,
  cards: HTMLElement[],
  speedSec: number,
  mode: 'slide' | 'auto' = 'auto'
): void {
  const section = el('section', 'home-slider');
  section.append(el('h2', 'home-slider__heading', title));

  const viewport = el('div', 'home-slider__viewport');
  section.append(viewport);
  container.append(section);

  const useSlide = mode === 'slide' || cardsOverflowViewport(viewport, cards);

  if (useSlide) {
    const clip = el('div', 'home-slider__clip');
    const track = buildInfiniteTrack(cards);
    track.style.setProperty('--slider-duration', `${String(speedSec)}s`);
    clip.append(track);
    viewport.append(clip);
    return;
  }

  section.classList.add('home-slider--static');
  const row = el('div', 'home-slider__static');
  for (const card of cards) {
    row.append(card);
  }
  viewport.append(row);
}

export function renderCarousels(
  root: HTMLElement,
  weapons: Record<string, WeaponInfo>,
  tips: QuickTip[],
  pickups: Record<string, PickupInfo>
): void {
  const weaponCards = Object.entries(weapons)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([slot, info]) => weaponCard(slot, info));

  const tipCards = tips.map(tipCard);
  const pickupCards = Object.values(pickups).map(pickupCard);

  mountCardSection(root, 'Weapons', weaponCards, 55, 'slide');
  mountCardSection(root, 'Quick Tips', tipCards, 38, 'auto');
  mountCardSection(root, 'Pickups', pickupCards, 28, 'auto');
}

function platformChip(chip: PlatformChip): HTMLElement {
  const span = el('span', 'home-hero-cta__platform-chip');
  const img = document.createElement('img');
  img.className = 'home-hero-cta__platform-icon';
  img.src = chip.icon;
  img.width = 12;
  img.height = 12;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  span.append(img, document.createTextNode(` ${chip.label}`));
  return span;
}

export function renderHeroCta(root: HTMLElement, info: HomeInformation): void {
  const warning = el('p', 'home-hero-cta__warning');
  warning.append(el('strong', undefined, 'Warning:'), document.createTextNode(` ${info.warning}`));

  const start = el('button', 'home-start home-hero-cta__start', 'Start Match');
  start.type = 'button';

  const platforms = el('p', 'home-hero-cta__platforms');
  platforms.append(document.createTextNode('Optimized for'));
  for (const chip of info.platforms) {
    platforms.append(document.createTextNode(' '));
    platforms.append(platformChip(chip));
  }

  root.append(warning, start, platforms);
}

export function renderKeys(root: HTMLElement, keys: KeyBinding[]): void {
  const section = el('section', 'home-keys');
  section.append(el('h2', 'home-keys__heading', 'Controls'));

  const grid = el('dl', 'home-keys__grid');
  for (const row of keys) {
    grid.append(el('dt', undefined, row.action), el('dd', undefined, row.keys));
  }
  section.append(grid);
  root.append(section);
}

export function renderFooter(root: HTMLElement, info: HomeInformation): void {
  const footer = el('footer', 'home-footer');

  const meta = el('p', 'home-footer__meta');
  meta.append(
    document.createTextNode(`${info.license} · V ${info.version} ${info.versionDate} · ${info.technology}`)
  );
  footer.append(meta);

  const credits = el('p', 'home-footer__credits');
  credits.append(document.createTextNode(`${info.publisher.label} `));
  credits.append(externalLink(info.publisher.url, info.publisher.name));
  credits.append(document.createTextNode(` — ${info.publishedAt.label} `));
  credits.append(externalLink(info.publishedAt.url, info.publishedAt.name));
  footer.append(credits);

  const visitor = el('p', 'home-footer__visitor');
  visitor.append(el('span', 'home-footer__dot', ''));
  visitor.append(document.createTextNode(' Visitors: '));
  const visitorCount = el('strong', undefined, '...');
  visitorCount.id = 'visitor-count';
  visitor.append(visitorCount);
  footer.append(visitor);

  root.append(footer);
}
