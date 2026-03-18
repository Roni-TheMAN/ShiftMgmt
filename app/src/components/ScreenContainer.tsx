import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, withAlpha } from '../theme';

type ScreenContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenContainer({
  children,
  style,
}: ScreenContainerProps) {
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={styles.topWash} />
        <View style={styles.topRule} />
        <View style={styles.bottomWash} />
      </View>
      <SafeAreaView style={[styles.container, style]}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomWash: {
    backgroundColor: withAlpha(colors.accents.olive, 0.035),
    bottom: 0,
    height: 180,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  root: {
    backgroundColor: colors.backgrounds.canvas,
    flex: 1,
  },
  topRule: {
    backgroundColor: withAlpha(colors.borders.strong, 0.5),
    height: StyleSheet.hairlineWidth,
    left: layout.paddingX.compact,
    opacity: 0.9,
    position: 'absolute',
    right: layout.paddingX.compact,
    top: 0,
  },
  topWash: {
    backgroundColor: withAlpha(colors.accents.bronze, 0.05),
    height: 160,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
