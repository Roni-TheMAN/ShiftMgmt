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
  { background: string; pressed: string; text: string }
> = {
  danger: {
    background: colors.danger,
    pressed: '#7A3E3E',
    text: colors.textInverse,
  },
  neutral: {
    background: colors.surface,
    pressed: '#D8D9D5',
    text: colors.textPrimary,
  },
  primary: {
    background: colors.primary,
    pressed: colors.primaryPressed,
    text: colors.textInverse,
  },
  success: {
    background: colors.success,
    pressed: '#3F644B',
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
        },
        fullWidth ? styles.fullWidth : undefined,
        style,
      ]}
    >
      <View style={styles.content}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
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
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...typography.h2,
    textTransform: 'uppercase',
  },
});
