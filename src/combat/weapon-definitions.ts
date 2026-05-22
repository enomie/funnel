export type ProjectileVisualKind =
  | 'pistol'
  | 'shock'
  | 'rocket'
  | 'ripper'
  | 'flak'
  | 'sniper'
  | 'gatling'
  | 'pulse'
  | 'bio'
  | 'redeemer';

export interface WeaponDefinition {
  slotLabel: string;
  name: string;
  color: number;
  width: number;
  length: number;
  height: number;
  fireIntervalMs: number;
  projectileCount: number;
  spreadRadians: number;
  speed: number;
  maxDistance: number;
  damage: number;
  visualKind: ProjectileVisualKind;
  impactRadius: number;
}

export const WEAPON_DEFINITIONS: readonly WeaponDefinition[] = [
  {
    slotLabel: '1',
    name: 'Pistol',
    color: 0xffc35a,
    width: 0.18,
    length: 0.72,
    height: 0.24,
    fireIntervalMs: 180,
    projectileCount: 1,
    spreadRadians: 0,
    speed: 92,
    maxDistance: 120,
    damage: 22,
    visualKind: 'pistol',
    impactRadius: 0.13
  },
  {
    slotLabel: '2',
    name: 'Shock Blaster',
    color: 0x6ff7ff,
    width: 0.32,
    length: 1.18,
    height: 0.34,
    fireIntervalMs: 360,
    projectileCount: 1,
    spreadRadians: 0,
    speed: 42,
    maxDistance: 110,
    damage: 48,
    visualKind: 'shock',
    impactRadius: 0.28
  },
  {
    slotLabel: '3',
    name: 'Rocket Launcher',
    color: 0xff5a1f,
    width: 0.48,
    length: 1.42,
    height: 0.42,
    fireIntervalMs: 520,
    projectileCount: 1,
    spreadRadians: 0,
    speed: 34,
    maxDistance: 135,
    damage: 84,
    visualKind: 'rocket',
    impactRadius: 0.38
  },
  {
    slotLabel: '4',
    name: 'Ripper',
    color: 0xff4ecb,
    width: 0.36,
    length: 1.02,
    height: 0.3,
    fireIntervalMs: 260,
    projectileCount: 1,
    spreadRadians: 0,
    speed: 76,
    maxDistance: 155,
    damage: 38,
    visualKind: 'ripper',
    impactRadius: 0.2
  },
  {
    slotLabel: '5',
    name: 'Flak Cannon',
    color: 0xff8d3b,
    width: 0.56,
    length: 1.12,
    height: 0.5,
    fireIntervalMs: 720,
    projectileCount: 9,
    spreadRadians: 0.13,
    speed: 58,
    maxDistance: 62,
    damage: 14,
    visualKind: 'flak',
    impactRadius: 0.16
  },
  {
    slotLabel: '6',
    name: 'Sniper Rifle',
    color: 0xd9f6ff,
    width: 0.22,
    length: 1.72,
    height: 0.24,
    fireIntervalMs: 900,
    projectileCount: 1,
    spreadRadians: 0,
    speed: 170,
    maxDistance: 210,
    damage: 110,
    visualKind: 'sniper',
    impactRadius: 0.18
  },
  {
    slotLabel: '7',
    name: 'Gatling',
    color: 0xb6ff57,
    width: 0.42,
    length: 1.28,
    height: 0.36,
    fireIntervalMs: 72,
    projectileCount: 1,
    spreadRadians: 0.025,
    speed: 120,
    maxDistance: 145,
    damage: 11,
    visualKind: 'gatling',
    impactRadius: 0.1
  },
  {
    slotLabel: '8',
    name: 'Pulse Lance',
    color: 0x4dffad,
    width: 0.28,
    length: 1.06,
    height: 0.32,
    fireIntervalMs: 140,
    projectileCount: 1,
    spreadRadians: 0.01,
    speed: 70,
    maxDistance: 130,
    damage: 24,
    visualKind: 'pulse',
    impactRadius: 0.18
  },
  {
    slotLabel: '9',
    name: 'Bio Lobber',
    color: 0x8dff31,
    width: 0.5,
    length: 0.96,
    height: 0.46,
    fireIntervalMs: 620,
    projectileCount: 1,
    spreadRadians: 0.02,
    speed: 28,
    maxDistance: 70,
    damage: 62,
    visualKind: 'bio',
    impactRadius: 0.32
  },
  {
    slotLabel: '0',
    name: 'Redeemer Seed',
    color: 0xffe66d,
    width: 0.64,
    length: 1.58,
    height: 0.58,
    fireIntervalMs: 1100,
    projectileCount: 1,
    spreadRadians: 0,
    speed: 22,
    maxDistance: 150,
    damage: 135,
    visualKind: 'redeemer',
    impactRadius: 0.58
  }
] as const;
