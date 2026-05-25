// Path: /Users/johann/MyBrew/funnel-real/src/ui/character-select-scene.ts

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SkinnedMesh,
  Vector2,
  type Material,
  type Object3D,
  type WebGPURenderer
} from 'three/webgpu';
import { JOINT_HIT_FLASH_EMISSIVE_INTENSITY } from '../combat/damage-feedback';
import { deriveTeamHex, deriveTeamUiHex } from '../combat/team-color-derive';
import { enterArenaDisplayMode } from '../platform/browser-fullscreen';
import { exitArenaPointerLock } from '../input/pointer-lock';
import {
  attachHumanoidEyes,
  HUMANOID_EYE_BIND_POSE_VERTICAL_CM,
  syncHumanoidEyes
} from '../player/humanoid-eye-visual';
import type { HumanoidRigId } from '../player/humanoid-rig';
import { lowestSkinnedMeshYInCapsuleSpace } from '../player/player-mesh-foot-anchor';
import { applyRelativeTeamColors, isHumanoidEyeMeshName, isPooledTeamMaterial } from '../player/team-visual-colors';
import { enableHumanoidCastShadows } from '../player/humanoid-visual-mount';
import { getRendererPixelRatio } from '../platform/chrome-macos-arm-profile';
import { detachSceneObject } from '../render/dispose-three';
import { zoneGridMaterial } from '../render/materials/environment-grid-material';
import { GRID_BASE_COLOR } from '../render/materials/grid-tsl';
import {
  loadAllCharacterSelectPreviews,
  type CharacterSelectPreview
} from './character-select-loader';
import type { MatchFlowScreen } from './match-flow-screen';
import { CharacterSelectHoverTts } from './character-select-hover-tts';

const HOVER_BLEND_LERP_SPEED = 3.2;
const SELECT_JOINT_GLOW_IDLE = 0.42;
const SELECT_JOINT_GLOW_HOVER = JOINT_HIT_FLASH_EMISSIVE_INTENSITY;

const FIGURE_SPACING_X = 0.68;
const SELECT_STAGE_WIDTH = 60;
const SELECT_BACK_WALL_Z = -28;
const SELECT_BACK_WALL_H = 22;

const CAMERA_FOV = 36;
const CAMERA_EYE_Y = 1.08;
const CAMERA_Z = 4.2;
const LOOK_AT_Y = 0.9;

const _pointer = new Vector2();
const _raycaster = new Raycaster();

interface SelectFigure {
  rigId: HumanoidRigId;
  root: Group;
  preview: CharacterSelectPreview;
  pickMeshes: Object3D[];
  hoverBlend: number;
  hoverBlendTarget: number;
}

interface CharacterSelectLighting {
  ambient: AmbientLight;
  key: DirectionalLight;
  fill: DirectionalLight;
  rim: DirectionalLight;
}

export interface CharacterSelectMount {
  canvas: HTMLCanvasElement;
  renderer: WebGPURenderer;
  matchFlow: MatchFlowScreen;
}

let activeSession: CharacterSelectSession | null = null;

function anchorBindPoseFeetOnFloor(model: Object3D): void {
  const capsuleAnchor = new Group();
  model.position.set(0, 0, 0);
  capsuleAnchor.add(model);

  const meshBottomY = lowestSkinnedMeshYInCapsuleSpace(model, capsuleAnchor);
  capsuleAnchor.remove(model);
  model.position.y = -meshBottomY;
}

function createCharacterSelectLighting(scene: Scene): CharacterSelectLighting {
  const ambient = new AmbientLight(0x7f98ad, 0.12);
  scene.add(ambient);

  const key = new DirectionalLight(0xe7f7ff, 0.55);
  key.position.set(2, 5, 4);
  key.target.position.set(0, LOOK_AT_Y, 0);
  key.castShadow = false;
  scene.add(key);
  scene.add(key.target);

  const fill = new DirectionalLight(deriveTeamUiHex('ally', 'muted'), 0.22);
  fill.position.set(-3, 2, 2);
  fill.target.position.set(0, LOOK_AT_Y, 0);
  fill.castShadow = false;
  scene.add(fill);
  scene.add(fill.target);

  const rim = new DirectionalLight(deriveTeamHex('ally'), 0.18);
  rim.position.set(0, 3, -4);
  rim.target.position.set(0, LOOK_AT_Y, 0);
  rim.castShadow = false;
  scene.add(rim);
  scene.add(rim.target);

  return { ambient, key, fill, rim };
}

