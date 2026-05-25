import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Scene,
  Vector3
} from 'three/webgpu';
import type { InputSnapshot } from '../input/input-state';
import { jumpPadGridMaterial } from '../render/materials/environment-grid-material';
import {
  capsuleIntersectsJumpPadVolume,
  computeJumpPadImpulse
} from '../player/jump-pad-impulse';
import type { JumpImpulseResult } from '../player/player-jump';
import type { BotController } from '../bots/bot-controller';
import type { PlayerController } from '../player/player-controller';
import {
  JUMP_PAD_COUNT,
  JUMP_PAD_HALF_HEIGHT,
  JUMP_PAD_HALF_M,
  JUMP_PAD_HEIGHT_M,
  JUMP_PAD_SIZE_M,
  JUMP_PAD_WORLD_SLOTS,
  type JumpPadSlot
} from './jump-pad-slots';

export { JUMP_PAD_SIZE_M, JUMP_PAD_HEIGHT_M } from './jump-pad-slots';
export type { JumpPadSlot } from './jump-pad-slots';

const ACTOR_SLOT_COUNT = 32;

interface JumpPadFieldDeps {
  readonly scene: Scene;
}

const _composePosition = new Vector3();
const _composeMatrix = new Matrix4();

/** Transparent turquoise trigger pads on team podiums — walk-through, mega-jump on enter. */
export class JumpPadField {
  readonly #slots: readonly JumpPadSlot[] = JUMP_PAD_WORLD_SLOTS;
  readonly #mesh: InstancedMesh;
  /** Per pad × actor slot — set while capsule overlaps volume. */
  readonly #inside = new Uint8Array(JUMP_PAD_COUNT * ACTOR_SLOT_COUNT);

  constructor(deps: JumpPadFieldDeps) {
    this.#mesh = new InstancedMesh(
      new BoxGeometry(JUMP_PAD_SIZE_M, JUMP_PAD_HEIGHT_M, JUMP_PAD_SIZE_M),
      jumpPadGridMaterial(),
      JUMP_PAD_COUNT
    );
    this.#mesh.name = 'team-jump-pads';
    this.#mesh.frustumCulled = false;
    deps.scene.add(this.#mesh);
    this.#syncVisuals();
  }

  tickPlayer(player: PlayerController, input: InputSnapshot, nowMs: number): void {
    if (player.health.isDead) {
      this.#clearActorSlots(0);
      return;
    }

    const translation = player.body.translation();
    const linvel = player.body.linvel();
    this.#tickActor({
      actorSlot: 0,
      x: translation.x,
      y: translation.y,
      z: translation.z,
      yaw: input.yaw,
      movement: input.movement,
      linvel,
      launch: (impulse) => {
        player.launchFromJumpPad(impulse, nowMs);
      }
    });
  }

  tickBots(bots: readonly BotController[], nowMs: number): void {
    for (const [botIndex, bot] of bots.entries()) {
      const actorSlot = botIndex + 1;
      if (bot.health.isDead) {
        this.#clearActorSlots(actorSlot);
        continue;
      }

      const translation = bot.body.translation();
      const linvel = bot.body.linvel();
      const drive = bot.lastDrive;
      this.#tickActor({
        actorSlot,
        x: translation.x,
        y: translation.y,
        z: translation.z,
        yaw: drive?.moveYaw ?? bot.yaw,
        movement: drive?.movement ?? {
          forward: false,
          back: false,
          left: false,
          right: false
        },
        linvel,
        launch: (impulse) => {
          bot.launchFromJumpPad(impulse, nowMs);
        }
      });
    }

    for (let slot = bots.length + 1; slot < ACTOR_SLOT_COUNT; slot += 1) {
      this.#clearActorSlots(slot);
    }
  }

  #tickActor(params: {
    readonly actorSlot: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    readonly movement: InputSnapshot['movement'];
    readonly linvel: { readonly x: number; readonly y: number; readonly z: number };
    readonly launch: (impulse: JumpImpulseResult) => void;
  }): void {
    let padIndex = 0;
    for (const pad of this.#slots) {
      const insideKey = this.#insideKey(padIndex, params.actorSlot);
      const overlapping = capsuleIntersectsJumpPadVolume(
        params.x,
        params.y,
        params.z,
        pad.x,
        pad.y,
        pad.z,
        JUMP_PAD_HALF_M,
        JUMP_PAD_HALF_HEIGHT,
        JUMP_PAD_HALF_M
      );

      if (overlapping) {
        if (this.#inside[insideKey] === 0) {
          this.#inside[insideKey] = 1;
          params.launch(
            computeJumpPadImpulse(pad.x, pad.z, params.yaw, params.movement, params.linvel)
          );
        }
      } else {
        this.#inside[insideKey] = 0;
      }
      padIndex += 1;
    }
  }

  #insideKey(padIndex: number, actorSlot: number): number {
    return padIndex * ACTOR_SLOT_COUNT + actorSlot;
  }

  #clearActorSlots(actorSlot: number): void {
    for (let padIndex = 0; padIndex < JUMP_PAD_COUNT; padIndex += 1) {
      this.#inside[this.#insideKey(padIndex, actorSlot)] = 0;
    }
  }

  #syncVisuals(): void {
    let padIndex = 0;
    for (const pad of this.#slots) {
      _composePosition.set(pad.x, pad.y, pad.z);
      _composeMatrix.identity();
      _composeMatrix.setPosition(_composePosition);
      this.#mesh.setMatrixAt(padIndex, _composeMatrix);
      padIndex += 1;
    }
    this.#mesh.count = this.#slots.length;
    this.#mesh.instanceMatrix.needsUpdate = true;
  }
}
