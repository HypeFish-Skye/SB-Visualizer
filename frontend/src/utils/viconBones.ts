// Anatomical joint pairs for the standard 53-marker Vicon Plug-in Gait / Full Body rig
export const VICON_SKELETAL_BONES: [string, string][] = [
  // Head Cap
  ['ARIEL', 'LFHD'], ['ARIEL', 'RFHD'], ['ARIEL', 'LBHD'], ['ARIEL', 'RBHD'],
  ['LFHD', 'RFHD'], ['RFHD', 'RBHD'], ['RBHD', 'LBHD'], ['LBHD', 'LFHD'],

  // Neck & Spine
  ['C7', 'T10'], ['C7', 'CLAV'], ['T10', 'STRN'], ['CLAV', 'STRN'],
  ['C7', 'LFSH'], ['C7', 'RFSH'], ['CLAV', 'LFSH'], ['CLAV', 'RFSH'],
  ['LFSH', 'LBSH'], ['RFSH', 'RBSH'],

  // Left Arm
  ['LFSH', 'LUPA'], ['LUPA', 'LELB'], ['LELB', 'LIEL'], ['LELB', 'LFRM'],
  ['LFRM', 'LOWR'], ['LOWR', 'LIWR'], ['LOWR', 'LOHAND'], ['LIWR', 'LIHAND'],

  // Right Arm
  ['RFSH', 'RUPA'], ['RUPA', 'RELB'], ['RELB', 'RIEL'], ['RELB', 'RFRM'],
  ['RFRM', 'ROWR'], ['ROWR', 'RIWR'], ['ROWR', 'ROHAND'], ['RIWR', 'RIHAND'],

  // Pelvis / Waist Ring
  ['T10', 'MBWT'], ['STRN', 'MFWT'],
  ['LFWT', 'MFWT'], ['MFWT', 'RFWT'], ['RFWT', 'RBWT'],
  ['RBWT', 'MBWT'], ['MBWT', 'LBWT'], ['LBWT', 'LFWT'],

  // Left Leg
  ['LFWT', 'LTHI'], ['LBWT', 'LTHI'], ['LTHI', 'LKNE'], ['LKNE', 'LKNI'],
  ['LKNE', 'LSHN'], ['LSHN', 'LANK'], ['LANK', 'LHEL'], ['LANK', 'LMT5'],
  ['LHEL', 'LMT5'], ['LMT5', 'LTOE'], ['LTOE', 'LMT1'], ['LMT1', 'LANK'],

  // Right Leg
  ['RFWT', 'RTHI'], ['RBWT', 'RTHI'], ['RTHI', 'RKNE'], ['RKNE', 'RKNI'],
  ['RKNE', 'RSHN'], ['RSHN', 'RANK'], ['RANK', 'RHEL'], ['RANK', 'RMT5'],
  ['RHEL', 'RMT5'], ['RMT5', 'RTOE'], ['RTOE', 'RMT1'], ['RMT1', 'RANK'],
];

// Prop Person 5-marker geometric cluster cage
export const PROP_CLUSTER_BONES: [number, number][] = [
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [1, 3], [2, 4]
];