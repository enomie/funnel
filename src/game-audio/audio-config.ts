/** Voice pool caps. */
export const SPATIAL_ONE_SHOT_VOICE_CAP = 48;
export const FOOTSTEP_VOICE_CAP = 6;
export const WEAPON_AUDIO_FLY_VOICE_CAP = 24;

/** One-shot lease safety TTL (s) — used when `onended` is missed. */
export type SpatialOneShotKind = 'fire' | 'impact' | 'foot' | 'grunt' | 'mechanics' | 'generic';

export const SPATIAL_ONE_SHOT_TTL_S: Record<SpatialOneShotKind, number> = {
  foot: 0.2,
  mechanics: 0.08,
  fire: 0.55,
  generic: 0.2,
  impact: 2,
  grunt: 4
};

/** Lower rank = evicted first when the one-shot pool is full. */
export const SPATIAL_ONE_SHOT_EVICT_RANK: Record<SpatialOneShotKind, number> = {
  foot: 0,
  grunt: 1,
  mechanics: 2,
  generic: 3,
  fire: 4,
  impact: 5
};

/** Baked grunt phrase cache — repeated jump/land barks. */
export const GRUNT_PHRASE_BUFFER_CACHE_CAP = 32;

/** Master graph. */
export const AUDIO_MASTER_GAIN = 0.92;

/** Hearing range (m) — footsteps short; combat 150 m; map-wide for Redeemer nuke. */
export const AUDIO_HEARING_RANGE_M = 150;
export const AUDIO_HEARING_RANGE_SQ = AUDIO_HEARING_RANGE_M * AUDIO_HEARING_RANGE_M;
export const AUDIO_FOOTSTEP_RANGE_M = 20;
export const AUDIO_FOOTSTEP_RANGE_SQ = AUDIO_FOOTSTEP_RANGE_M * AUDIO_FOOTSTEP_RANGE_M;
/** Full funnel diagonal (50×300 m) + margin — Redeemer audible anywhere on map. */
export const AUDIO_MAP_WIDE_RANGE_M = 320;
export const AUDIO_MAP_WIDE_RANGE_SQ = AUDIO_MAP_WIDE_RANGE_M * AUDIO_MAP_WIDE_RANGE_M;

/** Panner — combat @ 150 m; footsteps @ 20 m; map-wide @ 320 m with gentle rolloff. */
export const AUDIO_PANNER_REF_DISTANCE_M = 3.2;
export const AUDIO_PANNER_ROLLOFF_FACTOR = 0.85;
export const AUDIO_FOOTSTEP_REF_DISTANCE_M = 2;
export const AUDIO_FOOTSTEP_ROLLOFF_FACTOR = 1.1;
export const AUDIO_MAP_WIDE_REF_DISTANCE_M = 18;
export const AUDIO_MAP_WIDE_ROLLOFF_FACTOR = 0.22;
export const AUDIO_PANNER_MODEL: PanningModelType = 'equalpower';
export const AUDIO_DISTANCE_MODEL: DistanceModelType = 'inverse';

/**
 * Shared peak linear gain for every spatial voice.
 * Overlap loudness is handled by the one SFX-bus limiter in `audio-mixer.ts`.
 */
export const AUDIO_VOICE_PEAK = 0.035;

/** Grunt synth master scale (× internal 0.95 output peak). */
export const AUDIO_GRUNT_OUTPUT_GAIN = 0.5;

/** Baked noise buffer normalization — not output loudness. */
export const BAKED_NOISE_PEAK = 0.15;

/** Combat impact multipliers (× AUDIO_VOICE_PEAK). */
export const IMPACT_GAIN_NORMAL = 2;
export const IMPACT_GAIN_EXPLOSIVE = 3.25;
export const IMPACT_GAIN_REDEEMER = 8.5;
export const IMPACT_GAIN_BUILD = 2.35;
export const IMPACT_GAIN_RICOCHET = 0.52;

export const FLY_DOPPLER_FACTOR = 1.15;
export const FLY_DOPPLER_PITCH_REFERENCE_SPEED = 220;
export const FLY_DOPPLER_MAX_PITCH_SHIFT = 0.38;
