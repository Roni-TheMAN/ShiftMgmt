import { StyleSheet, View } from 'react-native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { colors, radius, spacing, withAlpha } from '../theme';

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
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  dotCompact: {
    height: 14,
    width: 14,
  },
  dotEmpty: {
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.strong,
  },
  dotFilled: {
    backgroundColor: colors.accents.bronze,
    borderColor: colors.accents.bronze,
    shadowColor: withAlpha(colors.accents.bronze, 0.4),
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
