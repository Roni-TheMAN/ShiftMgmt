import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ensurePhotoDirectory } from './src/services/camera/photoStorage';
import { getDatabase } from './src/services/db/database';
import { ensureDefaultAdminPin } from './src/services/repositories/settingsRepository';
import { colors } from './src/theme';

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
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Initialization Failed</Text>
        <Text style={styles.errorText}>{startupError}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing kiosk...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
    paddingHorizontal: 24,
  },
  errorText: {
    color: colors.textSecondary,
    fontFamily: 'AvenirNext-Regular',
    fontSize: 16,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.danger,
    fontFamily: 'AvenirNext-DemiBold',
    fontSize: 28,
    marginBottom: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: 'AvenirNext-Medium',
    fontSize: 18,
    marginTop: 14,
  },
});
