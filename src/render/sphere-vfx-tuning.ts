// Path: /Users/johann/MyBrew/funnel-real/src/render/sphere-vfx-tuning.ts

export const IMPACT_BURST_DURATION_MS = 200;
export const ROCKET_IMPACT_BURST_DURATION_MS = 440;
export const IMPACT_BURST_START_SCALE = 0.12;
export const IMPACT_BURST_OPACITY_FADE = 1.15;

const BURST_CORE_BRIGHTNESS = 1.35;
const EXPLOSIVE_BURST_CORE_BRIGHTNESS = 1.72;

export function brightenImpactColor(color: number, explosive = false): number {
  const boost = explosive ? EXPLOSIVE_BURST_CORE_BRIGHTNESS : BURST_CORE_BRIGHTNESS;
  const r = Math.min(255, ((color >> 16) & 0xff) * boost);
  const g = Math.min(255, ((color >> 8) & 0xff) * boost);
  const b = Math.min(255, (color & 0xff) * boost);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}
