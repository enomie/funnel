import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, RigidBody, TempContactForceEvent, World } from '@dimforge/rapier3d-simd-compat';
import { Vector3 } from 'three/webgpu';
import { PLAYER_CONFIG } from '../config/game-config';
import type { InputSnapshot } from '../input/input-state';
import { PlayerHealth } from './player-health';
import type { LocomotionAnimInput, PlayerVisual } from './player-visual';

const JUMP_BUFFER_MS = 180;
const JUMP_COYOTE_MS = 120;
const AIRBORNE_GRACE_MS = 160;

export interface PlayerFrame {
  position: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  airborne: boolean;
  aimHeld: boolean;
  isDead: boolean;
  health: number;
  mode: InputSnapshot['mode'];
  buildMode: InputSnapshot['buildMode'];
}

export class PlayerController {
  readonly body: RigidBody;
  readonly collider: Collider;
  readonly crouchCollider: Collider;
  readonly visual: PlayerVisual;
  readonly health: PlayerHealth;
  readonly #world: World;
  #grounded = false;
  #airborne = false;
  #lastJumpAt = -Infinity;
  #lastJumpPressedAt = -Infinity;
  #jumpGraceUntil = 0;
  #coyoteUntil = 0;
  #isJump = false;
  #isCrouch = false;
  #isSliding = false;
  #wasFireHeld = false;

