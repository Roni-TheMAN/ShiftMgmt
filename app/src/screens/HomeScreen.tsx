import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import NumericKeypad from '../components/NumericKeypad';
import PinDots from '../components/PinDots';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import PageHeader from '../components/ui/PageHeader';
import StatusChip from '../components/ui/StatusChip';
import SurfaceCard from '../components/ui/SurfaceCard';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import {
  APP_NAME,
  AUTO_CLOCK_OUT_SWEEP_INTERVAL_MS,
  EMPLOYEE_PIN_LENGTH,
} from '../constants/app';
import { runAutoClockOutSweep } from '../services/clock/autoClockOutService';
import {
  getClockTransitionError,
  getLatestClockEventTypeForEmployee,
} from '../services/repositories/clockEventRepository';
import { findActiveEmployeeByPin } from '../services/repositories/employeeRepository';
import { getPropertySettings } from '../services/repositories/settingsRepository';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

const ADMIN_HOLD_DURATION_MS = 3000;
const ADMIN_HOLD_TICK_MS = 40;
const CLOCK_ACTIONS = [
  { eventType: 'IN' as const, title: 'Clock In', variant: 'success' as const },
  { eventType: 'OUT' as const, title: 'Clock Out', variant: 'danger' as const },
];

function toChipTone(tone: StatusTone) {
  if (tone === 'success') {
    return 'success' as const;
  }
  if (tone === 'warning') {
    return 'warning' as const;
  }
  if (tone === 'danger') {
    return 'danger' as const;
  }
  return 'neutral' as const;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { horizontalPadding, isCompactWidth, isShortHeight } = useResponsiveLayout();
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [now, setNow] = useState(() => new Date());
  const [pin, setPin] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHoldingAdmin, setIsHoldingAdmin] = useState(false);
  const [adminHoldProgress, setAdminHoldProgress] = useState(0);
  const adminHoldStartedAtRef = useRef<number | null>(null);
  const adminHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canSubmit = useMemo(
    () => pin.length === EMPLOYEE_PIN_LENGTH && !isSubmitting,
    [isSubmitting, pin.length],
  );
  const adminSecondsRemaining = Math.max(
    0,
    Math.ceil(((1 - adminHoldProgress) * ADMIN_HOLD_DURATION_MS) / 1000),
  );
  const digitsRemaining = Math.max(0, EMPLOYEE_PIN_LENGTH - pin.length);
  const timeLineValue = useMemo(
    () =>
      now.toLocaleString([], {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
      }),
    [now],
  );

  const cameraStatus = useMemo(() => {
    if (!cameraPermission) {
      return {
        detail: 'Preparing live camera access.',
        label: 'Checking',
        tone: 'warning' as const,
      };
    }

    if (!cameraPermission.granted) {
      return {
        detail: 'Permission is required for shift photos.',
        label: 'Blocked',
        tone: 'danger' as const,
      };
    }

    if (!isFocused) {
      return {
        detail: 'Preview resumes when this screen is active.',
        label: 'Standby',
        tone: 'neutral' as const,
      };
    }

    return {
      detail: 'Front camera preview is running.',
      label: 'Live',
      tone: 'success' as const,
    };
  }, [cameraPermission, isFocused]);

  const pinStatusValue =
    pin.length === 0 ? 'Awaiting entry' : canSubmit ? 'Ready to submit' : `${pin.length}/4 digits`;
  const nextStepValue = error
    ? 'Re-enter PIN'
    : canSubmit
      ? 'Select action'
      : pin.length === 0
        ? 'Enter PIN'
        : `Add ${digitsRemaining} digit${digitsRemaining === 1 ? '' : 's'}`;
  const propertyNameLabel = propertyName.trim().length > 0 ? propertyName.trim() : 'Property';

  const stopAdminHoldTimer = (resetProgress = true) => {
    if (adminHoldTimerRef.current) {
      clearInterval(adminHoldTimerRef.current);
      adminHoldTimerRef.current = null;
    }
    adminHoldStartedAtRef.current = null;
    setIsHoldingAdmin(false);
    if (resetProgress) {
      setAdminHoldProgress(0);
    }
  };

  const startAdminHoldTimer = () => {
    stopAdminHoldTimer();
    setIsHoldingAdmin(true);
    setAdminHoldProgress(0);
    adminHoldStartedAtRef.current = Date.now();
    adminHoldTimerRef.current = setInterval(() => {
      if (!adminHoldStartedAtRef.current) {
        return;
      }
      const elapsed = Date.now() - adminHoldStartedAtRef.current;
      const progress = Math.min(1, elapsed / ADMIN_HOLD_DURATION_MS);
      setAdminHoldProgress(progress);
      if (progress >= 1) {
        stopAdminHoldTimer(false);
      }
    }, ADMIN_HOLD_TICK_MS);
  };

  useEffect(() => {
    return () => {
      stopAdminHoldTimer();
    };
  }, []);

  useEffect(() => {
    if (!cameraPermission) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    const timerRef = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timerRef);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let intervalRef: ReturnType<typeof setInterval> | null = null;
      let isActive = true;

      const runSweep = async () => {
        try {
          await runAutoClockOutSweep();
        } catch {
          // Ignore sweep errors on kiosk idle screen and keep UI responsive.
        }
      };

      const loadPropertyProfile = async () => {
        try {
          const propertySettings = await getPropertySettings();
          if (!isActive) {
            return;
          }
          setPropertyName(propertySettings.propertyName);
        } catch {
          if (!isActive) {
            return;
          }
          setPropertyName('');
        }
      };

      void loadPropertyProfile();
      void runSweep();
      intervalRef = setInterval(() => {
        void runSweep();
      }, AUTO_CLOCK_OUT_SWEEP_INTERVAL_MS);

      return () => {
        isActive = false;
        if (intervalRef) {
          clearInterval(intervalRef);
        }
      };
    }, []),
  );

  const appendDigit = (digit: string) => {
    setError(null);
    setPin((current) => {
      if (current.length >= EMPLOYEE_PIN_LENGTH) {
        return current;
      }
      return `${current}${digit}`;
    });
  };

  const clearPin = () => {
    setError(null);
    setPin('');
  };

  const backspacePin = () => {
    setError(null);
    setPin((current) => current.slice(0, -1));
  };

  const processClockAction = async (eventType: 'IN' | 'OUT') => {
    if (isSubmitting) {
      return;
    }

    if (pin.length !== EMPLOYEE_PIN_LENGTH) {
      setError('Enter a 4-digit PIN.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const employee = await findActiveEmployeeByPin(pin);
      if (!employee) {
        setError('Invalid PIN.');
        setPin('');
        return;
      }

      const lastEventType = await getLatestClockEventTypeForEmployee(employee.id);
      const transitionError = getClockTransitionError(lastEventType, eventType);
      if (transitionError) {
        setError(`${employee.name}: ${transitionError}`);
        setPin('');
        return;
      }

      setPin('');
      navigation.navigate('CameraCapture', {
        employeeId: employee.id,
        employeeName: employee.name,
        eventType,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to process this clock action.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          badgeLabel={cameraStatus.label}
          badgeTone={toChipTone(cameraStatus.tone)}
          eyebrow="Shift kiosk"
          title={APP_NAME}
        />

        <SurfaceCard padding="lg" style={styles.controlDeck} tone="default">
          <View style={[styles.controlDeckHeader, isCompactWidth ? styles.controlDeckHeaderCompact : null]}>
            <View style={styles.controlDeckHeaderLead}>
              <Text style={styles.controlDeckEyebrow}>One workspace</Text>
              <Pressable
                delayLongPress={ADMIN_HOLD_DURATION_MS}
                onLongPress={() => {
                  setAdminHoldProgress(1);
                  stopAdminHoldTimer(false);
                  Vibration.vibrate(18);
                  setError(null);
                  setPin('');
                  navigation.navigate('AdminAuth');
                }}
                onPressIn={() => {
                  startAdminHoldTimer();
                }}
                onPressOut={() => {
                  if (adminHoldProgress < 1) {
                    stopAdminHoldTimer();
                  }
                }}
                style={({ pressed }) => [styles.timeLineRow, pressed ? styles.timeLineRowPressed : null]}
              >
                <Text numberOfLines={1} style={styles.timeLineText}>
                  {timeLineValue}{' '}
                  <Text style={styles.timeLineHint}>
                    {isHoldingAdmin ? `(${adminSecondsRemaining}s)` : '(Hold for Admin)'}
                  </Text>
                </Text>
              </Pressable>
              <View style={styles.timeLineProgressTrack}>
                <View
                  style={[
                    styles.timeLineProgressFill,
                    {
                      width: `${Math.max(0, Math.min(100, adminHoldProgress * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={[styles.controlDeckPropertyWrap, isCompactWidth ? styles.controlDeckPropertyWrapCompact : null]}>
              <Text style={styles.controlDeckPropertyLabel}>Property</Text>
              <Text numberOfLines={1} style={styles.controlDeckPropertyName}>
                {propertyNameLabel}
              </Text>
            </View>
            <StatusChip label={canSubmit ? 'Ready' : 'Awaiting PIN'} tone={canSubmit ? 'success' : 'neutral'} />
          </View>

          <View
            style={[styles.controlDeckBody, isCompactWidth ? styles.controlDeckBodyCompact : null]}
          >
            <View style={[styles.lowerControlRow, isCompactWidth ? styles.controlRowCompact : null]}>
              <SurfaceCard padding="md" style={styles.keypadPanel} tone="default">
                <View style={styles.keypadHeader}>
                  <View>
                    <Text style={styles.sectionLabel}>Enter PIN</Text>
                    <Text style={styles.sectionSupportText}>{nextStepValue}</Text>
                  </View>
                  <StatusChip label={pinStatusValue} tone={canSubmit ? 'success' : 'neutral'} />
                </View>

                <PinDots length={pin.length} maxLength={EMPLOYEE_PIN_LENGTH} />

                <Text style={[styles.errorText, !error ? styles.errorTextHidden : null]}>
                  {error ?? ' '}
                </Text>

                <View style={styles.keypadWrapper}>
                  <NumericKeypad
                    disabled={isSubmitting}
                    onBackspace={backspacePin}
                    onClear={clearPin}
                    onDigitPress={appendDigit}
                  />
                </View>
              </SurfaceCard>

              <SurfaceCard padding="md" style={styles.actionsColumn} tone="default">
                <Text style={styles.sectionLabel}>Choose Action</Text>

                <View
                  style={[
                    styles.inlineCameraShell,
                    isShortHeight ? styles.inlineCameraShellShort : null,
                  ]}
                >
                  {!cameraPermission ? (
                    <View style={styles.cameraPlaceholder}>
                      <ActivityIndicator color={colors.primary} size="small" />
                      <Text style={styles.cameraPlaceholderText}>Checking camera...</Text>
                    </View>
                  ) : cameraPermission.granted ? (
                    <CameraView
                      active={isFocused}
                      animateShutter={false}
                      facing="front"
                      mirror
                      mode="picture"
                      style={styles.cameraPreview}
                    />
                  ) : (
                    <View style={styles.cameraPlaceholder}>
                      <Text style={styles.cameraPlaceholderTitle}>Camera off</Text>
                      <Text style={styles.cameraPlaceholderText}>Enable camera access.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionButtonGroup}>
                  {CLOCK_ACTIONS.map((action) => (
                    <PrimaryButton
                      disabled={!canSubmit}
                      fullWidth
                      key={action.eventType}
                      onPress={() => void processClockAction(action.eventType)}
                      title={isSubmitting ? 'Processing...' : action.title}
                      variant={action.variant}
                    />
                  ))}
                </View>
              </SurfaceCard>
            </View>
          </View>
        </SurfaceCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionButtonGroup: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    width: '100%',
  },
  actionsColumn: {
    flexShrink: 0,
    justifyContent: 'space-between',
    maxWidth: 340,
    minWidth: 220,
    width: '35%',
  },
  cameraPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cameraPlaceholderText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cameraPlaceholderTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  cameraPreview: {
    flex: 1,
  },
  inlineCameraShell: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    marginTop: spacing.sm,
    minHeight: 96,
    overflow: 'hidden',
    width: '100%',
  },
  inlineCameraShellShort: {
    minHeight: 80,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  controlDeck: {
    minHeight: 0,
  },
  controlDeckBody: {
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 0,
  },
  controlDeckBodyCompact: {},
  controlDeckEyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  controlDeckHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  controlDeckHeaderCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  controlDeckHeaderLead: {
    flexShrink: 1,
  },
  controlDeckPropertyLabel: {
    ...typography.eyebrow,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  controlDeckPropertyName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  controlDeckPropertyWrap: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  controlDeckPropertyWrapCompact: {
    alignItems: 'flex-start',
    width: '100%',
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    minHeight: 22,
    textAlign: 'center',
  },
  errorTextHidden: {
    color: 'transparent',
  },
  timeLineHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  timeLineProgressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: '100%',
  },
  timeLineProgressTrack: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginTop: spacing.xs,
    overflow: 'hidden',
    width: '100%',
  },
  timeLineRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
  },
  timeLineRowPressed: {
    opacity: 0.8,
  },
  timeLineText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  keypadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  keypadPanel: {
    flex: 1,
    minHeight: 0,
  },
  keypadWrapper: {
    marginTop: spacing.sm,
    width: '100%',
  },
  lowerControlRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  panelEyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  panelTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  sectionSupportText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  controlRowCompact: {
    flexDirection: 'column',
  },
});
