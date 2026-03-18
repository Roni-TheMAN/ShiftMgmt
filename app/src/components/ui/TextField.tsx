import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, componentTokens, typography } from '../../theme';

type TextFieldProps = TextInputProps & {
  label: string;
  description?: string;
  error?: string | null;
  helperText?: string;
  variant?: 'default' | 'readonly' | 'danger';
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
  messageStyle?: StyleProp<TextStyle>;
  reserveMessageSpace?: boolean;
};

export default function TextField({
  containerStyle,
  description,
  error,
  helperText,
  inputContainerStyle,
  label,
  labelStyle,
  messageStyle,
  onBlur,
  onFocus,
  placeholderTextColor,
  reserveMessageSpace = false,
  style,
  descriptionStyle,
  editable = true,
  multiline = false,
  textAlignVertical,
  variant,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const resolvedVariant =
    variant ?? (editable ? 'default' : 'readonly');
  const palette = componentTokens.input.variants[resolvedVariant];
  const message = error ?? helperText ?? null;
  const isDisabled = !editable;
  const inputStatePalette = isDisabled
    ? componentTokens.input.disabled
    : palette;

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: inputStatePalette.labelColor }, labelStyle]}>
          {label}
        </Text>
        {description ? (
          <Text
            style={[
              styles.description,
              { color: inputStatePalette.descriptionColor },
              descriptionStyle,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: inputStatePalette.backgroundColor,
            borderColor: error
              ? colors.states.danger
              : isFocused
                ? componentTokens.input.focusRing.borderColor
                : inputStatePalette.borderColor,
          },
          isFocused ? componentTokens.input.focusRing.shadow : null,
          inputContainerStyle,
        ]}
      >
        <TextInput
          editable={editable}
          multiline={multiline}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholderTextColor={placeholderTextColor ?? inputStatePalette.placeholderColor}
          selectionColor={colors.accents.bronze}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            {
              color: inputStatePalette.textColor,
              minHeight: multiline
                ? componentTokens.input.minHeightMultiline
                : componentTokens.input.minHeight,
            },
            style,
          ]}
          textAlignVertical={textAlignVertical ?? (multiline ? 'top' : 'center')}
          {...inputProps}
        />
      </View>

      {message || reserveMessageSpace ? (
        <Text
          style={[
            styles.message,
            {
              color: error ? colors.states.danger : colors.text.secondary,
            },
            messageStyle,
          ]}
        >
          {message ?? ' '}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  description: {
    ...typography.bodySm,
  },
  header: {
    gap: componentTokens.input.gap.labelToDescription,
  },
  input: {
    ...typography.body,
    minWidth: 0,
    paddingHorizontal: componentTokens.input.paddingX,
    paddingVertical: componentTokens.input.paddingY,
  },
  inputMultiline: {
    paddingTop: componentTokens.input.paddingY,
  },
  inputShell: {
    borderRadius: componentTokens.input.radius,
    borderWidth: 1,
    marginTop: componentTokens.input.gap.fieldToMessage,
    overflow: 'hidden',
  },
  label: {
    ...typography.label,
  },
  message: {
    ...typography.bodySm,
    marginTop: componentTokens.input.gap.fieldToMessage,
    minHeight: componentTokens.input.messageMinHeight,
  },
});