function disposeCharacterSelectLighting(scene: Scene, lighting: CharacterSelectLighting): void {
  for (const light of [lighting.ambient, lighting.key, lighting.fill, lighting.rim]) {
    scene.remove(light);
  }
  scene.remove(lighting.key.target);
  scene.remove(lighting.fill.target);
  scene.remove(lighting.rim.target);
}

function collectPickMeshes(model: Object3D): Object3D[] {
  const meshes: Object3D[] = [];
  model.traverse((object) => {
    if (object instanceof SkinnedMesh || object instanceof Mesh) {
      meshes.push(object);
    }
  });
  return meshes;
}

function isHumanoidGlowMesh(mesh: { name: string; material: Material | Material[] }): boolean {
  if (isHumanoidEyeMeshName(mesh.name)) {
    return true;
  }

  const meshName = mesh.name.toLowerCase();
  if (meshName.includes('joint')) {
    return true;
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (material.name.toLowerCase().includes('joint')) {
      return true;
    }
  }

  return false;
}


function cloneHumanoidGlowMaterials(model: Object3D): void {
  model.traverse((object) => {
    if (!(object instanceof Mesh) || !isHumanoidGlowMesh(object)) {
      return;
    }

    const material = object.material as MeshStandardMaterial;
    if (!isPooledTeamMaterial(material)) {
      return;
    }

    const cloned = material.clone();
    cloned.name = `${material.name}-select-glow`;
    object.material = cloned;
  });
}

function applyHumanoidGlowBlend(model: Object3D, blend: number): void {
  const t = Math.max(0, Math.min(1, blend));
  const emissiveIntensity =
    SELECT_JOINT_GLOW_IDLE + (SELECT_JOINT_GLOW_HOVER - SELECT_JOINT_GLOW_IDLE) * t;

  model.traverse((object) => {
    if (!(object instanceof Mesh) || !isHumanoidGlowMesh(object)) {
      return;
    }

    const material = object.material as MeshStandardMaterial;
    if (isPooledTeamMaterial(material)) {
      return;
    }

    material.emissiveIntensity = emissiveIntensity;
  });
}

function setFigureHoverTarget(figure: SelectFigure, hovering: boolean): void {
  figure.hoverBlendTarget = hovering ? 1 : 0;
}

function tickFigureHover(figure: SelectFigure, deltaSeconds: number): void {
  const { idleAction, hoverAction } = figure.preview;
  const delta = figure.hoverBlendTarget - figure.hoverBlend;
  if (Math.abs(delta) > 0.0001) {
    figure.hoverBlend += delta * Math.min(1, HOVER_BLEND_LERP_SPEED * deltaSeconds);
  } else {
    figure.hoverBlend = figure.hoverBlendTarget;
  }

  const blend = figure.hoverBlend;
  idleAction.setEffectiveWeight(1 - blend);
  hoverAction.setEffectiveWeight(blend);

  if (blend > 0.001 && blend < 0.999) {
    hoverAction.time = idleAction.time;
  }

  applyHumanoidGlowBlend(figure.preview.model, blend);
}

