import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';

type TextFieldProps = TextInputProps & {
  label: string;
  description?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function TextField({
  containerStyle,
  description,
  error,
  label,
  placeholderTextColor,
  style,
  ...inputProps
}: TextFieldProps) {
  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <TextInput
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.input, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
});
