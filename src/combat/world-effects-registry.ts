// Path: /Users/johann/MyBrew/funnel-real/src/combat/world-effects-registry.ts



export interface WorldEffectsSource {
  needsWorldTick(nowMs: number): boolean;
  tickWorld(nowMs: number, deltaSeconds: number): void;
}

const SOURCES = new Set<WorldEffectsSource>();

export function registerWorldEffectsSource(source: WorldEffectsSource): void {
  SOURCES.add(source);
}

export function unregisterWorldEffectsSource(source: WorldEffectsSource): void {
  SOURCES.delete(source);
}

export function tickAllWorldEffects(nowMs: number, deltaSeconds: number): void {
  for (const source of SOURCES) {
    if (!source.needsWorldTick(nowMs)) {
      continue;
    }
    source.tickWorld(nowMs, deltaSeconds);
  }
}

export function drainAllWorldEffects(): void {
  SOURCES.clear();
}
