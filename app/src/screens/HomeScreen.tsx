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
import AppClock from '../components/AppClock';
import NumericKeypad from '../components/NumericKeypad';
import PinDots from '../components/PinDots';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
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
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

const ADMIN_HOLD_DURATION_MS = 3000;
const ADMIN_HOLD_TICK_MS = 40;
const CLOCK_ACTIONS = [
  { eventType: 'IN' as const, title: 'CLOCK IN', variant: 'success' as const },
  { eventType: 'OUT' as const, title: 'CLOCK OUT', variant: 'danger' as const },
];

function getStatusCardToneStyle(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return styles.statusCardSuccess;
    case 'warning':
      return styles.statusCardWarning;
    case 'danger':
      return styles.statusCardDanger;
    default:
      return null;
  }
}

function getStatusValueToneStyle(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return styles.statusCardValueSuccess;
    case 'warning':
      return styles.statusCardValueWarning;
    case 'danger':
      return styles.statusCardValueDanger;
    default:
      return null;
  }
}

function getStatusBadgeToneStyle(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return styles.statusBadgeSuccess;
    case 'warning':
      return styles.statusBadgeWarning;
    case 'danger':
      return styles.statusBadgeDanger;
    default:
      return styles.statusBadgeNeutral;
  }
}

function getStatusBadgeTextToneStyle(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return styles.statusBadgeTextSuccess;
    case 'warning':
      return styles.statusBadgeTextWarning;
    case 'danger':
      return styles.statusBadgeTextDanger;
    default:
      return styles.statusBadgeTextNeutral;
  }
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { horizontalPadding, isCompactWidth, isShortHeight, isVeryCompactWidth } =
    useResponsiveLayout();
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [pin, setPin] = useState('');
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
  const useHorizontalActions = isCompactWidth && !isVeryCompactWidth;

  const cameraStatus = useMemo(() => {
    if (!cameraPermission) {
      return {
        detail: 'Preparing live camera access',
        label: 'Checking',
        tone: 'warning' as const,
      };
    }

    if (!cameraPermission.granted) {
      return {
        detail: 'Permission is required for shift photos',
        label: 'Blocked',
        tone: 'danger' as const,
      };
    }

    if (!isFocused) {
      return {
        detail: 'Preview resumes when this screen is active',
        label: 'Standby',
        tone: 'neutral' as const,
      };
    }

    return {
      detail: 'Front camera preview is running',
      label: 'Live',
      tone: 'success' as const,
    };
  }, [cameraPermission, isFocused]);

  const heroMessage = useMemo(() => {
    if (error) {
      return error;
    }

    if (canSubmit) {
      return 'PIN accepted. Choose Clock In or Clock Out while facing the camera.';
    }

    if (pin.length > 0) {
      return `Enter ${digitsRemaining} more digit${
        digitsRemaining === 1 ? '' : 's'
      } to continue.`;
    }

    return 'Employees can enter a PIN, confirm identity on camera, and clock in within seconds.';
  }, [canSubmit, digitsRemaining, error, pin.length]);

  const pinStatusValue =
    pin.length === 0 ? 'Awaiting entry' : canSubmit ? 'Ready' : `${pin.length}/4 digits`;
  const pinStatusDetail =
    pin.length === 0
      ? 'A 4-digit employee PIN is required'
      : canSubmit
        ? 'Clock action buttons are enabled'
        : `${digitsRemaining} digit${digitsRemaining === 1 ? '' : 's'} remaining`;
  const nextStepValue = error
    ? 'Re-enter PIN'
    : canSubmit
      ? 'Select action'
      : pin.length === 0
        ? 'Enter PIN'
        : `Add ${digitsRemaining} digit${digitsRemaining === 1 ? '' : 's'}`;
  const nextStepDetail = error
    ? 'Clear the error and try the PIN again'
    : canSubmit
      ? 'Keep your face in frame for the capture'
      : 'Action buttons unlock automatically when the PIN is complete';
  const adminStatusValue = isHoldingAdmin
    ? `${adminSecondsRemaining}s remaining`
    : 'Hold brand card';
  const statusCards = [
    {
      detail: cameraStatus.detail,
      key: 'camera',
      label: 'Camera',
      tone: cameraStatus.tone,
      value: cameraStatus.label,
    },
    {
      detail: pinStatusDetail,
      key: 'pin',
      label: 'PIN',
      tone: canSubmit ? ('success' as const) : ('neutral' as const),
      value: pinStatusValue,
    },
    {
      detail: nextStepDetail,
      key: 'next-step',
      label: 'Next Step',
      tone: error
        ? ('danger' as const)
        : canSubmit
          ? ('warning' as const)
          : ('neutral' as const),
      value: nextStepValue,
    },
    {
      detail: 'Press and hold the brand card to open admin access',
      key: 'admin',
      label: 'Admin',
      tone: isHoldingAdmin ? ('warning' as const) : ('neutral' as const),
      value: adminStatusValue,
    },
  ];

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

  useFocusEffect(
    useCallback(() => {
      let intervalRef: ReturnType<typeof setInterval> | null = null;

      const runSweep = async () => {
        try {
          await runAutoClockOutSweep();
        } catch {
          // Ignore sweep errors on kiosk idle screen and keep UI responsive.
        }
      };

      void runSweep();
      intervalRef = setInterval(() => {
        void runSweep();
      }, AUTO_CLOCK_OUT_SWEEP_INTERVAL_MS);

      return () => {
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
        <View style={[styles.heroRow, isCompactWidth ? styles.heroRowCompact : null]}>
          <View style={styles.heroColumn}>
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
              style={({ pressed }) => [
                styles.brandCard,
                isCompactWidth ? styles.brandCardCompact : null,
                pressed ? styles.brandCardPressed : null,
              ]}
            >
              <View style={styles.brandCardHeader}>
                <Text style={styles.brandEyebrow}>Shift kiosk</Text>
                <View
                  style={[
                    styles.statusBadge,
                    getStatusBadgeToneStyle(cameraStatus.tone),
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      getStatusBadgeTextToneStyle(cameraStatus.tone),
                    ]}
                  >
                    {cameraStatus.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.logoTitle}>{APP_NAME}</Text>
              <Text style={styles.heroMessage}>{heroMessage}</Text>
              <Text style={styles.logoHint}>
                {isHoldingAdmin
                  ? `Keep holding... ${adminSecondsRemaining}s`
                  : 'Press and hold the brand card for Admin access'}
              </Text>
              <View style={styles.holdProgressTrack}>
                <View
                  style={[
                    styles.holdProgressFill,
                    isCompactWidth ? styles.holdProgressFillCompact : null,
                    {
                      width: `${Math.max(0, Math.min(100, adminHoldProgress * 100))}%`,
                    },
                  ]}
                />
              </View>
            </Pressable>

            <View style={styles.clockPanel}>
              <AppClock />
            </View>

            <View style={[styles.statusGrid, isCompactWidth ? styles.statusGridCompact : null]}>
              {statusCards.map((card) => (
                <View
                  key={card.key}
                  style={[
                    styles.statusCard,
                    isCompactWidth ? styles.statusCardCompact : null,
                    getStatusCardToneStyle(card.tone),
                  ]}
                >
                  <Text style={styles.statusCardLabel}>{card.label}</Text>
                  <Text
                    style={[
                      styles.statusCardValue,
                      getStatusValueToneStyle(card.tone),
                    ]}
                  >
                    {card.value}
                  </Text>
                  <Text style={styles.statusCardDetail}>{card.detail}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.cameraPanel, isCompactWidth ? styles.cameraPanelCompact : null]}>
            <View style={styles.cameraPanelHeader}>
              <View style={styles.cameraHeaderTextWrap}>
                <Text style={styles.cameraPanelEyebrow}>Live Preview</Text>
                <Text style={styles.cameraPanelTitle}>Front Camera Feed</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  getStatusBadgeToneStyle(cameraStatus.tone),
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    getStatusBadgeTextToneStyle(cameraStatus.tone),
                  ]}
                >
                  {cameraStatus.label}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.cameraPreviewShell,
                isCompactWidth ? styles.cameraPreviewShellCompact : null,
                isShortHeight ? styles.cameraPreviewShellShort : null,
              ]}
            >
              {!cameraPermission ? (
                <View style={styles.cameraPlaceholder}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.cameraPlaceholderText}>
                    Checking camera access...
                  </Text>
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
                  <Text style={styles.cameraPlaceholderTitle}>Camera Off</Text>
                  <Text style={styles.cameraPlaceholderText}>
                    Grant camera access to capture shift photos.
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.cameraPanelHint}>
              Stand in frame before you choose Clock In or Clock Out.
            </Text>
          </View>
        </View>

        <View style={[styles.mainRow, isCompactWidth ? styles.mainRowCompact : null]}>
          <View style={styles.pinColumn}>
            <Text style={styles.sectionLabel}>Enter PIN</Text>
            <Text style={styles.sectionSupportText}>{nextStepValue}</Text>
            <PinDots length={pin.length} maxLength={EMPLOYEE_PIN_LENGTH} />

            <Text style={[styles.errorText, !error ? styles.errorTextHidden : null]}>
              {error ?? ' '}
            </Text>

            <View
              style={[styles.keypadWrapper, isCompactWidth ? styles.keypadWrapperCompact : null]}
            >
              <NumericKeypad
                disabled={isSubmitting}
                onBackspace={backspacePin}
                onClear={clearPin}
                onDigitPress={appendDigit}
              />
            </View>
          </View>

          <View style={[styles.actionsColumn, isCompactWidth ? styles.actionsColumnCompact : null]}>
            <View style={styles.actionsHeader}>
              <Text style={styles.sectionLabel}>Choose Action</Text>
              <Text style={styles.sectionSupportText}>
                {canSubmit
                  ? 'Buttons are enabled. Keep your face in view for capture.'
                  : 'Finish the 4-digit PIN to unlock clock actions.'}
              </Text>
            </View>

            <View
              style={[
                styles.actionButtonGroup,
                useHorizontalActions ? styles.actionButtonGroupHorizontal : null,
              ]}
            >
              {CLOCK_ACTIONS.map((action) => (
                <PrimaryButton
                  disabled={!canSubmit}
                  fullWidth={!useHorizontalActions}
                  key={action.eventType}
                  onPress={() => void processClockAction(action.eventType)}
                  style={useHorizontalActions ? styles.compactActionButton : undefined}
                  title={isSubmitting ? 'PROCESSING...' : action.title}
                  variant={action.variant}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionButtonGroup: {
    gap: spacing.lg,
    width: '100%',
  },
  actionButtonGroupHorizontal: {
    flexDirection: 'row',
  },
  actionsColumn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.lg,
    width: '34%',
  },
  actionsColumnCompact: {
    width: '100%',
  },
  actionsHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.lg,
  },
  brandCardCompact: {
    padding: spacing.md,
  },
  brandCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brandCardPressed: {
    backgroundColor: '#DCE0DE',
  },
  brandEyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cameraHeaderTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cameraPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexShrink: 1,
    maxWidth: 440,
    minWidth: 300,
    padding: spacing.lg,
    width: '38%',
  },
  cameraPanelCompact: {
    maxWidth: '100%',
    minWidth: 0,
    width: '100%',
  },
  cameraPanelEyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cameraPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cameraPanelHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  cameraPanelTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  cameraPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.white,
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
    textTransform: 'uppercase',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraPreviewShell: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 360,
    overflow: 'hidden',
    width: '100%',
  },
  cameraPreviewShellCompact: {
    minHeight: 280,
  },
  cameraPreviewShellShort: {
    minHeight: 250,
  },
  clockPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  compactActionButton: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
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
  heroColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  heroMessage: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  heroRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  heroRowCompact: {
    flexDirection: 'column',
  },
  holdProgressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: '100%',
  },
  holdProgressFillCompact: {
    minWidth: 2,
  },
  holdProgressTrack: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 8,
    marginTop: spacing.sm,
    overflow: 'hidden',
    width: '100%',
  },
  keypadWrapper: {
    maxWidth: 420,
    width: '100%',
  },
  keypadWrapperCompact: {
    maxWidth: '100%',
  },
  logoHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  logoTitle: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  mainRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  mainRowCompact: {
    flexDirection: 'column',
  },
  pinColumn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sectionLabel: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sectionSupportText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    textAlign: 'center',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusBadgeDanger: {
    backgroundColor: '#F8EAEA',
    borderColor: colors.danger,
  },
  statusBadgeNeutral: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  statusBadgeSuccess: {
    backgroundColor: '#EDF4EF',
    borderColor: colors.success,
  },
  statusBadgeText: {
    ...typography.caption,
    textTransform: 'uppercase',
  },
  statusBadgeTextDanger: {
    color: colors.danger,
  },
  statusBadgeTextNeutral: {
    color: colors.textSecondary,
  },
  statusBadgeTextSuccess: {
    color: colors.success,
  },
  statusBadgeTextWarning: {
    color: colors.warning,
  },
  statusBadgeWarning: {
    backgroundColor: '#FBF4E8',
    borderColor: colors.warning,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    minHeight: 120,
    padding: spacing.md,
  },
  statusCardCompact: {
    flexBasis: '100%',
  },
  statusCardDanger: {
    backgroundColor: '#F8EAEA',
    borderColor: colors.danger,
  },
  statusCardDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  statusCardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusCardSuccess: {
    backgroundColor: '#EDF4EF',
    borderColor: colors.success,
  },
  statusCardValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statusCardValueDanger: {
    color: colors.danger,
  },
  statusCardValueSuccess: {
    color: colors.success,
  },
  statusCardValueWarning: {
    color: colors.warning,
  },
  statusCardWarning: {
    backgroundColor: '#FBF4E8',
    borderColor: colors.warning,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statusGridCompact: {
    flexDirection: 'column',
  },
});
