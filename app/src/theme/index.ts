import { colors } from './colors';
import { componentTokens } from './components';
import { layout } from './layout';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography, fontFamilies, fontWeights } from './typography';

export const theme = {
  colors,
  componentTokens,
  layout,
  radius,
  shadows,
  spacing,
  typography,
} as const;

export {
  colors,
  componentTokens,
  fontFamilies,
  fontWeights,
  layout,
  radius,
  shadows,
  spacing,
  typography,
};

export { createShadow, withAlpha } from './utils';
