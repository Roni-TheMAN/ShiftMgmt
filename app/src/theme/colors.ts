const backgrounds = {
  canvas: '#F7F3EC',
  card: '#FFFDF9',
  secondary: '#F1EAE0',
  sunken: '#ECE3D7',
} as const;

const text = {
  primary: '#2B241F',
  secondary: '#6D6258',
  muted: '#8A7D72',
  inverse: '#FFFDF9',
} as const;

const borders = {
  subtle: '#E7DDD2',
  default: '#DDD2C6',
  strong: '#CDBEAF',
  focus: '#C48A3A',
} as const;

const accents = {
  bronze: '#C48A3A',
  bronzePressed: '#A97431',
  terracotta: '#B86B4B',
  terracottaPressed: '#99583D',
  olive: '#7A8B5A',
  olivePressed: '#64724A',
} as const;

const tints = {
  bronze: '#F4E7D4',
  terracotta: '#F3E2DB',
  olive: '#E5ECD9',
  danger: '#F6E2E2',
} as const;

const states = {
  success: '#5C8A61',
  danger: '#B85C5C',
} as const;

const shadows = {
  card: 'rgba(62, 45, 32, 0.08)',
  raised: 'rgba(62, 45, 32, 0.12)',
} as const;

export const colors = {
  backgrounds,
  text,
  borders,
  accents,
  tints,
  states,
  shadows,
  utility: {
    white: backgrounds.card,
    black: text.primary,
    overlay: 'rgba(43, 36, 31, 0.08)',
  },

  // Backward-compatible aliases for the current app UI.
  background: backgrounds.canvas,
  backgroundElevated: backgrounds.canvas,
  surface: backgrounds.card,
  surfaceElevated: backgrounds.card,
  surfaceMuted: backgrounds.secondary,
  surfaceHighlight: '#F8F2E8',
  input: backgrounds.card,
  border: borders.default,
  borderStrong: borders.strong,
  primary: accents.bronze,
  primaryPressed: accents.bronzePressed,
  success: states.success,
  successMuted: tints.olive,
  info: accents.bronze,
  infoMuted: tints.bronze,
  warning: accents.terracotta,
  warningMuted: tints.terracotta,
  danger: states.danger,
  dangerMuted: tints.danger,
  textPrimary: text.primary,
  textSecondary: text.secondary,
  textMuted: text.muted,
  textInverse: text.inverse,
  disabled: '#D5CBBE',
  white: backgrounds.card,
  black: text.primary,
  overlay: 'rgba(43, 36, 31, 0.08)',
  glowPrimary: tints.bronze,
  glowInfo: tints.bronze,
  glowDanger: tints.danger,
} as const;
