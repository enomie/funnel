// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-config.ts


export const SPATIAL_ONE_SHOT_VOICE_CAP = 48;
export const FOOTSTEP_VOICE_CAP = 6;
export const WEAPON_AUDIO_FLY_VOICE_CAP = 24;


export type SpatialOneShotKind =
  | 'fire'
  | 'impact'
  | 'foot'
  | 'grunt'
  | 'mechanics'
  | 'mechanics-hold'
  | 'generic'
  | 'redeemer-blast';

export const SPATIAL_ONE_SHOT_TTL_S: Record<SpatialOneShotKind, number> = {
  foot: 0.2,
  mechanics: 0.08,
  'mechanics-hold': 45,
  fire: 0.55,
  generic: 0.2,
  impact: 2,
  grunt: 4,
  'redeemer-blast': 3.2
};


export const SPATIAL_ONE_SHOT_EVICT_RANK: Record<SpatialOneShotKind, number> = {
  foot: 0,
  grunt: 1,
  mechanics: 2,
  generic: 3,
  fire: 4,
  impact: 5,
  'redeemer-blast': 6,
  'mechanics-hold': 7
};


export const GRUNT_PHRASE_BUFFER_CACHE_CAP = 32;


export const AUDIO_MASTER_GAIN = 0.92;


export const AUDIO_HEARING_RANGE_M = 150;
export const AUDIO_HEARING_RANGE_SQ = AUDIO_HEARING_RANGE_M * AUDIO_HEARING_RANGE_M;
export const AUDIO_FOOTSTEP_RANGE_M = 20;
export const AUDIO_FOOTSTEP_RANGE_SQ = AUDIO_FOOTSTEP_RANGE_M * AUDIO_FOOTSTEP_RANGE_M;

export const AUDIO_MAP_WIDE_RANGE_M = 320;
export const AUDIO_MAP_WIDE_RANGE_SQ = AUDIO_MAP_WIDE_RANGE_M * AUDIO_MAP_WIDE_RANGE_M;


export const AUDIO_PANNER_REF_DISTANCE_M = 3.2;
export const AUDIO_PANNER_ROLLOFF_FACTOR = 0.85;
export const AUDIO_FOOTSTEP_REF_DISTANCE_M = 2;
export const AUDIO_FOOTSTEP_ROLLOFF_FACTOR = 1.1;
export const AUDIO_MAP_WIDE_REF_DISTANCE_M = 18;
export const AUDIO_MAP_WIDE_ROLLOFF_FACTOR = 0.22;
export const AUDIO_PANNER_MODEL: PanningModelType = 'equalpower';
export const AUDIO_DISTANCE_MODEL: DistanceModelType = 'inverse';


export const AUDIO_VOICE_PEAK = 0.035;


export const AUDIO_GRUNT_OUTPUT_GAIN = 0.5;


export const BAKED_NOISE_PEAK = 0.15;


export const IMPACT_GAIN_NORMAL = 2;
export const IMPACT_GAIN_EXPLOSIVE = 3.25;
export const IMPACT_GAIN_REDEEMER = 8.5;
export const IMPACT_GAIN_BUILD = 2.35;
export const IMPACT_GAIN_RICOCHET = 0.52;

export const FLY_DOPPLER_FACTOR = 1.15;
export const FLY_DOPPLER_PITCH_REFERENCE_SPEED = 220;
export const FLY_DOPPLER_MAX_PITCH_SHIFT = 0.38;
