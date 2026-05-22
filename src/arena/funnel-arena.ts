import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  BoxGeometry,
  CylinderGeometry,
  GridHelper,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene
} from 'three/webgpu';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import type { SyncedBody } from '../physics/synced-body';

export interface FunnelArena {
  dynamicBodies: SyncedBody[];
}

const WALL_MATERIAL = new MeshStandardMaterial({
  color: 0x2b3437,
  roughness: 0.82,
  metalness: 0.18
});

const FLOOR_MATERIAL = new MeshStandardMaterial({
  color: 0x171d1c,
  roughness: 0.92,
  metalness: 0.08
});

const BLUE_METAL = new MeshStandardMaterial({
  color: 0x243b4d,
  roughness: 0.62,
  metalness: 0.35
});

const HAZARD_MATERIAL = new MeshStandardMaterial({
  color: 0x6e5b30,
  roughness: 0.58,
  metalness: 0.42,
  emissive: 0x2a1900,
  emissiveIntensity: 0.2
});

export function createFunnelArena(scene: Scene, world: World): FunnelArena {
  const dynamicBodies: SyncedBody[] = [];
  createShell(scene, world);
  createCeilingLights(scene);
  createInstancedPillars(scene, world);
  createDynamicCrates(scene, world, dynamicBodies);

  const grid = new GridHelper(FUNNEL_DIMENSIONS.length, 60, 0x31515f, 0x1b2b30);
  grid.position.y = 0.018;
  scene.add(grid);

  return { dynamicBodies };
}

function createShell(scene: Scene, world: World): void {
  const { width, length, height } = FUNNEL_DIMENSIONS;
  const floor = new Mesh(new PlaneGeometry(width, length), FLOOR_MATERIAL);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  addFixedBox(scene, world, 'floor-body', [0, -0.5, 0], [width / 2, 0.5, length / 2], FLOOR_MATERIAL);
  addFixedBox(scene, world, 'ceiling', [0, height + 0.5, 0], [width / 2, 0.5, length / 2], WALL_MATERIAL);
  addFixedBox(scene, world, 'left-wall', [-width / 2 - 0.5, height / 2, 0], [0.5, height / 2, length / 2], WALL_MATERIAL);
  addFixedBox(scene, world, 'right-wall', [width / 2 + 0.5, height / 2, 0], [0.5, height / 2, length / 2], WALL_MATERIAL);
  addFixedBox(scene, world, 'north-bulkhead', [0, height / 2, -length / 2 - 0.5], [width / 2, height / 2, 0.5], WALL_MATERIAL);
  addFixedBox(scene, world, 'south-bulkhead', [0, height / 2, length / 2 + 0.5], [width / 2, height / 2, 0.5], WALL_MATERIAL);
}

function addFixedBox(
  scene: Scene,
  world: World,
  name: string,
  position: [number, number, number],
  halfExtents: [number, number, number],
  material: MeshStandardMaterial
): RigidBody {
  const mesh = new Mesh(
    new BoxGeometry(halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2),
    material
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...position));
  world.createCollider(RAPIER.ColliderDesc.cuboid(...halfExtents).setFriction(1.1), body);
  return body;
}

function createCeilingLights(scene: Scene): void {
  const tubeGeometry = new BoxGeometry(1.4, 0.08, 12);
  const tubeMaterial = new MeshStandardMaterial({
    color: 0xbceeff,
    emissive: 0x75d7ff,
    emissiveIntensity: 3.2,
    roughness: 0.26
  });

  for (let z = -130; z <= 130; z += 20) {
    for (const x of [-14, 0, 14]) {
      const light = new Mesh(tubeGeometry, tubeMaterial);
      light.position.set(x, FUNNEL_DIMENSIONS.height - 0.35, z);
      scene.add(light);
    }
  }
}

function createInstancedPillars(scene: Scene, world: World): void {
  const geometry = new CylinderGeometry(1.15, 1.35, 14, 12);
  const count = 36;
  const pillars = new InstancedMesh(geometry, BLUE_METAL, count);
  pillars.castShadow = true;
  pillars.receiveShadow = true;

  const matrix = new Matrix4();
  let index = 0;
  for (let z = -110; z <= 110; z += 20) {
    for (const x of [-16, 16, 0]) {
      const offsetX = x === 0 ? Math.sin(z * 0.07) * 4 : x;
      matrix.makeTranslation(offsetX, 7, z);
      pillars.setMatrixAt(index, matrix);

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(offsetX, 7, z));
      world.createCollider(RAPIER.ColliderDesc.cylinder(7, 1.25).setFriction(0.95), body);
      index += 1;
    }
  }

  scene.add(pillars);
}

function createDynamicCrates(scene: Scene, world: World, dynamicBodies: SyncedBody[]): void {
  const geometry = new BoxGeometry(2.1, 2.1, 2.1);

  for (let i = 0; i < 22; i += 1) {
    const mesh = new Mesh(geometry, HAZARD_MATERIAL.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const x = ((i % 5) - 2) * 4.2 + Math.sin(i) * 1.3;
    const z = -58 + Math.floor(i / 5) * 9;
    mesh.position.set(x, 1.1, z);
    scene.add(mesh);

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, 1.1, z)
        .setLinearDamping(0.2)
        .setAngularDamping(0.35)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.05, 1.05, 1.05)
        .setDensity(0.8)
        .setFriction(0.72)
        .setRestitution(0.08),
      body
    );
    dynamicBodies.push({ object: mesh, body });
  }
}
