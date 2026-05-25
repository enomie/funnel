// Path: /Users/johann/MyBrew/funnel-real/src/weapon-jsons/weapon-mesh-types.ts


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
