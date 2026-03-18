import { Pressable, StyleSheet, Text, View } from 'react-native';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { colors, radius, spacing, typography, withAlpha } from '../theme';

type NumericKeypadProps = {
  onDigitPress: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
  keyMinHeight?: number;
  compactKeyMinHeight?: number;
  keyGap?: number;
  rowGap?: number;
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
  keyMinHeight = 76,
  compactKeyMinHeight = 64,
  keyGap = spacing.sm,
  rowGap = spacing.sm,
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
    <View style={[styles.container, { gap: rowGap }]}>
      {keypadRows.map((row) => (
        <View key={row.join('-')} style={[styles.row, { gap: keyGap }]}>
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
                  {
                    minHeight: useCompactKeys ? compactKeyMinHeight : keyMinHeight,
                  },
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
    width: '100%',
  },
  key: {
    alignItems: 'center',
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.default,
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    shadowColor: withAlpha(colors.shadows.card, 1),
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  keyCompact: {
    minHeight: 64,
  },
  keyDisabled: {
    opacity: 0.55,
  },
  keyPressed: {
    backgroundColor: colors.tints.bronze,
    borderColor: withAlpha(colors.accents.bronze, 0.35),
  },
  keyText: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  keyTextCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  row: {
    flexDirection: 'row',
  },
  utilityKey: {
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.subtle,
  },
  utilityKeyText: {
    ...typography.bodySm,
    color: colors.text.secondary,
  },
});
