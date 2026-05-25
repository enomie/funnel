// Path: /Users/johann/MyBrew/funnel-real/src/combat/world-effects-registry.ts

/**
 * World combat/VFX sources. Lifecycle cleanup (impact burst tick, flash sweep,
 * smoke TTL) must run even under load shed — only spawn/sync paths may honor
 * `shedNonCritical` inside each source's `tickWorld`.
 */

export interface WorldEffectsSource {
  needsWorldTick(nowMs: number): boolean;
  tickWorld(nowMs: number, deltaSeconds: number, shedNonCritical?: boolean): void;
}

const SOURCES = new Set<WorldEffectsSource>();

export function registerWorldEffectsSource(source: WorldEffectsSource): void {
  SOURCES.add(source);
}

export function unregisterWorldEffectsSource(source: WorldEffectsSource): void {
  SOURCES.delete(source);
}

export function tickAllWorldEffects(
  nowMs: number,
  deltaSeconds: number,
  shedNonCritical = false
): void {
  for (const source of SOURCES) {
    if (!source.needsWorldTick(nowMs)) {
      continue;
    }
    source.tickWorld(nowMs, deltaSeconds, shedNonCritical);
  }
}

export function drainAllWorldEffects(): void {
  SOURCES.clear();
}
