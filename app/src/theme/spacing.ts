const scale = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const spacing = {
  scale,

  xxs: scale[1],
  xs: scale[2],
  sm: scale[3],
  md: scale[4],
  lg: scale[6],
  xl: scale[8],
  xxl: scale[12],

  inline: scale[2],
  row: scale[3],
  stack: scale[4],
  compact: scale[5],
  section: scale[6],
  hero: scale[8],
} as const;
