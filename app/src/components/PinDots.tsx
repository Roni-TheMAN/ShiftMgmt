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
            {
              backgroundColor: index < length ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 9,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  dotCompact: {
    height: 14,
    width: 14,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
});
