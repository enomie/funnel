import type { Vector3 } from 'three/webgpu';
import type { FireProfile, ImpactProfile, WeaponDefinition } from '../../combat/weapon-definitions';
import { IMPACT_GAIN_RICOCHET } from '../audio-config';
import { playBakedPhrase, scheduleVoiceTail } from '../audio-baked-phrase';
import { AudioContextEngine } from '../audio-mixer';
import {
  scheduleDefaultImpactPhrase
} from '../audio-one-shots/audio-impact-default';
import {
  scheduleRocketImpactPhrase
} from '../audio-one-shots/audio-impact-rocket';
import { getAudioRedeemerImpact } from '../audio-one-shots/audio-impact-redeemer';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { getAudioFlybyVoice } from '../audio-flyby/audio-flyby-voice';
import { playNoAmmoKlick } from './audio-no-ammo-klick';
import { WeaponReloadAudio, type ReloadMechanicsState } from './audio-weapon-reloading';
import {
  WeaponChargeHoldAudio,
  type ChargeHoldMechanicsState
} from './audio-weapon-charge-hold';
import { deriveFireAudioPreset } from './audio-fire-preset';
import { getBakedFire, getBakedImpact } from './audio-weapon-bake';
import { scheduleFirePhrase } from '../audio-one-shots/audio-fire-phrase';

export type { ReloadMechanicsState, ChargeHoldMechanicsState };

/** Combat-facing weapon audio — fire, fly, impact, reload, dry-fire. */
export class WeaponAudio {
  readonly #flyby = getAudioFlybyVoice();
  readonly #redeemerImpact = getAudioRedeemerImpact();
  readonly #reload = new WeaponReloadAudio();
  readonly #chargeHold = new WeaponChargeHoldAudio();

  attachProjectileFly(
    weapon: WeaponDefinition,
    position: Vector3,
    direction: Vector3,
    speed: number,
    impactRadius: number
  ): number | null {
    return this.#flyby.attach(weapon, position, direction, speed, impactRadius);
  }

  syncProjectileFly(
    slotIndex: number,
    position: Vector3,
    direction: Vector3,
    speed: number
  ): boolean {
    return this.#flyby.sync(slotIndex, position, direction, speed);
  }

  detachProjectileFly(slotIndex: number): void {
    this.#flyby.detach(slotIndex);
  }

  playFire(
    weapon: WeaponDefinition,
    position: Vector3,
    fire: FireProfile,
    impact: ImpactProfile
  ): void {
    const voice = tryBeginSpatialOneShot(position, 'fire');
    if (voice === null) {
      return;
    }

    AudioContextEngine.get().resume();
    const context = AudioContextEngine.get().context;
    const baked = getBakedFire(weapon, fire);
    if (baked !== undefined) {
      const played = playBakedPhrase(context, baked, voice.input);
      voice.track(played.source, played.gainNode);
      voice.endAfter(played.source);
      return;
    }

    const preset = deriveFireAudioPreset(weapon, fire, impact);
    const time = context.currentTime;
    const durationS = scheduleFirePhrase(context, voice.input, preset, fire, time);
    const tail = scheduleVoiceTail(context, voice.input, durationS);
    voice.track(tail);
    voice.endAfter(tail);
  }

  playImpact(
    weapon: WeaponDefinition,
    position: Vector3,
    gainScale: number,
    impact: ImpactProfile,
    options: { ricochet?: boolean } = {}
  ): void {
    const range = weapon.visualKind === 'redeemer' ? 'mapWide' : 'combat';
    const voice = tryBeginSpatialOneShot(position, 'impact', range);
    if (voice === null) {
      return;
    }

    const scale = options.ricochet === true ? gainScale * IMPACT_GAIN_RICOCHET : gainScale;
    AudioContextEngine.get().resume();
    const context = AudioContextEngine.get().context;
    const baked = getBakedImpact(weapon, impact);

    if (baked !== undefined) {
      const played = playBakedPhrase(context, baked, voice.input, scale);
      voice.track(played.source, played.gainNode);
      voice.endAfter(played.source);
      return;
    }

    const time = context.currentTime;
    let durationS: number;
    if (weapon.visualKind === 'rocket') {
      durationS = scheduleRocketImpactPhrase(impact.impactRadius, scale, time, context, voice.input);
    } else {
      durationS = scheduleDefaultImpactPhrase(weapon, impact, scale, time, context, voice.input);
    }
    const tail = scheduleVoiceTail(context, voice.input, durationS);
    voice.track(tail);
    voice.endAfter(tail);
  }

  playRedeemerBlastSpread(position: Vector3, gainScale: number): number | null {
    return this.#redeemerImpact.attach(position, gainScale);
  }

  stopRedeemerBlastSpread(slotIndex: number): void {
    this.#redeemerImpact.detach(slotIndex);
  }

  playEmptyClick(_weapon: WeaponDefinition, position: Vector3, nowMs: number): void {
    playNoAmmoKlick(position, nowMs);
  }

  syncReloadMechanics(
    _weapon: WeaponDefinition,
    position: Vector3,
    state: ReloadMechanicsState,
    nowMs: number
  ): void {
    this.#reload.sync(position, state, nowMs);
  }

  syncChargeHoldMechanics(position: Vector3, state: ChargeHoldMechanicsState): void {
    this.#chargeHold.sync(position, state);
  }

  stopReloadMechanics(): void {
    this.#reload.stop();
    this.#chargeHold.stop();
  }

  hasActiveMechanicsVoice(): boolean {
    return this.#reload.isActive() || this.#chargeHold.isActive();
  }
}
