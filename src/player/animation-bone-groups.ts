// Path: /Users/johann/MyBrew/funnel-real/src/player/animation-bone-groups.ts


export const LOWER_BODY_BONE_PREFIXES = [
  'mixamorig_LeftUpLeg',
  'mixamorig_RightUpLeg',
  'mixamorig_LeftLeg',
  'mixamorig_RightLeg',
  'mixamorig_LeftFoot',
  'mixamorig_RightFoot',
  'mixamorig_LeftToeBase',
  'mixamorig_RightToeBase',
  'mixamorig_LeftToe_End',
  'mixamorig_RightToe_End'
] as const;

export function isLowerBodyTrack(trackName: string): boolean {
  const dot = trackName.lastIndexOf('.');
  const boneName = dot === -1 ? trackName : trackName.slice(0, dot);
  return LOWER_BODY_BONE_PREFIXES.some(
    (prefix) => boneName === prefix || boneName.startsWith(`${prefix}_`)
  );
}