function mountFigure(preview: CharacterSelectPreview, slotX: number): SelectFigure {
  const root = new Group();
  root.name = `${preview.rigId}-select-root`;
  root.position.set(slotX, 0, 0);
  

  const model = preview.model;
  enableHumanoidCastShadows(model);
  anchorBindPoseFeetOnFloor(model);
  attachHumanoidEyes(model, 'ally', HUMANOID_EYE_BIND_POSE_VERTICAL_CM);
  applyRelativeTeamColors(model, 'ally');
  cloneHumanoidGlowMaterials(model);
  root.add(model);
  syncHumanoidEyes(model);
  applyHumanoidGlowBlend(model, 0);

  return {
    rigId: preview.rigId,
    root,
    preview,
    pickMeshes: collectPickMeshes(model),
    hoverBlend: 0,
    hoverBlendTarget: 0
  };
}

function disposeSelectStageMesh(scene: Scene, mesh: Mesh | null): void {
  if (mesh === null) {
    return;
  }

  detachSceneObject(mesh, { scene, geometry: true, materials: false });
}

function createCharacterSelectStage(scene: Scene): { floor: Mesh; backWall: Mesh } {
  const floor = new Mesh(
    new PlaneGeometry(SELECT_STAGE_WIDTH, SELECT_STAGE_WIDTH),
    zoneGridMaterial('beta')
  );
  floor.name = 'character-select-floor';
  floor.rotation.x = -Math.PI * 0.5;
  floor.receiveShadow = false;
  scene.add(floor);

  const backWall = new Mesh(
    new PlaneGeometry(SELECT_STAGE_WIDTH, SELECT_BACK_WALL_H),
    zoneGridMaterial('alpha')
  );
  backWall.name = 'character-select-back-wall';
  backWall.position.set(0, SELECT_BACK_WALL_H * 0.5, SELECT_BACK_WALL_Z);
  backWall.receiveShadow = false;
  scene.add(backWall);

  return { floor, backWall };
}

function resizeSelectCamera(
  renderer: WebGPURenderer,
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera
): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  renderer.setPixelRatio(getRendererPixelRatio());
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

class CharacterSelectSession {
  readonly #mount: CharacterSelectMount;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.05, 40);
  readonly #figures: SelectFigure[] = [];
  readonly #lighting: CharacterSelectLighting;
  #floor: Mesh | null = null;
  #backWall: Mesh | null = null;
  #hoveredRig: HumanoidRigId | null = null;
  #animationFrameId = 0;
  #lastFrameMs = 0;
  #resolveSelection: ((rigId: HumanoidRigId) => void) | null = null;
  #disposed = false;
  #boundPointerMove: (event: PointerEvent) => void;
  #boundPointerDown: (event: PointerEvent) => void;
  #boundResize: () => void;
  readonly #hoverTts = new CharacterSelectHoverTts();

