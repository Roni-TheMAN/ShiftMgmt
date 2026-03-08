import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { spacing } from '../theme';

export default function useResponsiveLayout() {
  const { height, width } = useWindowDimensions();

  return useMemo(() => {
    const isCompactWidth = width < 768;
    const isVeryCompactWidth = width < 420;
    const isShortHeight = height < 700;

    const horizontalPadding = isVeryCompactWidth
      ? spacing.sm
      : isCompactWidth
        ? spacing.md
        : spacing.lg;

    return {
      horizontalPadding,
      isCompactWidth,
      isShortHeight,
      isVeryCompactWidth,
      width,
    };
  }, [height, width]);
}
