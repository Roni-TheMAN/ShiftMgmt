import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAdminSession } from '../context/AdminSessionContext';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { spacing } from '../theme';
import ScreenContainer from './ScreenContainer';

type AdminScreenContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export default function AdminScreenContainer({
  children,
  style,
}: AdminScreenContainerProps) {
  const { horizontalPadding } = useResponsiveLayout();
  const { markActivity } = useAdminSession();

  return (
    <ScreenContainer style={[styles.outer, style]}>
      <View
        onTouchStart={markActivity}
        style={[styles.inner, { paddingHorizontal: horizontalPadding }]}
      >
        {children}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    maxWidth: 1360,
    paddingVertical: spacing.lg,
    width: '100%',
    alignSelf: 'center',
  },
  outer: {
    flex: 1,
  },
});
