import { Group, type Object3D, type Scene } from 'three/webgpu';
import { ENVIRONMENT_CONFIG } from '../config/game-config';
import {
  enableHumanoidCastShadows,
  createHumanoidFallbackMesh
} from '../player/humanoid-visual-mount';
import {
  factionHumanoidRig,
  type ShooterPackRoster
} from '../player/humanoid-rig';
import { lowestSkinnedMeshYInCapsuleSpace } from '../player/player-mesh-foot-anchor';
import { cloneShooterPackModel } from '../player/shooter-pack-clone';
import type { ShooterPackCharacter } from '../player/shooter-pack-loader';
import type { PlayerTeam } from '../player/player-team';
import {
  attachHumanoidEyes,
  HUMANOID_EYE_BIND_POSE_VERTICAL_CM
} from '../player/humanoid-eye-visual';
import { applyRelativeTeamColors } from '../player/team-visual-colors';
import type { RelativeTeamRole } from '../combat/team-color-derive';
import { FACTION_TEAMS, TEAM_DEFINITIONS, type FactionTeam } from '../combat/teams';
import { teamBulkheadZ } from './spawn-shield-cubes';

/** Meters from bulkhead inner floor toward arena center. */
export const TEAM_SPAWN_MASCOT_OFFSET_FROM_BULKHEAD_M = 1;

export function isTeamSpawnMascotsEnabled(): boolean {
  return ENVIRONMENT_CONFIG.teamSpawnMascotsEnabled;
}

export function teamSpawnMascotZ(faction: FactionTeam): number {
  const bulkheadZ = teamBulkheadZ(faction);
  const towardCenter = -Math.sign(bulkheadZ);
  return bulkheadZ + towardCenter * TEAM_SPAWN_MASCOT_OFFSET_FROM_BULKHEAD_M;
}

function yawTowardFunnelCenter(faction: FactionTeam): number {
  const towardCenter = -Math.sign(TEAM_DEFINITIONS[faction].spawnZ);
  return towardCenter * Math.PI;
}

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

function mountMascotCharacter(
  root: Group,
  pack: ShooterPackCharacter,
  role: RelativeTeamRole
): void {
  const model = cloneShooterPackModel(pack.model);
  enableHumanoidCastShadows(model);
  anchorBindPoseFeetOnFloor(model);
  attachHumanoidEyes(model, role, HUMANOID_EYE_BIND_POSE_VERTICAL_CM);
  root.add(model);
}

/** Fallback box height matches `createHumanoidFallbackMesh` geometry. */
const MASCOT_FALLBACK_HALF_HEIGHT_M = 2.35 * 0.5;

function mountMascotFallback(root: Group): void {
  root.add(createHumanoidFallbackMesh(MASCOT_FALLBACK_HALF_HEIGHT_M));
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

  spawn(roster: ShooterPackRoster = {}): void {
    this.clear();
    if (!isTeamSpawnMascotsEnabled()) {
      return;
    }

    for (const faction of FACTION_TEAMS) {
      const root = new Group();
      root.name = `team-spawn-mascot-${faction}`;
      root.position.set(0, 0, teamSpawnMascotZ(faction));
      root.rotation.y = yawTowardFunnelCenter(faction);

      const role = this.#viewerTeam.relativeRole(faction);
      const pack = roster[factionHumanoidRig(faction)];
      if (pack === undefined) {
        mountMascotFallback(root);
      } else {
        mountMascotCharacter(root, pack, role);
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
