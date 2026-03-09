import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import PageHeader from '../components/ui/PageHeader';
import StatusChip from '../components/ui/StatusChip';
import SurfaceCard from '../components/ui/SurfaceCard';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { saveCapturedPhoto } from '../services/camera/photoStorage';
import { createClockEvent } from '../services/repositories/clockEventRepository';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type CameraCaptureScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CameraCapture'
>;

export default function CameraCaptureScreen({
  navigation,
  route,
}: CameraCaptureScreenProps) {
  const { horizontalPadding, isCompactWidth, isVeryCompactWidth } =
    useResponsiveLayout();
  const { employeeId, employeeName, eventType } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCapturedRef = useRef(false);

  useEffect(() => {
    if (!permission) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
      }
    };
  }, []);

  const goBackHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  const takePhotoAndSave = useCallback(async () => {
    if (hasCapturedRef.current || isProcessing) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    hasCapturedRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const captured = await camera.takePictureAsync({
        quality: 0.7,
        shutterSound: false,
      });

      if (!captured.uri) {
        throw new Error('Camera did not return a saved image path.');
      }

      const photoPath = await saveCapturedPhoto({
        sourceUri: captured.uri,
        employeeId,
        eventType,
      });

      const timestamp = new Date().toISOString();
      await createClockEvent({
        employeeId,
        type: eventType,
        timestamp,
        photoPath,
      });

      navigation.replace('Confirmation', {
        employeeName,
        eventType,
        timestamp,
      });
    } catch (captureError) {
      hasCapturedRef.current = false;
      setIsProcessing(false);
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'Photo capture failed.',
      );
    }
  }, [employeeId, employeeName, eventType, isProcessing, navigation]);

  const scheduleAutoCapture = useCallback(() => {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
    }
    captureTimerRef.current = setTimeout(() => {
      void takePhotoAndSave();
    }, 700);
  }, [takePhotoAndSave]);

  if (!permission) {
    return (
      <ScreenContainer style={styles.centered}>
        <SurfaceCard padding="lg" style={styles.permissionCard} tone="info">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.infoText}>Requesting camera permission...</Text>
        </SurfaceCard>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer style={styles.centered}>
        <SurfaceCard padding="lg" style={styles.permissionCard} tone="danger">
          <Text style={styles.errorTitle}>Camera Access Required</Text>
          <Text style={styles.infoText}>
            This kiosk cannot clock events without a camera photo.
          </Text>
          <View
            style={[
              styles.permissionActions,
              isCompactWidth ? styles.actionsWrap : null,
              isVeryCompactWidth ? styles.actionsStacked : null,
            ]}
          >
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={() => {
                void requestPermission();
              }}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Try Again"
              variant="success"
            />
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={goBackHome}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Cancel"
              variant="neutral"
            />
          </View>
        </SurfaceCard>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <PageHeader
        badgeLabel={eventType === 'IN' ? 'Clock In' : 'Clock Out'}
        badgeTone={eventType === 'IN' ? 'success' : 'warning'}
        onBack={goBackHome}
        subtitle={employeeName}
        title="Identity Capture"
      />

      <SurfaceCard padding="lg" style={styles.cameraCard} tone="default">
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardEyebrow}>Live preview</Text>
            <Text style={styles.cardTitle}>Front camera frame</Text>
          </View>
          <StatusChip
            label={error ? 'Error' : isProcessing ? 'Saving' : isCameraReady ? 'Live' : 'Booting'}
            tone={error ? 'danger' : isProcessing ? 'warning' : isCameraReady ? 'success' : 'neutral'}
          />
        </View>

        <View style={styles.previewShell}>
          <CameraView
            active
            animateShutter={false}
            facing="front"
            mirror
            mode="picture"
            onCameraReady={() => {
              setIsCameraReady(true);
              scheduleAutoCapture();
            }}
            ref={cameraRef}
            style={styles.camera}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.statusText}>
            {error
              ? error
              : isProcessing
                ? 'Saving clock event...'
                : isCameraReady
                  ? 'Capturing photo...'
                  : 'Starting camera...'}
          </Text>

          <View
            style={[
              styles.footerActions,
              isCompactWidth ? styles.actionsWrap : null,
              isVeryCompactWidth ? styles.actionsStacked : null,
            ]}
          >
            {error ? (
              <PrimaryButton
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  setError(null);
                  void takePhotoAndSave();
                }}
                style={
                  isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined
                }
                title="Retry Capture"
                variant="success"
              />
            ) : null}
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={goBackHome}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Cancel"
              variant="neutral"
            />
          </View>
        </View>
      </SurfaceCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionsStacked: {
    flexDirection: 'column',
  },
  actionsWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraCard: {
    flex: 1,
    marginBottom: spacing.xl,
  },
  cardEyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  compactActionButton: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  errorTitle: {
    ...typography.h1,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    width: '100%',
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  permissionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  permissionCard: {
    maxWidth: 520,
    width: '100%',
  },
  previewShell: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    minHeight: 320,
    overflow: 'hidden',
  },
  statusText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