  constructor(world: World, visual: PlayerVisual) {
    this.#world = world;
    this.visual = visual;
    this.health = new PlayerHealth();
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(PLAYER_CONFIG.spawn.x, PLAYER_CONFIG.spawn.y, PLAYER_CONFIG.spawn.z)
        .lockRotations()
        .setLinearDamping(0.05)
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_CONFIG.halfHeight, PLAYER_CONFIG.radius)
        .setFriction(1.15)
        .setRestitution(0)
        .setMass(1)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
      this.body
    );
    this.crouchCollider = world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_CONFIG.halfHeight * 0.5, PLAYER_CONFIG.radius)
        .setTranslation(0, -PLAYER_CONFIG.halfHeight * 0.5, 0)
        .setFriction(1.15)
        .setRestitution(0)
        .setMass(1)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
      this.body
    );
    this.crouchCollider.setEnabled(false);
  }

  update(deltaSeconds: number, input: InputSnapshot): PlayerFrame {
    const now = performance.now();

    if (!this.health.isDead) {
      this.#reconcileGrounded(now);
      this.#applyKeyEdges(input, now);
      this.#applyJumpImpulse(now);
      this.#applyMovement(deltaSeconds, input);
    }

    this.#airborne = !this.#grounded || now < this.#jumpGraceUntil;

    this.#syncVisual(input);
    this.visual.setAimVisible(input.aimHeld);
    this.visual.updateLocomotion(deltaSeconds, this.#locomotionInput(input));
    this.#wasFireHeld = input.fireHeld;

    return {
      position: this.position(),
      yaw: input.yaw,
      pitch: input.pitch,
      grounded: this.#grounded,
      airborne: this.#airborne,
      aimHeld: input.aimHeld,
      isDead: this.health.isDead,
      health: this.health.health,
      mode: input.mode,
      buildMode: input.buildMode
    };
  }

  handleContactForceEvent(event: TempContactForceEvent): void {
    const handle1 = event.collider1();
    const handle2 = event.collider2();
    if (
      handle1 !== this.collider.handle &&
      handle2 !== this.collider.handle &&
      handle1 !== this.crouchCollider.handle &&
      handle2 !== this.crouchCollider.handle
    ) {
      return;
    }

    const now = performance.now();
    if (Math.abs(event.totalForce().y) > 1 && now > this.#lastJumpAt + 100) {
      this.#grounded = true;
      this.#coyoteUntil = now + JUMP_COYOTE_MS;
    }
  }

  position(): Vector3 {
    return new Vector3(this.body.translation().x, this.body.translation().y, this.body.translation().z);
  }

  #applyJumpImpulse(now: number): void {
    if (!this.#isJump) {
      return;
    }

    this.#isJump = false;
    this.#lastJumpAt = now;
    this.#grounded = false;
    this.#coyoteUntil = 0;
    this.#jumpGraceUntil = now + AIRBORNE_GRACE_MS;

    const velocity = this.body.linvel();
    this.body.setLinvel({ x: velocity.x, y: PLAYER_CONFIG.jumpVelocity, z: velocity.z }, true);
  }

  #reconcileGrounded(now: number): void {
    if (now < this.#jumpGraceUntil) {
      this.#grounded = false;
      return;
    }

    const rayGrounded = this.#detectGrounded();
    if (rayGrounded) {
      this.#grounded = true;
      this.#coyoteUntil = now + JUMP_COYOTE_MS;
      return;
    }

    if (now < this.#coyoteUntil) {
      this.#grounded = true;
      return;
    }

    this.#grounded = false;
  }

  #applyMovement(deltaSeconds: number, input: InputSnapshot): void {
    this.#syncCrouchCollider();

    const moveCount =
      Number(input.movement.forward) +
      Number(input.movement.back) +
      Number(input.movement.left) +
      Number(input.movement.right);
    let speed: number =
      input.sprintHeld && !this.#isCrouch ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
    if (moveCount === 2) {
      speed /= Math.sqrt(2);
    } else if (moveCount === 0) {
      speed = 0;
    }

    if (this.#isCrouch) {
      speed /= 2;
    }

    const angle = input.yaw;
    let inputX = 0;
    let inputZ = 0;

    if (input.movement.forward) {
      inputZ += speed * Math.cos(angle);
      inputX += speed * Math.sin(angle);
    }

    if (input.movement.back) {
      inputZ += -speed * Math.cos(angle);
      inputX += -speed * Math.sin(angle);
    }

    if (input.movement.left) {
      inputX += speed * Math.cos(angle);
      inputZ += -speed * Math.sin(angle);
    }

    if (input.movement.right) {
      inputX += -speed * Math.cos(angle);
      inputZ += speed * Math.sin(angle);
    }

    let velocity = this.body.linvel();

    if (velocity.y < PLAYER_CONFIG.maxFallSpeed) {
      this.body.setLinvel({ x: velocity.x, y: PLAYER_CONFIG.maxFallSpeed, z: velocity.z }, true);
      velocity = this.body.linvel();
    }

    if (this.#grounded) {
      this.body.setLinvel({ x: inputX, y: velocity.y, z: inputZ }, true);
      const activeCollider = this.#isCrouch || this.#isSliding ? this.crouchCollider : this.collider;
      const characterController = this.#world.createCharacterController(0);
      characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
      characterController.computeColliderMovement(activeCollider, {
        x: inputX * deltaSeconds,
        y: velocity.y * deltaSeconds,
        z: inputZ * deltaSeconds
      });
      const correctedMovement = characterController.computedMovement();
      if (deltaSeconds > 0) {
        this.body.setLinvel(
          {
            x: correctedMovement.x / deltaSeconds,
            y: correctedMovement.y / deltaSeconds,
            z: correctedMovement.z / deltaSeconds
          },
          true
        );
      }
      this.#world.removeCharacterController(characterController);
      return;
    }

    const nextX = velocity.x + inputX * deltaSeconds;
    const nextZ = velocity.z + inputZ * deltaSeconds;
    const horizontal = new Vector3(nextX, 0, nextZ);
    if (horizontal.length() > PLAYER_CONFIG.walkSpeed) {
      horizontal.setLength(PLAYER_CONFIG.walkSpeed);
    }

    this.body.setLinvel(
      {
        x: horizontal.x,
        y: Math.max(velocity.y, PLAYER_CONFIG.maxFallSpeed),
        z: horizontal.z
      },
      true
    );
  }

  #detectGrounded(extraDistance = 0): boolean {
    const position = this.body.translation();
    const ray = new RAPIER.Ray(position, { x: 0, y: -1, z: 0 });
    const maxToi = PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius + 0.18 + extraDistance;
    const hit = this.#world.castRay(ray, maxToi, true, undefined, undefined, undefined, this.body);
    return hit !== null && hit.timeOfImpact <= maxToi;
  }

  #syncCrouchCollider(): void {
    const crouchColliderActive = this.#isCrouch || this.#isSliding;
    this.collider.setEnabled(!crouchColliderActive);
    this.crouchCollider.setEnabled(crouchColliderActive);
  }

  #syncVisual(input: InputSnapshot): void {
    this.visual.root.position.copy(this.body.translation());
    this.visual.root.rotation.y = input.yaw;
  }

  #locomotionInput(input: InputSnapshot): LocomotionAnimInput {
    return {
      movement: input.movement,
      sprint: input.sprintHeld && !this.#isCrouch,
      grounded: this.#grounded,
      airborne: this.#airborne,
      crouch: this.#isCrouch,
      sliding: this.#isSliding,
      fireStarted:
        input.mode === 'weapon' && input.fireHeld && !this.#wasFireHeld && !this.health.isDead,
      isDead: this.health.isDead
    };
  }

  #applyKeyEdges(input: InputSnapshot, now: number): void {
    if (input.killPressed) {
      this.health.kill();
    }

    if (input.respawnPressed && this.health.isDead) {
      this.health.respawn();
      const spawn = PLAYER_CONFIG.spawn;
      this.body.setTranslation(spawn, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.#grounded = true;
      this.#airborne = false;
      this.#jumpGraceUntil = 0;
      return;
    }

    if (this.health.isDead) {
      return;
    }

    if (input.jumpPressed) {
      this.#lastJumpPressedAt = now;
    }

    const canJump =
      this.#grounded ||
      now < this.#coyoteUntil ||
      this.#detectGrounded(0.35);
    const jumpBuffered = now < this.#lastJumpPressedAt + JUMP_BUFFER_MS;

    if (jumpBuffered && canJump) {
      this.#lastJumpPressedAt = -Infinity;
      this.#isJump = true;
    }

    if (input.crouchPressed && this.#grounded) {
      this.#isCrouch = !this.#isCrouch;
    }

    this.#isSliding = false;
  }
}
