/** Visual part tint — `weapon` = solid weapon color, `glow` = same color emissive @ 0.8. */
export type WeaponMeshPartStyle = 'weapon' | 'glow';

export type WeaponMeshPart =
  | {
      readonly kind: 'box';
      readonly size: readonly [number, number, number];
      readonly position: readonly [number, number, number];
      readonly style: WeaponMeshPartStyle;
    }
  | {
      readonly kind: 'ramp';
      readonly width: number;
      readonly height: number;
      readonly depth: number;
      readonly position: readonly [number, number, number];
      readonly rotation?: readonly [number, number, number];
      readonly style: WeaponMeshPartStyle;
    };

export interface WeaponMeshDefinition {
  readonly parts: readonly WeaponMeshPart[];
}
