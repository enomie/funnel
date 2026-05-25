// Path: /Users/johann/MyBrew/funnel-real/src/render/materials/grid-tsl.ts
// @ts-nocheck


import {
  add,
  color,
  float,
  fwidth,
  max,
  min,
  mix,
  mul,
  normalGeometry,
  normalWorld,
  positionGeometry,
  positionWorld,
  smoothstep
} from 'three/tsl';

const GRID_MINOR_STEP_M = 1;
const GRID_MAJOR_STEP_M = 5;


export const GRID_BASE_COLOR = 0x141b24;


const GRID_MINOR_LINE_WIDTH = 0.002;

const GRID_MAJOR_LINE_WIDTH = 0.005;
const GRID_MINOR_LINE_STRENGTH = 0.28;
const GRID_MAJOR_LINE_STRENGTH = 0.55;
const GRID_EMISSIVE_STRENGTH = 0.1;

function gridLineMask(coord, step, lineWidth) {
  const scaled = coord.div(float(step));
  const f = scaled.fract();

  const cellDist = min(f, float(1).sub(f)).mul(2);
  const aa = fwidth(scaled).mul(2);
  return float(1).sub(smoothstep(float(lineWidth), float(lineWidth).add(aa), cellDist));
}

function planarGridMask(coordA, coordB, step, lineWidth) {
  return max(
    gridLineMask(coordA, step, lineWidth),
    gridLineMask(coordB, step, lineWidth)
  );
}

function triplanarGridMask(step, lineWidth, positionNode, normalNode) {
  const n = normalNode.abs();
  const w = n.pow(4);
  const wSum = add(add(w.x, w.y), w.z);
  const wx = w.x.div(wSum);
  const wy = w.y.div(wSum);
  const wz = w.z.div(wSum);

  const maskX = planarGridMask(positionNode.y, positionNode.z, step, lineWidth);
  const maskY = planarGridMask(positionNode.x, positionNode.z, step, lineWidth);
  const maskZ = planarGridMask(positionNode.x, positionNode.y, step, lineWidth);

  return add(add(mul(maskX, wx), mul(maskY, wy)), mul(maskZ, wz));
}

function buildGridColorNode(
  gridHex,
  minorGridHex,
  lineStrengthScale,
  positionNode,
  normalNode
) {
  const base = color(GRID_BASE_COLOR);
  const minorTint = mul(color(minorGridHex), float(GRID_MINOR_LINE_STRENGTH * lineStrengthScale));
  const majorTint = mul(color(gridHex), float(GRID_MAJOR_LINE_STRENGTH * lineStrengthScale));

  const minorMask = triplanarGridMask(
    GRID_MINOR_STEP_M,
    GRID_MINOR_LINE_WIDTH,
    positionNode,
    normalNode
  );
  const majorMask = triplanarGridMask(
    GRID_MAJOR_STEP_M,
    GRID_MAJOR_LINE_WIDTH,
    positionNode,
    normalNode
  );

  const withMajor = mix(base, majorTint, majorMask);
  return mix(withMajor, minorTint, minorMask);
}

function buildGridEmissiveNode(
  gridHex,
  minorGridHex,
  emissiveStrength,
  positionNode,
  normalNode
) {
  const majorEmissive = mul(color(gridHex), float(emissiveStrength));
  const minorEmissive = mul(color(minorGridHex), float(emissiveStrength));
  const minorMask = triplanarGridMask(
    GRID_MINOR_STEP_M,
    GRID_MINOR_LINE_WIDTH,
    positionNode,
    normalNode
  );
  const majorMask = triplanarGridMask(
    GRID_MAJOR_STEP_M,
    GRID_MAJOR_LINE_WIDTH,
    positionNode,
    normalNode
  );
  return add(mul(minorEmissive, minorMask), mul(majorEmissive, majorMask));
}


export function buildWorldGridColorNode(gridHex, minorGridHex = gridHex, lineStrengthScale = 1) {
  return buildGridColorNode(
    gridHex,
    minorGridHex,
    lineStrengthScale,
    positionWorld,
    normalWorld
  );
}


export function buildWorldGridEmissiveNode(
  gridHex,
  minorGridHex = gridHex,
  emissiveStrength = GRID_EMISSIVE_STRENGTH
) {
  return buildGridEmissiveNode(
    gridHex,
    minorGridHex,
    emissiveStrength,
    positionWorld,
    normalWorld
  );
}


export function buildObjectGridColorNode(gridHex, minorGridHex = gridHex, lineStrengthScale = 1) {
  return buildGridColorNode(
    gridHex,
    minorGridHex,
    lineStrengthScale,
    positionGeometry,
    normalGeometry
  );
}


export function buildObjectGridEmissiveNode(
  gridHex,
  minorGridHex = gridHex,
  emissiveStrength = GRID_EMISSIVE_STRENGTH
) {
  return buildGridEmissiveNode(
    gridHex,
    minorGridHex,
    emissiveStrength,
    positionGeometry,
    normalGeometry
  );
}
