// Path: /Users/johann/MyBrew/funnel-real/src/ui/funnel-game-brand.ts

export const FUNNEL_GAME_BRAND_MARKUP = `
  <p class="funnel-game-brand" aria-hidden="true">
    <span class="funnel-game-brand__word">Arena</span>
    <span class="funnel-game-brand__word funnel-game-brand__word--core">Funnel</span>
    <span class="funnel-game-brand__word">Shooter</span>
  </p>
`;

export function createFunnelGameBrandElement(): HTMLParagraphElement {
  const host = document.createElement('div');
  host.innerHTML = FUNNEL_GAME_BRAND_MARKUP;
  const brand = host.firstElementChild;
  if (!(brand instanceof HTMLParagraphElement)) {
    throw new Error('FUNNEL game brand markup failed.');
  }
  return brand;
}
