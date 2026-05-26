// Path: /Users/johann/MyBrew/funnel-real/src/arena/team-spawn-mascots.ts

import { Group, type Object3D, type Scene } from 'three/webgpu';
import { ENVIRONMENT_CONFIG } from '../config/game-config';
import {
  enableHumanoidCastShadows,
  createHumanoidFallbackMesh,
  resetHumanoidBindPose
} from '../player/humanoid-visual-mount';
import { factionHumanoidRig, type HumanoidRigId } from '../player/humanoid-rig';
import { lowestSkinnedMeshYInCapsuleSpace } from '../player/player-mesh-foot-anchor';
import { cloneShooterPackModel } from '../player/shooter-pack-clone';
import {
  getShooterPackModelTemplate,
  type ShooterPackCharacter
} from '../player/shooter-pack-loader';
import type { PlayerTeam } from '../player/player-team';
import {
  attachHumanoidEyes,
  HUMANOID_EYE_BIND_POSE_VERTICAL_CM
} from '../player/humanoid-eye-visual';
import { applyRelativeTeamColors } from '../player/team-visual-colors';
import type { RelativeTeamRole } from '../combat/team-color-derive';
import { FACTION_TEAMS, type FactionTeam } from '../combat/teams';
import { teamBulkheadZ, yawTowardFunnelCenter } from './spawn-shield-cubes';

export const TEAM_SPAWN_MASCOT_OFFSET_FROM_BULKHEAD_M = 1;
export const TEAM_SPAWN_MASCOT_PEDESTAL_SIZE_M = 2;
export const TEAM_SPAWN_MASCOT_PEDESTAL_HEIGHT_M = 1;

export function teamSpawnMascotElevationY(): number {
  return TEAM_SPAWN_MASCOT_PEDESTAL_HEIGHT_M;
}

export function teamSpawnMascotPedestalCenterY(): number {
  return TEAM_SPAWN_MASCOT_PEDESTAL_HEIGHT_M * 0.5;
}

export function isTeamSpawnMascotsEnabled(): boolean {
  return ENVIRONMENT_CONFIG.teamSpawnMascotsEnabled;
}

export function teamSpawnMascotZ(faction: FactionTeam): number {
  const bulkheadZ = teamBulkheadZ(faction);
  const towardCenter = -Math.sign(bulkheadZ);
  return bulkheadZ + towardCenter * TEAM_SPAWN_MASCOT_OFFSET_FROM_BULKHEAD_M;
}

const MASCOT_RIG_IDS: readonly HumanoidRigId[] = ['y-bot', 'x-bot'];
const bindPoseTemplates = new Map<HumanoidRigId, Object3D>();

interface MascotEntry {
  readonly root: Group;
  readonly faction: FactionTeam;
}

function anchorBindPoseFeetOnFloor(model: Object3D): void {
  const capsuleAnchor = new Group();
  model.position.set(0, 0, 0);
  capsuleAnchor.add(model);

  const meshBottomY = lowestSkinnedMeshYInCapsuleSpace(model, capsuleAnchor);
  capsuleAnchor.remove(model);
  model.position.y = -meshBottomY;
}

function mountMascotModel(root: Group, model: Object3D, role: RelativeTeamRole): void {
  resetHumanoidBindPose(model);
  enableHumanoidCastShadows(model);
  anchorBindPoseFeetOnFloor(model);
  attachHumanoidEyes(model, role, HUMANOID_EYE_BIND_POSE_VERTICAL_CM);
  root.add(model);
}

const MASCOT_FALLBACK_HALF_HEIGHT_M = 2.35 * 0.5;

function mountMascotFallback(root: Group): void {
  root.add(createHumanoidFallbackMesh(MASCOT_FALLBACK_HALF_HEIGHT_M));
}

export function seedTeamSpawnMascotModels(
  packs: Partial<Record<HumanoidRigId, ShooterPackCharacter>>
): void {
  for (const rigId of MASCOT_RIG_IDS) {
    if (bindPoseTemplates.has(rigId)) {
      continue;
    }

    const pack = packs[rigId];
    if (pack === undefined) {
      continue;
    }

    bindPoseTemplates.set(rigId, cloneShooterPackModel(pack.model));
  }
}

export function seedTeamSpawnMascotModelsFromModelTemplates(): void {
  for (const rigId of MASCOT_RIG_IDS) {
    if (bindPoseTemplates.has(rigId)) {
      continue;
    }

    const template = getShooterPackModelTemplate(rigId);
    if (template === undefined) {
      continue;
    }

    bindPoseTemplates.set(rigId, cloneShooterPackModel(template));
  }
}

export class TeamSpawnMascots {
  readonly #scene: Scene;
  readonly #viewerTeam: PlayerTeam;
  #entries: MascotEntry[] = [];

  constructor(scene: Scene, viewerTeam: PlayerTeam) {
    this.#scene = scene;
    this.#viewerTeam = viewerTeam;
    this.#viewerTeam.onChange(() => {
      this.refreshViewerColors();
    });
  }

  spawn(): void {
    this.clear();
    if (!isTeamSpawnMascotsEnabled()) {
      return;
    }

    for (const faction of FACTION_TEAMS) {
      const root = new Group();
      root.name = `team-spawn-mascot-${faction}`;
      root.position.set(0, teamSpawnMascotElevationY(), teamSpawnMascotZ(faction));
      root.rotation.y = yawTowardFunnelCenter(faction);

      const role = this.#viewerTeam.relativeRole(faction);
      const rigId = factionHumanoidRig(faction);
      const template = bindPoseTemplates.get(rigId);
      if (template === undefined) {
        mountMascotFallback(root);
      } else {
        mountMascotModel(root, cloneShooterPackModel(template), role);
      }

      this.#scene.add(root);
      this.#entries.push({ root, faction });
    }

    this.refreshViewerColors();
  }

  refreshViewerColors(): void {
    for (const entry of this.#entries) {
      applyRelativeTeamColors(entry.root, this.#viewerTeam.relativeRole(entry.faction));
    }
  }

  clear(): void {
    for (const entry of this.#entries) {
      this.#scene.remove(entry.root);
    }
    this.#entries = [];
  }
}
