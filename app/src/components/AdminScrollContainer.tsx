import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminSession } from '../context/AdminSessionContext';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { spacing } from '../theme';
import ScreenContainer from './ScreenContainer';

type AdminScrollContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export default function AdminScrollContainer({
  children,
  style,
}: AdminScrollContainerProps) {
  const { horizontalPadding, isShortHeight } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer style={styles.outer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={styles.outer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onTouchStart={markActivity}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.inner,
              {
                paddingBottom:
                  insets.bottom + spacing.xl + (isShortHeight ? spacing.lg : spacing.md),
                paddingHorizontal: horizontalPadding,
              },
              style,
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignSelf: 'center',
    maxWidth: 1200,
    paddingTop: spacing.lg,
    width: '100%',
  },
  outer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
