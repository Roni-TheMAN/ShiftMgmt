import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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

const ADMIN_HOLD_DURATION_MS = 3000;
const ADMIN_HOLD_TICK_MS = 40;

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
  const useHorizontalActions = isCompactWidth && !isVeryCompactWidth;

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
    <ScreenContainer style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={styles.topRow}>
        <Pressable
          delayLongPress={ADMIN_HOLD_DURATION_MS}
          onPressIn={() => {
            startAdminHoldTimer();
          }}
          onLongPress={() => {
            setAdminHoldProgress(1);
            stopAdminHoldTimer(false);
            Vibration.vibrate(18);
            setError(null);
            setPin('');
            navigation.navigate('AdminAuth');
          }}
          onPressOut={() => {
            if (adminHoldProgress < 1) {
              stopAdminHoldTimer();
            }
          }}
          style={styles.logoArea}
        >
          <Text style={styles.logoTitle}>{APP_NAME}</Text>
          <Text style={styles.logoHint}>
            {isHoldingAdmin
              ? `Keep holding... ${adminSecondsRemaining}s`
              : 'Press and hold for Admin'}
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

        <View
          style={[
            styles.cornerCameraWrap,
            isCompactWidth ? styles.cornerCameraWrapCompact : null,
            isShortHeight ? styles.cornerCameraWrapShort : null,
          ]}
        >
          <View style={styles.cornerCameraCard}>
            {!cameraPermission ? (
              <View style={styles.cornerCameraPlaceholder}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : cameraPermission.granted ? (
              <CameraView
                active={isFocused}
                animateShutter={false}
                facing="front"
                mirror
                mode="picture"
                style={styles.cornerCamera}
              />
            ) : (
              <View style={styles.cornerCameraPlaceholder}>
                <Text style={styles.cornerCameraPlaceholderText}>Camera Off</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <AppClock />

      <View style={[styles.mainRow, isCompactWidth ? styles.mainRowCompact : null]}>
        <View style={styles.pinColumn}>
          <Text style={styles.sectionLabel}>Enter PIN</Text>
          <PinDots length={pin.length} maxLength={EMPLOYEE_PIN_LENGTH} />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

        <View
          style={[
            styles.actionsColumn,
            isCompactWidth ? styles.actionsColumnCompact : null,
            useHorizontalActions ? styles.actionsColumnHorizontal : null,
          ]}
        >
          <PrimaryButton
            disabled={!canSubmit}
            fullWidth={!useHorizontalActions}
            onPress={() => void processClockAction('IN')}
            style={useHorizontalActions ? styles.compactActionButton : undefined}
            title={isSubmitting ? 'PROCESSING...' : 'CLOCK IN'}
            variant="success"
          />
          <PrimaryButton
            disabled={!canSubmit}
            fullWidth={!useHorizontalActions}
            onPress={() => void processClockAction('OUT')}
            style={useHorizontalActions ? styles.compactActionButton : undefined}
            title={isSubmitting ? 'PROCESSING...' : 'CLOCK OUT'}
            variant="danger"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionsColumn: {
    gap: spacing.lg,
    justifyContent: 'center',
    width: '34%',
  },
  actionsColumnCompact: {
    width: '100%',
  },
  actionsColumnHorizontal: {
    flexDirection: 'row',
  },
  compactActionButton: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
  },
  cornerCamera: {
    flex: 1,
  },
  cornerCameraCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  cornerCameraPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.white,
    flex: 1,
    justifyContent: 'center',
  },
  cornerCameraPlaceholderText: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  cornerCameraWrap: {
    height: 132,
    marginLeft: spacing.md,
    width: 104,
  },
  cornerCameraWrapCompact: {
    height: 104,
    width: 82,
  },
  cornerCameraWrapShort: {
    height: 92,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    minHeight: 22,
    textAlign: 'center',
  },
  keypadWrapper: {
    maxWidth: 420,
    width: '100%',
  },
  logoArea: {
    alignItems: 'center',
    flex: 1,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
    maxWidth: 240,
    overflow: 'hidden',
    width: '100%',
  },
  keypadWrapperCompact: {
    maxWidth: '100%',
  },
  logoTitle: {
    ...typography.h1,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  mainRow: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'space-between',
  },
  mainRowCompact: {
    flex: 0,
    flexDirection: 'column',
    gap: spacing.lg,
  },
  pinColumn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sectionLabel: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
