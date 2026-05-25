// Path: /Users/johann/MyBrew/funnel-real/src/arena/arena-static-instances.ts

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import { deriveTeamHex } from '../combat/teams';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import { zoneGridMaterial } from '../render/materials/environment-grid-material';
import { createRampGeometry } from './environment-dynamic-shapes';
import type { FunnelZoneId } from './funnel-zones';

const BOX_LAYER_CAPACITY: Record<FunnelZoneId, number> = {
  alpha: 32,
  neutral: 16,
  beta: 32
};

const RAMP_LAYER_CAPACITY: Record<FunnelZoneId, number> = {
  alpha: 8,
  neutral: 8,
  beta: 8
};

const FIXTURE_SHELL_CAPACITY = 40;
const FIXTURE_PANEL_CAPACITY = 40;

const FIXTURE_WIDTH_M = 2;
const FIXTURE_LENGTH_M = 10;
const FIXTURE_DROP_M = 5;
const FIXTURE_PANEL_THICKNESS_M = 0.08;

const FIXTURE_CENTER_Y = FUNNEL_DIMENSIONS.height - FIXTURE_DROP_M * 0.5;
const FIXTURE_BOTTOM_Y = FIXTURE_CENTER_Y - FIXTURE_DROP_M * 0.5;

const FIXTURE_PANEL_CENTER_Y = FIXTURE_BOTTOM_Y - FIXTURE_PANEL_THICKNESS_M * 0.5;

const NEUTRAL_PANEL_EMISSIVE = 0x8a9098;
const NEUTRAL_PANEL_EMISSIVE_INTENSITY = 2.4;
const TEAM_PANEL_EMISSIVE_INTENSITY = 2.85;

const _position = new Vector3();
const _propRotationEuler = new Euler();
const _scale = new Vector3(1, 1, 1);
const _quaternion = new Quaternion();
const _matrix = new Matrix4();

let unitBoxGeometry: BoxGeometry | null = null;
let unitRampGeometry: BufferGeometry | null = null;
let trofferShellGeometry: BufferGeometry | null = null;

const panelEmissiveByZone = new Map<FunnelZoneId, MeshStandardMaterial>();

interface InstancedLayer {
  readonly mesh: InstancedMesh;
  count: number;
}

function getUnitBoxGeometry(): BoxGeometry {
  if (unitBoxGeometry === null) {
    unitBoxGeometry = new BoxGeometry(1, 1, 1);
  }
  return unitBoxGeometry;
}

function getUnitRampGeometry(): BufferGeometry {
  if (unitRampGeometry === null) {
    unitRampGeometry = createRampGeometry(1, 1, 1);
  }
  return unitRampGeometry;
}


function getTrofferShellUnitGeometry(): BufferGeometry {
  if (trofferShellGeometry !== null) {
    return trofferShellGeometry;
  }

  const geometry = new BoxGeometry(1, 1, 1);
  const index = geometry.getIndex();
  if (index === null) {
    trofferShellGeometry = geometry;
    return geometry;
  }

  const src = index.array;
  const kept = new Uint16Array(30);
  kept.set(src.subarray(0, 18), 0);
  kept.set(src.subarray(24, 36), 18);
  geometry.setIndex(new BufferAttribute(kept, 1));
  geometry.clearGroups();
  geometry.addGroup(0, 30, 0);
  trofferShellGeometry = geometry;
  return geometry;
}

function panelEmissiveMaterial(zoneId: FunnelZoneId): MeshStandardMaterial {
  const cached = panelEmissiveByZone.get(zoneId);
  if (cached !== undefined) {
    return cached;
  }

  const emissive =
    zoneId === 'neutral'
      ? NEUTRAL_PANEL_EMISSIVE
      : deriveTeamHex(zoneId === 'alpha' ? 'enemy' : 'ally', 'emissiveGlow');

  const material = new MeshStandardMaterial({
    color: emissive,
    emissive,
    emissiveIntensity:
      zoneId === 'neutral' ? NEUTRAL_PANEL_EMISSIVE_INTENSITY : TEAM_PANEL_EMISSIVE_INTENSITY,
    roughness: 0.22,
    metalness: 0.08,
    depthWrite: false
  });
  panelEmissiveByZone.set(zoneId, material);
  return material;
}

function setBoxMatrix(
  centerX: number,
  centerY: number,
  centerZ: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number
): Matrix4 {
  return setPropMatrix(centerX, centerY, centerZ, sizeX, sizeY, sizeZ, 0, 0);
}

function setPropMatrix(
  centerX: number,
  centerY: number,
  centerZ: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  rotationX: number,
  rotationY: number
): Matrix4 {
  return _matrix.compose(
    _position.set(centerX, centerY, centerZ),
    _quaternion.setFromEuler(_propRotationEuler.set(rotationX, rotationY, 0)),
    _scale.set(sizeX, sizeY, sizeZ)
  );
}


