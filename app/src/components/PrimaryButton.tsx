import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'neutral';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const variantColors: Record<
  ButtonVariant,
  { background: string; border: string; pressed: string; text: string }
> = {
  danger: {
    background: colors.dangerMuted,
    border: colors.dangerMuted,
    pressed: 'rgba(242, 90, 106, 0.26)',
    text: colors.danger,
  },
  neutral: {
    background: colors.surfaceMuted,
    border: colors.border,
    pressed: colors.surfaceHighlight,
    text: colors.textPrimary,
  },
  primary: {
    background: colors.surfaceHighlight,
    border: colors.borderStrong,
    pressed: colors.surfaceMuted,
    text: colors.textPrimary,
  },
  success: {
    background: colors.primary,
    border: colors.primaryPressed,
    pressed: colors.primaryPressed,
    text: colors.textInverse,
  },
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  style,
}: PrimaryButtonProps) {
  const palette = variantColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? colors.disabled
            : pressed
              ? palette.pressed
              : palette.background,
          borderColor: disabled ? colors.border : palette.border,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth ? styles.fullWidth : undefined,
        style,
      ]}
    >
      <View style={styles.content}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={1}
          style={[styles.text, { color: palette.text }]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...typography.label,
    fontFamily: 'AvenirNext-DemiBold',
  },
});
