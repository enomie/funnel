// Path: /Users/johann/MyBrew/funnel-real/src/render/create-scene.ts

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene
} from 'three/webgpu';
import { getUnitLowPolySphereGeometry } from './low-poly-sphere-geometry';
import { TEAM_BASE_HEX } from '../combat/team-color-derive';
import type { FactionTeam } from '../combat/teams';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import { defaultPlayerSpawnPosition } from '../player/player-spawn';
import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';

const FACTION_FIGHT_LIGHT_HEX: Record<FactionTeam, number> = {
  alpha: TEAM_BASE_HEX.enemy,
  beta: TEAM_BASE_HEX.ally
};

const FUNNEL_LIGHT_Y = FUNNEL_DIMENSIONS.height - 1;
const FUNNEL_LIGHT_SPHERE_RADIUS = 7;


const FUNNEL_KEY_LIGHT_COLOR = 0xe7f7ff;
const FUNNEL_IDLE_LIGHT_COLOR = 0xffffff;
const FUNNEL_LIGHT_RANGE = 0;
const FUNNEL_LIGHT_DECAY = 2;
const FUNNEL_IDLE_LIGHT_INTENSITY = 3200;
const FUNNEL_FIGHT_LIGHT_INTENSITY = 4200;
const FUNNEL_ORB_IDLE_EMISSIVE_INTENSITY = 0.9;
const FUNNEL_ORB_FIGHT_EMISSIVE_INTENSITY = 3;
const FUNNEL_AMBIENT_INTENSITY = 0.05;

const FUNNEL_KEY_LIGHT_INTENSITY = 0.38;

const SHADOW_FOCUS_HALF_M = 22;
const SHADOW_MAP_SIZE = getRuntimeProfile().shadowMapSize;

export interface ArenaLighting {
  updateShadowFocus(x: number, z: number): void;
  
  updateFightFocus(focusFaction: FactionTeam | null): void;
}

export interface RenderScene {
  scene: Scene;
  camera: PerspectiveCamera;
  lighting: ArenaLighting;
}

function configureShadowLight(light: DirectionalLight, shadowsEnabled: boolean): void {
  light.castShadow = shadowsEnabled;
  if (!shadowsEnabled) {
    return;
  }

  light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  light.shadow.bias = -0.00015;
  light.shadow.normalBias = 0.018;

  const camera = light.shadow.camera;
  camera.near = 4;
  camera.far = FUNNEL_DIMENSIONS.height + 30;
  camera.left = -SHADOW_FOCUS_HALF_M;
  camera.right = SHADOW_FOCUS_HALF_M;
  camera.top = SHADOW_FOCUS_HALF_M;
  camera.bottom = -SHADOW_FOCUS_HALF_M;
  camera.updateProjectionMatrix();
}

export function createRenderScene(): RenderScene {
  const scene = new Scene();
  scene.background = new Color(0x050607);
  scene.fog = new Fog(0x050607, 70, 230);

  const camera = new PerspectiveCamera(76, 1, 0.05, 500);
  camera.position.set(0, 4, 136);

  scene.add(new AmbientLight(0x7f98ad, FUNNEL_AMBIENT_INTENSITY));

  const keyLight = new DirectionalLight(FUNNEL_KEY_LIGHT_COLOR, FUNNEL_KEY_LIGHT_INTENSITY);
  configureShadowLight(keyLight, getRuntimeProfile().shadowsEnabled);
  scene.add(keyLight);
  scene.add(keyLight.target);

  const funnelLight = new PointLight(
    FUNNEL_IDLE_LIGHT_COLOR,
    FUNNEL_IDLE_LIGHT_INTENSITY,
    FUNNEL_LIGHT_RANGE,
    FUNNEL_LIGHT_DECAY
  );
  funnelLight.position.set(0, FUNNEL_LIGHT_Y, 0);
  funnelLight.castShadow = false;
  scene.add(funnelLight);

  const lightOrbMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    roughness: 0.18,
    metalness: 0.02
  });
  const lightOrb = new Mesh(
    getUnitLowPolySphereGeometry(),
    lightOrbMaterial
  );
  lightOrb.scale.setScalar(FUNNEL_LIGHT_SPHERE_RADIUS);
  lightOrb.name = 'funnel-light-orb';
  lightOrb.position.set(0, FUNNEL_LIGHT_Y, 0);
  lightOrb.castShadow = false;
  lightOrb.receiveShadow = false;
  scene.add(lightOrb);

  const fightTint = new Color();
  const idleOrbTint = new Color(0xffffff);
  const orbOffTint = new Color(0x000000);
  let lastShadowX = Number.NaN;
  let lastShadowZ = Number.NaN;
  let lastFocusFaction: FactionTeam | null | undefined;

  const lighting: ArenaLighting = {
    updateShadowFocus(x: number, z: number): void {
      if (x === lastShadowX && z === lastShadowZ) {
        return;
      }

      lastShadowX = x;
      lastShadowZ = z;
      keyLight.target.position.set(x, 0, z);
      keyLight.position.set(x, FUNNEL_DIMENSIONS.height + 16, z);
    },
    updateFightFocus(focusFaction: FactionTeam | null): void {
      if (focusFaction === lastFocusFaction) {
        return;
      }

      lastFocusFaction = focusFaction;

      if (focusFaction === null) {
        fightTint.setHex(FUNNEL_IDLE_LIGHT_COLOR);
        funnelLight.color.copy(fightTint);
        funnelLight.intensity = FUNNEL_IDLE_LIGHT_INTENSITY;
        lightOrbMaterial.color.copy(idleOrbTint);
        lightOrbMaterial.emissive.copy(idleOrbTint);
        lightOrbMaterial.emissiveIntensity = FUNNEL_ORB_IDLE_EMISSIVE_INTENSITY;
        return;
      }

      fightTint.setHex(FACTION_FIGHT_LIGHT_HEX[focusFaction]);
      funnelLight.color.copy(fightTint);
      funnelLight.intensity = FUNNEL_FIGHT_LIGHT_INTENSITY;
      
      lightOrbMaterial.color.copy(orbOffTint);
      lightOrbMaterial.emissive.copy(fightTint);
      lightOrbMaterial.emissiveIntensity = FUNNEL_ORB_FIGHT_EMISSIVE_INTENSITY;
    }
  };

  lighting.updateShadowFocus(0, defaultPlayerSpawnPosition().z);

  return { scene, camera, lighting };
}
