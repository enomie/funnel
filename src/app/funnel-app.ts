import { Vector3, type WebGPURenderer } from 'three/webgpu';
import { BuildingSystem } from '../arena/building-system';
import { createFunnelArena } from '../arena/funnel-arena';
import { WeaponArsenal } from '../combat/weapon-arsenal';
import { PHYSICS_CONFIG } from '../config/game-config';
import { InputState } from '../input/input-state';
import { syncRigidBodyObjects } from '../physics/synced-body';
import { createRapierRuntime } from '../physics/rapier-world';
import { PlayerCamera } from '../player/player-camera';
import { PlayerController } from '../player/player-controller';
import { PlayerVisual } from '../player/player-visual';
import { createRenderer } from '../render/create-renderer';
import { createRenderScene } from '../render/create-scene';
import { StatusToast } from '../ui/status-toast';
import { createAppDom } from './dom';

export async function startFunnelApp(root: HTMLDivElement): Promise<void> {
  const dom = createAppDom(root);
  const toast = new StatusToast(dom.status);
  const renderer = await createRenderer(dom.canvas);
  const { scene, camera, dynamicLightRig } = createRenderScene();
  const { world, eventQueue } = await createRapierRuntime();
  const arena = createFunnelArena(scene, world);
  const input = new InputState(dom.canvas);
  const visual = new PlayerVisual(scene);

  try {
    await visual.load();
  } catch (error) {
    visual.useFallbackMesh();
    toast.show(
      `Shooter-Pack character could not be loaded, fallback player is active: ${String(error)}`,
      5200
    );
  }

  const player = new PlayerController(world, visual);
  const playerCamera = new PlayerCamera(camera, world, player.collider);
  const buildingSystem = new BuildingSystem(scene, world);
  const weapon = new WeaponArsenal(scene, world, player.collider, buildingSystem);
  visual.setWeapon(weapon.selectedWeapon);
  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer(renderer, dom.canvas, camera);
  });

  input.connect();
  resizeObserver.observe(dom.shell);
  resizeRenderer(renderer, dom.canvas, camera);
  dom.weaponReadout.textContent = weapon.selectedWeaponLabel;
  toast.show('Modernized mTPS demo is running as FUNNEL playable slice.');

  let accumulator = 0;
  let lastFrameAt = performance.now();
  await renderer.setAnimationLoop(() => {
    const now = performance.now();
    const deltaSeconds = Math.min((now - lastFrameAt) / 1000, 0.05);
    lastFrameAt = now;
    const snapshot = input.snapshot();
    const frame = player.update(deltaSeconds, snapshot);
    const cameraVectors = playerCamera.update(frame);

    accumulator += deltaSeconds;
    let subSteps = 0;
    while (accumulator >= PHYSICS_CONFIG.fixedStep && subSteps < PHYSICS_CONFIG.maxSubSteps) {
      world.step(eventQueue);
      accumulator -= PHYSICS_CONFIG.fixedStep;
      subSteps += 1;
    }

    if (subSteps === PHYSICS_CONFIG.maxSubSteps) {
      accumulator = 0;
    }

    eventQueue.drainContactForceEvents((event) => {
      player.handleContactForceEvent(event);
    });

    syncRigidBodyObjects(arena.dynamicBodies);
    updateLightRig(dynamicLightRig, frame.position, cameraVectors.direction);
    buildingSystem.update(
      frame.position,
      frame.yaw,
      frame.pitch,
      frame.buildMode,
      frame.mode === 'build'
    );

    if (weapon.selectSlot(snapshot.weaponSlot)) {
      visual.setWeapon(weapon.selectedWeapon);
      dom.weaponReadout.textContent = weapon.selectedWeaponLabel;
      toast.show(`Selected ${weapon.selectedWeaponLabel}.`, 900);
    }

    if (frame.mode === 'build' && snapshot.consumePlacePressed()) {
      if (buildingSystem.placeActive()) {
        toast.show(`Placed ${frame.buildMode}.`);
      }
    }

    weapon.update(now, deltaSeconds);

    if (frame.mode === 'weapon' && snapshot.fireHeld) {
      const muzzlePosition = visual.muzzleSocket.getWorldPosition(new Vector3());
      weapon.tryPrimaryFire(now, cameraVectors, muzzlePosition);
    }

    renderer.render(scene, camera);
  });
}

function resizeRenderer(
  renderer: WebGPURenderer,
  canvas: HTMLCanvasElement,
  camera: { aspect: number; updateProjectionMatrix: () => void }
): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateLightRig(
  dynamicLightRig: { position: Vector3; lookAt: (target: Vector3) => void },
  position: Vector3,
  direction: Vector3
): void {
  dynamicLightRig.position.copy(position).add(new Vector3(0, 2.2, 0));
  dynamicLightRig.lookAt(position.clone().addScaledVector(direction, 18));
}
