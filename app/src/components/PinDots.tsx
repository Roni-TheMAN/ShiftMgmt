import { StyleSheet, View } from 'react-native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { colors, spacing } from '../theme';

type PinDotsProps = {
  length: number;
  maxLength: number;
};

export default function PinDots({ length, maxLength }: PinDotsProps) {
  const { isVeryCompactWidth } = useResponsiveLayout();

  return (
    <View style={styles.row}>
      {Array.from({ length: maxLength }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            isVeryCompactWidth ? styles.dotCompact : null,
            index < length ? styles.dotFilled : styles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 999,
    borderWidth: 1,
    height: 16,
    width: 16,
  },
  dotCompact: {
    height: 12,
    width: 12,
  },
  dotEmpty: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
});
