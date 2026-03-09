import { Pressable, StyleSheet, Text, View } from 'react-native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { colors, spacing, typography } from '../theme';

type NumericKeypadProps = {
  onDigitPress: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
};

const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLR', '0', 'DEL'],
];

export default function NumericKeypad({
  onDigitPress,
  onClear,
  onBackspace,
  disabled = false,
}: NumericKeypadProps) {
  const { isCompactWidth, isShortHeight } = useResponsiveLayout();
  const useCompactKeys = isCompactWidth || isShortHeight;

  const handlePress = (key: string) => {
    if (disabled) {
      return;
    }

    if (key === 'CLR') {
      onClear();
      return;
    }

    if (key === 'DEL') {
      onBackspace();
      return;
    }

    onDigitPress(key);
  };

  return (
    <View style={styles.container}>
      {keypadRows.map((row) => (
        <View key={row.join('-')} style={styles.row}>
          {row.map((key) => {
            const isUtility = key === 'CLR' || key === 'DEL';
            return (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                key={key}
                onPress={() => handlePress(key)}
                style={({ pressed }) => [
                  styles.key,
                  useCompactKeys ? styles.keyCompact : null,
                  isUtility ? styles.utilityKey : null,
                  pressed ? styles.keyPressed : null,
                  disabled ? styles.keyDisabled : null,
                ]}
              >
                <Text
                  style={[
                    styles.keyText,
                    useCompactKeys ? styles.keyTextCompact : null,
                    isUtility ? styles.utilityKeyText : null,
                  ]}
                >
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    width: '100%',
  },
  key: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 76,
  },
  keyCompact: {
    minHeight: 64,
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyPressed: {
    backgroundColor: colors.surfaceHighlight,
  },
  keyText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  keyTextCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  utilityKey: {
    backgroundColor: colors.surface,
  },
  utilityKeyText: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
