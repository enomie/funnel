import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { World } from '@dimforge/rapier3d-simd-compat';
import { BoxGeometry, Mesh, PlaneGeometry, Scene } from 'three/webgpu';
import { ArenaStaticInstances } from './arena-static-instances';
import { createCeilingFixtures } from './ceiling-fixtures';
import { FUNNEL_DIMENSIONS, FUNNEL_ZONE_COUNT, funnelZoneExtentZ } from '../config/game-config';
import { DynamicEnvironmentInstances, type DynamicSyncedBody } from './environment-dynamic-instances';
import { zoneGridMaterial } from '../render/materials/environment-grid-material';
import { createNeutralCornerCubes } from './neutral-corner-cubes';
import { createNeutralCrosswalk } from './neutral-crosswalk';
import { createNeutralSideWallRamps } from './neutral-side-wall-ramps';
import { createNeutralPodium } from './neutral-podium';
import { createNeutralPodiumRamps } from './neutral-podium-ramps';
import { createTeamZonePodiums } from './team-zone-podiums';
import { createTeamZonePillars } from './team-zone-pillars';
import { createTeamZonePodiumRamps } from './team-zone-podium-ramps';
import { createSideWallCeilingRamps } from './side-wall-ceiling-ramps';
import { createSpawnShieldCanopies } from './spawn-shield-canopy';
import { createSpawnShieldCubes } from './spawn-shield-cubes';
import type { FunnelZoneId } from './funnel-zones';
import { createZoneBorderRamps } from './zone-border-ramps';
import { ENVIRONMENT_COLLISION_GROUPS } from '../physics/collision-groups';

export interface FunnelArena {
  dynamicBodies: DynamicSyncedBody[];
  dynamicInstances: DynamicEnvironmentInstances;
  staticInstances: ArenaStaticInstances;
}

const ZONE_ORDER: readonly FunnelZoneId[] = ['alpha', 'neutral', 'beta'];
const SHELL_WALL_THICKNESS_M = 0.5;

export function createFunnelArena(scene: Scene, world: World): FunnelArena {
  const staticInstances = new ArenaStaticInstances(scene);
  createShell(scene, world);
  createCeilingFixtures(staticInstances);
  createSpawnShieldCubes(staticInstances, world);
  createSpawnShieldCanopies(staticInstances, world);
  createNeutralCornerCubes(staticInstances, world);
  createNeutralSideWallRamps(staticInstances, world);
  createSideWallCeilingRamps(staticInstances, world);
  createNeutralCrosswalk(staticInstances, world);
  createNeutralPodium(staticInstances, world);
  createNeutralPodiumRamps(staticInstances, world);
  createTeamZonePodiums(staticInstances, world);
  createTeamZonePillars(staticInstances, world);
  createTeamZonePodiumRamps(staticInstances, world);
  createZoneBorderRamps(staticInstances, world);

  const dynamicInstances = new DynamicEnvironmentInstances(scene);

  return { dynamicBodies: [], dynamicInstances, staticInstances };
}

function createShell(scene: Scene, world: World): void {
  const { width, length, height } = FUNNEL_DIMENSIONS;
  const halfW = width * 0.5;
  const halfL = length * 0.5;
  const t = SHELL_WALL_THICKNESS_M;

  for (let zoneIndex = 0; zoneIndex < FUNNEL_ZONE_COUNT; zoneIndex += 1) {
    const zoneId = ZONE_ORDER[zoneIndex] ?? 'neutral';
    const { minZ, maxZ } = funnelZoneExtentZ(zoneIndex);
    const zoneLen = maxZ - minZ;
    const centerZ = (minZ + maxZ) * 0.5;

    const floor = new Mesh(new PlaneGeometry(width, zoneLen), zoneGridMaterial(zoneId));
    floor.name = `floor-${zoneId}`;
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, centerZ);
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new Mesh(new BoxGeometry(width, t, zoneLen), zoneGridMaterial(zoneId));
    ceiling.name = `ceiling-${zoneId}`;
    ceiling.position.set(0, height + t * 0.5, centerZ);
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    const leftWall = new Mesh(new BoxGeometry(t, height, zoneLen), zoneGridMaterial(zoneId));
    leftWall.name = `left-wall-${zoneId}`;
    leftWall.position.set(-halfW - t * 0.5, height * 0.5, centerZ);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new Mesh(new BoxGeometry(t, height, zoneLen), zoneGridMaterial(zoneId));
    rightWall.name = `right-wall-${zoneId}`;
    rightWall.position.set(halfW + t * 0.5, height * 0.5, centerZ);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    scene.add(rightWall);
  }

  const northBulkhead = new Mesh(
    new BoxGeometry(width, height, t),
    zoneGridMaterial('alpha')
  );
  northBulkhead.name = 'north-bulkhead';
  northBulkhead.position.set(0, height * 0.5, -halfL - t * 0.5);
  northBulkhead.castShadow = true;
  northBulkhead.receiveShadow = true;
  scene.add(northBulkhead);

  const southBulkhead = new Mesh(
    new BoxGeometry(width, height, t),
    zoneGridMaterial('beta')
  );
  southBulkhead.name = 'south-bulkhead';
  southBulkhead.position.set(0, height * 0.5, halfL + t * 0.5);
  southBulkhead.castShadow = true;
  southBulkhead.receiveShadow = true;
  scene.add(southBulkhead);

  addFixedCollider(world, [0, -t * 0.5, 0], [halfW, t * 0.5, halfL]);
  addFixedCollider(world, [0, height + t * 0.5, 0], [halfW, t * 0.5, halfL]);
  addFixedCollider(world, [-halfW - t * 0.5, height * 0.5, 0], [t * 0.5, height * 0.5, halfL]);
  addFixedCollider(world, [halfW + t * 0.5, height * 0.5, 0], [t * 0.5, height * 0.5, halfL]);
  addFixedCollider(world, [0, height * 0.5, -halfL - t * 0.5], [halfW, height * 0.5, t * 0.5]);
  addFixedCollider(world, [0, height * 0.5, halfL + t * 0.5], [halfW, height * 0.5, t * 0.5]);
}

function addFixedCollider(
  world: World,
  position: [number, number, number],
  halfExtents: [number, number, number]
): void {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...position));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(...halfExtents)
      .setFriction(1.1)
      .setCollisionGroups(ENVIRONMENT_COLLISION_GROUPS),
    body
  );
}
