import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  PerspectiveCamera,
  Scene,
  SpotLight
} from 'three/webgpu';

export interface RenderScene {
  scene: Scene;
  camera: PerspectiveCamera;
  dynamicLightRig: Group;
}

export function createRenderScene(): RenderScene {
  const scene = new Scene();
  scene.background = new Color(0x050607);
  scene.fog = new Fog(0x050607, 70, 230);

  const camera = new PerspectiveCamera(76, 1, 0.05, 500);
  camera.position.set(0, 4, 136);

  const ambient = new AmbientLight(0x7f98ad, 0.42);
  scene.add(ambient);

  const sun = new DirectionalLight(0xe7f7ff, 2.1);
  sun.position.set(-24, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  const dynamicLightRig = new Group();
  const playerSpot = new SpotLight(0x92d8ff, 750, 46, Math.PI / 6, 0.55, 1.25);
  playerSpot.position.set(0, 5, 10);
  playerSpot.target.position.set(0, 1.5, -12);
  dynamicLightRig.add(playerSpot, playerSpot.target);
  scene.add(dynamicLightRig);

  return { scene, camera, dynamicLightRig };
}
