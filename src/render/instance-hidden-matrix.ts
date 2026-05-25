import { Matrix4, Quaternion, Vector3 } from 'three/webgpu';

const HIDDEN_Y = -5000;
const HIDDEN_SCALE = 0.001;

const _position = new Vector3();
const _quaternion = new Quaternion();
const _scale = new Vector3();
const _hiddenMatrix = new Matrix4();

/** Off-screen instance transform — recompose on every release (never cache alongside sync scratch). */
export function hiddenInstanceMatrix(): Matrix4 {
  return _hiddenMatrix.compose(
    _position.set(0, HIDDEN_Y, 0),
    _quaternion.identity(),
    _scale.set(HIDDEN_SCALE, HIDDEN_SCALE, HIDDEN_SCALE)
  );
}
