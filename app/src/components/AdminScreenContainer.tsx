import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAdminSession } from '../context/AdminSessionContext';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { layout, spacing } from '../theme';
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
    <ScreenContainer style={styles.outer}>
      <View
        onTouchStart={markActivity}
        style={[
          styles.inner,
          {
            paddingHorizontal: horizontalPadding,
          },
          style,
        ]}
      >
        {children}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: layout.maxWidth.admin,
    paddingTop: spacing.compact,
    paddingBottom: spacing.xl,
    width: '100%',
  },
  outer: {
    flex: 1,
  },
});
