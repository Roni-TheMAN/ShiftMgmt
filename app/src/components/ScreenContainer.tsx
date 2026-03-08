import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

type ScreenContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenContainer({
  children,
  style,
}: ScreenContainerProps) {
  return <SafeAreaView style={[styles.container, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