  constructor(mount: CharacterSelectMount, previews: CharacterSelectPreview[]) {
    this.#mount = mount;
    this.#scene.background = new Color(GRID_BASE_COLOR);

    this.#camera.position.set(0, CAMERA_EYE_Y, CAMERA_Z);
    this.#camera.lookAt(0, LOOK_AT_Y, 0);

    this.#lighting = createCharacterSelectLighting(this.#scene);

    const stage = createCharacterSelectStage(this.#scene);
    this.#floor = stage.floor;
    this.#backWall = stage.backWall;

    previews.forEach((preview, index) => {
      const slotX = index === 0 ? -FIGURE_SPACING_X : FIGURE_SPACING_X;
      const figure = mountFigure(preview, slotX);
      this.#figures.push(figure);
      this.#scene.add(figure.root);
    });

    this.#boundPointerMove = (event) => {
      this.#onPointerMove(event);
    };
    this.#boundPointerDown = (event) => {
      this.#onPointerDown(event);
    };
    this.#boundResize = () => {
      resizeSelectCamera(this.#mount.renderer, this.#mount.canvas, this.#camera);
    };
  }

  run(): Promise<HumanoidRigId> {
    return new Promise((resolve) => {
      this.#resolveSelection = resolve;
      exitArenaPointerLock();
      this.#mount.matchFlow.showCharacterSelectOverlay();
      resizeSelectCamera(this.#mount.renderer, this.#mount.canvas, this.#camera);

      this.#mount.canvas.addEventListener('pointermove', this.#boundPointerMove);
      this.#mount.canvas.addEventListener('pointerdown', this.#boundPointerDown);
      window.addEventListener('resize', this.#boundResize);

      this.#lastFrameMs = performance.now();
      const tick = (now: number) => {
        this.#animationFrameId = requestAnimationFrame(tick);
        const deltaSeconds = Math.min(0.05, (now - this.#lastFrameMs) * 0.001);
        this.#lastFrameMs = now;

        for (const figure of this.#figures) {
          tickFigureHover(figure, deltaSeconds);
          figure.preview.mixer.update(deltaSeconds);
          syncHumanoidEyes(figure.preview.model);
        }

        this.#mount.renderer.render(this.#scene, this.#camera);
      };
      this.#animationFrameId = requestAnimationFrame(tick);
    });
  }

  #pickFigure(clientX: number, clientY: number): SelectFigure | null {
    const rect = this.#mount.canvas.getBoundingClientRect();
    _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointer, this.#camera);

    for (const figure of this.#figures) {
      const hits = _raycaster.intersectObjects(figure.pickMeshes, false);
      if (hits.length > 0) {
        return figure;
      }
    }

    return null;
  }

  #onPointerMove(event: PointerEvent): void {
    const picked = this.#pickFigure(event.clientX, event.clientY);
    const nextRig = picked?.rigId ?? null;

    if (nextRig !== this.#hoveredRig) {
      for (const figure of this.#figures) {
        setFigureHoverTarget(figure, figure.rigId === nextRig);
      }
      this.#hoveredRig = nextRig;
      this.#hoverTts.setHover(nextRig);
      this.#mount.matchFlow.setCharacterSelectHoverLabel(nextRig);
      this.#mount.canvas.style.cursor = nextRig === null ? 'default' : 'pointer';
    }
  }

  #onPointerDown(event: PointerEvent): void {
    const picked = this.#pickFigure(event.clientX, event.clientY);
    if (picked === null) {
      return;
    }

    cancelAnimationFrame(this.#animationFrameId);
    this.#animationFrameId = 0;
    this.#hoverTts.stop();
    enterArenaDisplayMode(this.#mount.canvas);
    this.#mount.matchFlow.beginGameLoading();
    this.#resolveSelection?.(picked.rigId);
    this.#resolveSelection = null;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    cancelAnimationFrame(this.#animationFrameId);
    this.#mount.canvas.removeEventListener('pointermove', this.#boundPointerMove);
    this.#mount.canvas.removeEventListener('pointerdown', this.#boundPointerDown);
    window.removeEventListener('resize', this.#boundResize);
    this.#mount.canvas.style.cursor = '';
    this.#hoverTts.stop();
    this.#mount.matchFlow.hideCharacterSelectOverlay();

    for (const figure of this.#figures) {
      figure.preview.idleAction.stop();
      figure.preview.hoverAction.stop();
      detachSceneObject(figure.root, {
        scene: this.#scene,
        disposeSubtree: true,
        shouldDisposeMaterial: (material) => !isPooledTeamMaterial(material)
      });
    }
    this.#figures.length = 0;

    disposeSelectStageMesh(this.#scene, this.#floor);
    this.#floor = null;
    disposeSelectStageMesh(this.#scene, this.#backWall);
    this.#backWall = null;

    disposeCharacterSelectLighting(this.#scene, this.#lighting);
    this.#scene.clear();
  }
}

export async function runCharacterSelect(
  mount: CharacterSelectMount,
  previews?: CharacterSelectPreview[]
): Promise<HumanoidRigId> {
  if (activeSession !== null) {
    throw new Error('Character select session is already active.');
  }

  const resolvedPreviews = previews ?? (await loadAllCharacterSelectPreviews());
  const session = new CharacterSelectSession(mount, resolvedPreviews);
  activeSession = session;

  try {
    return await session.run();
  } finally {
    session.dispose();
    activeSession = null;
  }
}

export function disposeCharacterSelect(): void {
  activeSession?.dispose();
  activeSession = null;
}
