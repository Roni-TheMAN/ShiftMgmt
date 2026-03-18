import type { ViewStyle } from 'react-native';
import { colors } from './colors';
import { createShadow } from './utils';

type ShadowToken = Readonly<ViewStyle>;

export const shadows: Record<'none' | 'card' | 'raised' | 'focusRing', ShadowToken> = {
  none: {},
  card: createShadow({
    color: colors.shadows.card,
    elevation: 2,
    offsetY: 8,
    opacity: 0.08,
    radius: 20,
  }),
  raised: createShadow({
    color: colors.shadows.raised,
    elevation: 4,
    offsetY: 12,
    opacity: 0.12,
    radius: 28,
  }),
  focusRing: createShadow({
    color: colors.accents.bronze,
    elevation: 0,
    offsetY: 0,
    opacity: 0.12,
    radius: 12,
  }),
};
