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
import { colors, radius, spacing, typography, withAlpha } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type CameraCaptureScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CameraCapture'
>;

export default function CameraCaptureScreen({
  navigation,
  route,
}: CameraCaptureScreenProps) {
  const { horizontalPadding, isCompactWidth, isShortHeight, isVeryCompactWidth } =
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
        photoPath,
        timestamp,
        type: eventType,
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

  const statusLabel = error
    ? 'Error'
    : isProcessing
      ? 'Saving'
      : isCameraReady
        ? 'Live'
        : 'Booting';
  const statusTone = error
    ? 'danger'
    : isProcessing
      ? 'warning'
      : isCameraReady
        ? 'success'
        : 'neutral';
  const statusText = error
    ? error
    : isProcessing
      ? 'Saving clock event and photo...'
      : isCameraReady
        ? 'Hold still. The photo is captured automatically once the frame is ready.'
        : 'Starting the front camera...';

  if (!permission) {
    return (
      <ScreenContainer style={styles.centered}>
        <SurfaceCard padding="lg" style={styles.permissionCard} tone="info">
          <ActivityIndicator color={colors.accents.bronze} size="large" />
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
              variant="primary"
            />
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={goBackHome}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Cancel"
              variant="secondary"
            />
          </View>
        </SurfaceCard>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.screen}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding }]}>
        <PageHeader
          badgeLabel={eventType === 'IN' ? 'Clock In' : 'Clock Out'}
          badgeTone={eventType === 'IN' ? 'success' : 'warning'}
          onBack={goBackHome}
          subtitle={employeeName}
          title="Identity Capture"
        />

        <SurfaceCard padding="lg" style={styles.captureCard} tone="info">
          <View style={[styles.captureRow, isCompactWidth ? styles.captureRowCompact : null]}>
            <View style={styles.previewColumn}>
              <View style={styles.previewHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>Live preview</Text>
                  <Text style={styles.cardTitle}>Employee camera frame</Text>
                </View>
                <StatusChip label={statusLabel} tone={statusTone} />
              </View>

              <View
                style={[
                  styles.previewShell,
                  isShortHeight ? styles.previewShellShort : null,
                ]}
              >
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
            </View>

            <View style={styles.infoColumn}>
              <View style={styles.infoCard}>
                <Text style={styles.infoEyebrow}>Capture step</Text>
                <Text style={styles.infoTitle}>
                  {eventType === 'IN' ? 'Clock-in photo' : 'Clock-out photo'}
                </Text>
                <Text style={styles.infoBody}>
                  The front camera uses a taller portrait frame so the employee face is easier to confirm before the event is saved.
                </Text>

                <View style={styles.metaBlock}>
                  <StatusChip
                    label={eventType === 'IN' ? 'Clock In' : 'Clock Out'}
                    size="sm"
                    tone={eventType === 'IN' ? 'success' : 'warning'}
                  />
                  <Text style={styles.employeeText}>{employeeName}</Text>
                </View>

                <Text style={[styles.statusText, error ? styles.statusError : null]}>
                  {statusText}
                </Text>
              </View>

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
                    variant="primary"
                  />
                ) : null}
                <PrimaryButton
                  fullWidth={isVeryCompactWidth}
                  onPress={goBackHome}
                  style={
                    isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined
                  }
                  title="Cancel"
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        </SurfaceCard>
      </View>
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
  captureCard: {
    width: '100%',
  },
  captureRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.section,
  },
  captureRowCompact: {
    flexDirection: 'column',
  },
  cardEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
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
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 1180,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
    width: '100%',
  },
  errorTitle: {
    ...typography.sectionTitle,
    color: colors.states.danger,
    textAlign: 'center',
  },
  employeeText: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  infoBody: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  infoCard: {
    backgroundColor: withAlpha(colors.backgrounds.card, 0.84),
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  infoColumn: {
    flex: 0.42,
    justifyContent: 'space-between',
    minWidth: 260,
  },
  infoEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  infoTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  metaBlock: {
    borderTopColor: colors.borders.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  permissionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  permissionCard: {
    maxWidth: 560,
    width: '100%',
  },
  previewColumn: {
    flex: 0.58,
    minWidth: 300,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  previewShell: {
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.default,
    borderRadius: radius.heroCard,
    borderWidth: 1,
    maxHeight: 620,
    maxWidth: 520,
    minHeight: 420,
    overflow: 'hidden',
    width: '100%',
  },
  previewShellShort: {
    maxHeight: 520,
    minHeight: 360,
  },
  screen: {
    flex: 1,
  },
  statusError: {
    color: colors.states.danger,
  },
  statusText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    minHeight: 72,
  },
});
