import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

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
        <View style={[styles.orb, styles.orbPrimary]} />
        <View style={[styles.orb, styles.orbInfo]} />
        <View style={[styles.orb, styles.orbDanger]} />
        <View style={styles.gridOverlay} />
      </View>
      <SafeAreaView style={[styles.container, style]}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderColor: 'rgba(255, 255, 255, 0.015)',
    borderWidth: 1,
    opacity: 0.25,
  },
  orb: {
    borderRadius: 999,
    position: 'absolute',
  },
  orbDanger: {
    backgroundColor: colors.glowDanger,
    bottom: -240,
    height: 420,
    left: -160,
    width: 420,
  },
  orbInfo: {
    backgroundColor: colors.glowInfo,
    height: 380,
    right: -120,
    top: 180,
    width: 380,
  },
  orbPrimary: {
    backgroundColor: colors.glowPrimary,
    height: 420,
    left: -90,
    top: -150,
    width: 420,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
});
