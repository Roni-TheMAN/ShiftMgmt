import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

type ChipTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';
type ChipSize = 'sm' | 'md';

type StatusChipProps = {
  label: string;
  tone?: ChipTone;
  size?: ChipSize;
};

const toneStyles = {
  danger: {
    backgroundColor: colors.dangerMuted,
    borderColor: colors.dangerMuted,
    color: colors.danger,
  },
  info: {
    backgroundColor: colors.infoMuted,
    borderColor: colors.infoMuted,
    color: colors.info,
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    color: colors.textSecondary,
  },
  success: {
    backgroundColor: colors.successMuted,
    borderColor: colors.successMuted,
    color: colors.success,
  },
  warning: {
    backgroundColor: colors.warningMuted,
    borderColor: colors.warningMuted,
    color: colors.warning,
  },
} as const;

export default function StatusChip({
  label,
  tone = 'neutral',
  size = 'md',
}: StatusChipProps) {
  const palette = toneStyles[tone];

  return (
    <View
      style={[
        styles.chip,
        size === 'sm' ? styles.chipSmall : null,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Text style={[styles.text, size === 'sm' ? styles.textSmall : null, { color: palette.color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipSmall: {
    minHeight: 26,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  text: {
    ...typography.eyebrow,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 10,
    lineHeight: 14,
  },
});
