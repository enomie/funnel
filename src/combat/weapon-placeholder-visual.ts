import { Group, Vector3 } from 'three/webgpu';
import { detachSceneObject } from '../render/dispose-three';
import { createWeaponMesh } from '../weapon-jsons/weapon-mesh-builder';
import type { WeaponDefinition } from './weapon-definitions';

/** Local offsets from capsule-center root; player yaw faces +Z. */
export const THIRD_PERSON_WEAPON_SOCKET_POSITION = new Vector3(-0.16, 0.42, 0.2);

/** FPS viewmodel rig (local after camera `lookAt`, forward = −Z). */
export const FIRST_PERSON_WEAPON_SOCKET_POSITION = new Vector3(0.32, -0.05, -0.38);

/** Meters beyond barrel tip along bore axis (weapon-local). */
const MUZZLE_BEYOND_BARREL_M = 0.05;

/** Third-person bore +Z: mesh tip at z = length; muzzle centered on weapon cross-section. */
export function thirdPersonMuzzleSocketPosition(weapon: WeaponDefinition): Vector3 {
  return new Vector3(0, 0, weapon.length + MUZZLE_BEYOND_BARREL_M);
}

/** FPS viewmodel bore −Z (camera forward). */
export function firstPersonMuzzleSocketPosition(weapon: WeaponDefinition): Vector3 {
  return new Vector3(0, 0, -(weapon.length + MUZZLE_BEYOND_BARREL_M));
}

export function createWeaponPlaceholderMesh(weapon: WeaponDefinition): Group {
  return createWeaponMesh(weapon);
}

export function applyWeaponPlaceholderToSocket(
  weaponSocket: Group,
  weapon: WeaponDefinition,
  muzzleSocket?: Group
): Group {
  const mesh = createWeaponPlaceholderMesh(weapon);
  weaponSocket.add(mesh);
  if (muzzleSocket !== undefined) {
    muzzleSocket.position.copy(thirdPersonMuzzleSocketPosition(weapon));
  }
  return mesh;
}

export function requireBotWeaponSocket(root: Group): Group | null {
  const socket = root.getObjectByName('bot-weapon-socket');
  return socket instanceof Group ? socket : null;
}

export function replaceWeaponPlaceholderOnCapsuleRoot(
  root: Group,
  weapon: WeaponDefinition
): Group {
  const socket = requireBotWeaponSocket(root);
  if (socket === null) {
    return mountWeaponPlaceholderOnCapsuleRoot(root, weapon);
  }

  disposeWeaponPlaceholderSocket(socket);
  const muzzleSocket = new Group();
  muzzleSocket.name = 'bot-muzzle-socket';
  applyWeaponPlaceholderToSocket(socket, weapon, muzzleSocket);
  socket.add(muzzleSocket);
  return socket;
}

export function mountWeaponPlaceholderOnCapsuleRoot(
  root: Group,
  weapon: WeaponDefinition
): Group {
  const socket = new Group();
  socket.name = 'bot-weapon-socket';
  socket.position.copy(THIRD_PERSON_WEAPON_SOCKET_POSITION);
  const muzzleSocket = new Group();
  muzzleSocket.name = 'bot-muzzle-socket';
  applyWeaponPlaceholderToSocket(socket, weapon, muzzleSocket);
  socket.add(muzzleSocket);
  root.add(socket);
  return socket;
}

export function findBotMuzzleSocket(root: Group): Group | null {
  const muzzle = root.getObjectByName('bot-muzzle-socket');
  return muzzle instanceof Group ? muzzle : null;
}

/** Drop weapon placeholder meshes before socket rebuild — avoids GPU leaks on equip. */
export function disposeWeaponPlaceholderSocket(socket: Group): void {
  for (let index = socket.children.length - 1; index >= 0; index -= 1) {
    const child = socket.children[index];
    if (child.name.endsWith('-weapon-mesh')) {
      detachSceneObject(child, { disposeSubtree: true });
      continue;
    }
    socket.remove(child);
  }
}
