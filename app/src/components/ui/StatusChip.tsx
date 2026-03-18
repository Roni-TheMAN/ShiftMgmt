import { StyleSheet, Text, View } from 'react-native';
import { componentTokens, spacing, typography } from '../../theme';

type ChipTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';
type ChipSize = 'sm' | 'md';

type StatusChipProps = {
  label: string;
  tone?: ChipTone;
  size?: ChipSize;
};

const toneStyles = {
  danger: componentTokens.chip.variants.danger,
  info: componentTokens.chip.variants.bronze,
  neutral: componentTokens.chip.variants.neutral,
  success: componentTokens.chip.variants.olive,
  warning: componentTokens.chip.variants.terracotta,
} as const;

export default function StatusChip({
  label,
  tone = 'neutral',
  size = 'md',
}: StatusChipProps) {
  const palette = toneStyles[tone];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.chip,
        isSmall ? styles.chipSmall : null,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          isSmall ? styles.textSmall : null,
          {
            color: palette.textColor,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: componentTokens.chip.radius,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: componentTokens.chip.minHeight.md,
    paddingHorizontal: componentTokens.chip.paddingX.md,
    paddingVertical: spacing.xxs + 1,
  },
  chipSmall: {
    minHeight: componentTokens.chip.minHeight.sm,
    paddingHorizontal: componentTokens.chip.paddingX.sm,
    paddingVertical: spacing.xxs,
  },
  text: {
    ...typography.chip,
  },
  textSmall: {
    ...typography.micro,
    letterSpacing: 0.4,
  },
});
