---
name: funnel-weapons
description: >-
  Implement or extend FUNNEL UT99-style weapons, fire modes, projectiles, hitscan,
  ricochets, Shock combo, and ImpactProfile. Use for weapon-arsenal, weapon-definitions,
  projectile-visuals, hitscan, LMB/RMB alt-fire, or arsenal slots 1–0.
---

# FUNNEL Weapons

## Current code

- Definitions: `src/combat/weapon-definitions.ts` (`WeaponDefinition`, slots `1`–`0`)
- Runtime: `src/combat/weapon-arsenal.ts` (projectiles, Ripper ricochet, trails, lights)
- Visuals: `src/combat/projectile-visuals.ts`
- Hitscan stub: `src/combat/hitscan-weapon.ts`

Primary fire only today; RMB is still ADS globally — **migrate RMB to alt-fire** per intro priority.

## Implementation priority (from intro)

1. Input: `primaryHeld/Pressed/Released`, `secondaryHeld/Pressed/Released` in `src/input/input-state.ts`
2. Split `WeaponDefinition` → `primary` + `secondary` `FireProfile` each with its own `ImpactProfile`
3. Simple RMB first: Pistol burst, Flak grenade, Ripper explosive disk, Gatling high-spread
4. Complex: Shock combo (beam hits orb), Rocket charge (up to 5), Bio charge, Redeemer guided

## Fire vs impact

LMB/RMB may differ in **flight** and **impact**. Model impacts separately:

| Field | Purpose |
|-------|---------|
| `directDamage` | Single-target hit |
| `splashRadius` / `splashDamage` | AoE |
| `impulse` | Kinetic push on rigid bodies / build pieces |
| `ricochet` | Wall bounces (Ripper LMB) |
| `stickiness` | Bio cling / delayed detonation |
| `childProjectiles` | Flak shrapnel, bio split |
| `damageOverTime` | Acid puddles |
| `effectKind` | VFX/audio routing |

## Weapon reference

| Slot | Weapon | LMB | RMB |
|------|--------|-----|-----|
| 1 | Pistol | precise semi-auto | faster burst, less accurate |
| 2 | Shock | instant beam | slow orb; beam+orb = combo explosion |
| 3 | Rocket | 1 rocket / hold load up to 5 | grenades or tight spiral volley |
| 4 | Ripper | fast disk, 3 ricochets | explosive disk, no bounce |
| 5 | Flak | close shrapnel cone | arcing grenade splash |
| 6 | Sniper | precision hitscan, headshot | zoom (weapon-specific) |
| 7 | Gatling | controlled sustained fire | max ROF, more spread |
| 8 | Pulse | plasma bolts | short range beam stream |
| 9 | Bio | small sticky clumps | charged large blob, splits on impact |
| 0 | Redeemer | mini-nuke | guided nuke, player vulnerable |

Full impact notes: [reference.md](reference.md) and `docs/introduction.md` §7.

## Ripper pattern (existing)

Ray-step each frame → on hit, reflect direction from Rapier normal → `BOUNCE_SURFACE_NUDGE` → continue same frame if ricochets remain → damage on actor/build collider.

## UT reference

[UT GOTY Manual (EN)](https://www.mogelpower.de/manuals/Unreal_Tournament_Game_of_the_Year_Edition_Manual_Englisch.pdf)
