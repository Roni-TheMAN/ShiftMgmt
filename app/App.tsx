import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import SurfaceCard from './src/components/ui/SurfaceCard';
import { ensurePhotoDirectory } from './src/services/camera/photoStorage';
import { getDatabase } from './src/services/db/database';
import { ensureDefaultAdminPin } from './src/services/repositories/settingsRepository';
import { colors, spacing, typography } from './src/theme';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        await getDatabase();
        await ensureDefaultAdminPin();
        await ensurePhotoDirectory();
        if (isMounted) {
          setIsReady(true);
        }
      } catch (error) {
        if (isMounted) {
          setStartupError(
            error instanceof Error
              ? error.message
              : 'Failed to initialize local app data.',
          );
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  if (startupError) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <SurfaceCard padding="lg" style={styles.startupCard} tone="danger">
          <Text style={styles.errorTitle}>Initialization Failed</Text>
          <Text style={styles.errorText}>{startupError}</Text>
        </SurfaceCard>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <SurfaceCard padding="lg" style={styles.startupCard} tone="accent">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Preparing kiosk...</Text>
        </SurfaceCard>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.h1,
    color: colors.danger,
    textAlign: 'center',
  },
  loadingText: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  startupCard: {
    maxWidth: 420,
    width: '100%',
  },
});
