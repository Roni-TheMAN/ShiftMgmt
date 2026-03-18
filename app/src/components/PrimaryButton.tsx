import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, componentTokens, spacing, typography } from '../theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'success'
  | 'danger'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

type ResolvedButtonVariant = Exclude<ButtonVariant, 'neutral'>;

export type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

const disabledPalette = {
  backgroundColor: colors.backgrounds.secondary,
  borderColor: colors.borders.subtle,
  textColor: colors.text.muted,
} as const;

function resolveVariant(variant: ButtonVariant): ResolvedButtonVariant {
  return variant === 'neutral' ? 'secondary' : variant;
}

function getButtonTextStyle(size: ButtonSize): TextStyle {
  if (size === 'sm') {
    return typography.bodySm;
  }

  if (size === 'lg') {
    return typography.body;
  }

  return typography.label;
}

export default function PrimaryButton({
  accessibilityLabel,
  contentStyle,
  disabled = false,
  fullWidth = false,
  leadingAccessory,
  onPress,
  size = 'md',
  style,
  testID,
  textStyle,
  title,
  trailingAccessory,
  variant = 'primary',
}: PrimaryButtonProps) {
  const resolvedVariant = resolveVariant(variant);
  const variantTokens = componentTokens.button.variants[resolvedVariant];
  const minHeight = componentTokens.button.heights[size];
  const horizontalPadding = componentTokens.button.paddingX[size];
  const labelStyle = getButtonTextStyle(size);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? disabledPalette.backgroundColor
            : pressed
              ? variantTokens.pressedBackgroundColor
              : variantTokens.backgroundColor,
          borderColor: disabled ? disabledPalette.borderColor : variantTokens.borderColor,
          minHeight,
          opacity: disabled ? 0.7 : 1,
          paddingHorizontal: horizontalPadding,
        },
        variantTokens.shadow,
        fullWidth ? styles.fullWidth : undefined,
        pressed && !disabled ? styles.pressed : undefined,
        style,
      ]}
      testID={testID}
    >
      <View style={[styles.content, contentStyle]}>
        {leadingAccessory ? <View style={styles.accessory}>{leadingAccessory}</View> : null}
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={1}
          style={[
            styles.text,
            labelStyle,
            {
              color: disabled ? disabledPalette.textColor : variantTokens.textColor,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
        {trailingAccessory ? <View style={styles.accessory}>{trailingAccessory}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: componentTokens.button.radius,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  content: {
    alignItems: 'center',
    columnGap: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  text: {
    ...typography.label,
    textAlign: 'center',
  },
});
