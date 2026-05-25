// Path: /Users/johann/MyBrew/funnel-real/src/player/humanoid-rig.ts

import type { FactionTeam } from '../combat/teams';
import type { ShooterPackCharacter } from './shooter-pack-loader';

export type HumanoidRigId = 'y-bot' | 'x-bot';

export const DEFAULT_HUMANOID_RIG: HumanoidRigId = 'y-bot';

export const HUMANOID_RIG_MODEL_FILES: Record<HumanoidRigId, string> = {
  'y-bot': 'mixamo-y-bot-t-pose.dae',
  'x-bot': 'mixamo-x-bot-t-pose.dae'
};


export const FACTION_HUMANOID_RIG: Record<FactionTeam, HumanoidRigId> = {
  alpha: 'y-bot',
  beta: 'x-bot'
};

export function factionHumanoidRig(faction: FactionTeam): HumanoidRigId {
  return FACTION_HUMANOID_RIG[faction];
}

export type ShooterPackRoster = Partial<Record<HumanoidRigId, ShooterPackCharacter>>;

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}


export function pickBotRigId(botId: string): HumanoidRigId {
  return hashUnit(botId) >= 0.5 ? 'x-bot' : 'y-bot';
}

export function resolveBotShooterPack(
  roster: ShooterPackRoster,
  botId: string
): ShooterPackCharacter | undefined {
  return roster[pickBotRigId(botId)];
}