export class ArenaStaticInstances {
  readonly #scene: Scene;
  readonly #boxLayers = new Map<FunnelZoneId, InstancedLayer>();
  readonly #rampLayers = new Map<FunnelZoneId, InstancedLayer>();
  readonly #fixtureShellLayers = new Map<FunnelZoneId, InstancedLayer>();
  readonly #fixturePanelLayers = new Map<FunnelZoneId, InstancedLayer>();

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  addEnvironmentBox(
    zoneId: FunnelZoneId,
    center: readonly [number, number, number],
    size: readonly [number, number, number]
  ): void {
    const layer = this.#ensureBoxLayer(zoneId);
    layer.mesh.setMatrixAt(
      layer.count,
      setBoxMatrix(center[0], center[1], center[2], size[0], size[1], size[2])
    );
    layer.count += 1;
    layer.mesh.count = layer.count;
    layer.mesh.instanceMatrix.needsUpdate = true;
  }

  addEnvironmentRamp(
    zoneId: FunnelZoneId,
    center: readonly [number, number, number],
    size: readonly [number, number, number],
    rotationY = 0,
    rotationX = 0
  ): void {
    const layer = this.#ensureRampLayer(zoneId);
    layer.mesh.setMatrixAt(
      layer.count,
      setPropMatrix(
        center[0],
        center[1],
        center[2],
        size[0],
        size[1],
        size[2],
        rotationX,
        rotationY
      )
    );
    layer.count += 1;
    layer.mesh.count = layer.count;
    layer.mesh.instanceMatrix.needsUpdate = true;
  }

  addCeilingFixture(x: number, z: number, zoneId: FunnelZoneId): void {
    const shell = this.#ensureFixtureShellLayer(zoneId);
    shell.mesh.setMatrixAt(
      shell.count,
      setBoxMatrix(x, FIXTURE_CENTER_Y, z, FIXTURE_WIDTH_M, FIXTURE_DROP_M, FIXTURE_LENGTH_M)
    );
    shell.count += 1;
    shell.mesh.count = shell.count;
    shell.mesh.instanceMatrix.needsUpdate = true;

    const panel = this.#ensureFixturePanelLayer(zoneId);
    panel.mesh.setMatrixAt(
      panel.count,
      setBoxMatrix(
        x,
        FIXTURE_PANEL_CENTER_Y,
        z,
        FIXTURE_WIDTH_M,
        FIXTURE_PANEL_THICKNESS_M,
        FIXTURE_LENGTH_M
      )
    );
    panel.count += 1;
    panel.mesh.count = panel.count;
    panel.mesh.instanceMatrix.needsUpdate = true;
  }

  #ensureBoxLayer(zoneId: FunnelZoneId): InstancedLayer {
    const existing = this.#boxLayers.get(zoneId);
    if (existing !== undefined) {
      return existing;
    }

    const capacity = BOX_LAYER_CAPACITY[zoneId];
    const mesh = new InstancedMesh(getUnitBoxGeometry(), zoneGridMaterial(zoneId), capacity);
    mesh.name = `arena-boxes-${zoneId}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    this.#scene.add(mesh);

    const layer: InstancedLayer = { mesh, count: 0 };
    this.#boxLayers.set(zoneId, layer);
    return layer;
  }

  #ensureRampLayer(zoneId: FunnelZoneId): InstancedLayer {
    const existing = this.#rampLayers.get(zoneId);
    if (existing !== undefined) {
      return existing;
    }

    const capacity = RAMP_LAYER_CAPACITY[zoneId];
    const mesh = new InstancedMesh(getUnitRampGeometry(), zoneGridMaterial(zoneId), capacity);
    mesh.name = `arena-ramps-${zoneId}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    this.#scene.add(mesh);

    const layer: InstancedLayer = { mesh, count: 0 };
    this.#rampLayers.set(zoneId, layer);
    return layer;
  }

  #ensureFixtureShellLayer(zoneId: FunnelZoneId): InstancedLayer {
    const existing = this.#fixtureShellLayers.get(zoneId);
    if (existing !== undefined) {
      return existing;
    }

    const mesh = new InstancedMesh(
      getTrofferShellUnitGeometry(),
      zoneGridMaterial(zoneId),
      FIXTURE_SHELL_CAPACITY
    );
    mesh.name = `ceiling-fixture-shell-${zoneId}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 0;
    mesh.count = 0;
    this.#scene.add(mesh);

    const layer: InstancedLayer = { mesh, count: 0 };
    this.#fixtureShellLayers.set(zoneId, layer);
    return layer;
  }

  #ensureFixturePanelLayer(zoneId: FunnelZoneId): InstancedLayer {
    const existing = this.#fixturePanelLayers.get(zoneId);
    if (existing !== undefined) {
      return existing;
    }

    const mesh = new InstancedMesh(
      getUnitBoxGeometry(),
      panelEmissiveMaterial(zoneId),
      FIXTURE_PANEL_CAPACITY
    );
    mesh.name = `ceiling-fixture-panel-${zoneId}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 1;
    mesh.count = 0;
    this.#scene.add(mesh);

    const layer: InstancedLayer = { mesh, count: 0 };
    this.#fixturePanelLayers.set(zoneId, layer);
    return layer;
  }
}