import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import StatusChip from '../components/ui/StatusChip';
import {
  APP_NAME,
  AUTO_CLOCK_OUT_SWEEP_INTERVAL_MS,
  EMPLOYEE_PIN_LENGTH,
} from '../constants/app';
import useResponsiveLayout from '../hooks/useResponsiveLayout';
import { runAutoClockOutSweep } from '../services/clock/autoClockOutService';
import {
  getClockTransitionError,
  getLatestClockEventTypeForEmployee,
} from '../services/repositories/clockEventRepository';
import { findActiveEmployeeByPin } from '../services/repositories/employeeRepository';
import { getPropertySettings } from '../services/repositories/settingsRepository';
import {
  colors,
  componentTokens,
  layout,
  radius,
  shadows,
  typography,
  withAlpha,
} from '../theme';
import type { RootStackParamList } from '../types/navigation';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';
type PropertyProfile = {
  propertyAddress: string;
  propertyDetails: string;
  propertyName: string;
};
type HomeSwipePage = {
  id: string;
  title: string;
};

const ADMIN_HOLD_DURATION_MS = 3000;
const ADMIN_HOLD_TICK_MS = 40;
const KIOSK_HEADER_HEIGHT = 92;
const KIOSK_FOOTER_HEIGHT = 52;
const PANEL_GAP = 24;
const CARD_PADDING = 20;
const SECTION_GAP = 16;
const CLOCK_ACTIONS = [
  { eventType: 'IN' as const, title: 'Clock In', variant: 'success' as const },
  { eventType: 'OUT' as const, title: 'Clock Out', variant: 'secondary' as const },
];
const HOME_SWIPE_PAGES: HomeSwipePage[] = [
  { id: 'schedule', title: 'Schedule' },
  { id: 'clocked-in', title: 'Who Is Clocked In' },
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
  const { horizontalPadding, isCompactWidth, isShortHeight, isVeryCompactWidth } =
    useResponsiveLayout();
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [now, setNow] = useState(() => new Date());
  const [pin, setPin] = useState('');
  const [propertyProfile, setPropertyProfile] = useState<PropertyProfile>({
    propertyAddress: '',
    propertyDetails: '',
    propertyName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHoldingAdmin, setIsHoldingAdmin] = useState(false);
  const [adminHoldProgress, setAdminHoldProgress] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pageViewportWidth, setPageViewportWidth] = useState(0);
  const adminHoldStartedAtRef = useRef<number | null>(null);
  const adminHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pagerScrollRef = useRef<ScrollView | null>(null);

  const canSubmit = useMemo(
    () => pin.length === EMPLOYEE_PIN_LENGTH && !isSubmitting,
    [isSubmitting, pin.length],
  );
  const digitsRemaining = Math.max(0, EMPLOYEE_PIN_LENGTH - pin.length);
  const adminSecondsRemaining = Math.max(
    0,
    Math.ceil(((1 - adminHoldProgress) * ADMIN_HOLD_DURATION_MS) / 1000),
  );
  const headerTime = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [now],
  );
  const headerDate = useMemo(
    () =>
      now.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      }),
    [now],
  );
  const heroTime = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [now],
  );
  const heroDate = useMemo(
    () =>
      now.toLocaleDateString([], {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
        year: 'numeric',
      }),
    [now],
  );
  const analogClockSize = useMemo(() => {
    if (isShortHeight || isVeryCompactWidth) {
      return 156;
    }
    if (isCompactWidth) {
      return 170;
    }
    return 180;
  }, [isCompactWidth, isShortHeight, isVeryCompactWidth]);
  const cameraPreviewHeight = useMemo(() => {
    if (isShortHeight || isVeryCompactWidth) {
      return 220;
    }
    if (isCompactWidth) {
      return 232;
    }
    return 248;
  }, [isCompactWidth, isShortHeight, isVeryCompactWidth]);
  const keypadButtonHeight = useMemo(() => {
    if (isShortHeight || isVeryCompactWidth) {
      return 80;
    }
    if (isCompactWidth) {
      return 82;
    }
    return 84;
  }, [isCompactWidth, isShortHeight, isVeryCompactWidth]);
  const actionButtonMinHeight = useMemo(() => (isShortHeight ? 64 : 70), [isShortHeight]);
  const isPrimaryHomePage = activePageIndex === 0;

  const cameraStatus = useMemo(() => {
    if (!cameraPermission) {
      return {
        detail: 'Checking camera access...',
        label: 'Checking',
        tone: 'warning' as const,
      };
    }

    if (!cameraPermission.granted) {
      return {
        detail: 'Enable camera access to capture shift photos.',
        label: 'Blocked',
        tone: 'danger' as const,
      };
    }

    if (!isFocused || !isPrimaryHomePage) {
      return {
        detail: 'Preview resumes when the main home page is active.',
        label: 'Standby',
        tone: 'neutral' as const,
      };
    }

    return {
      detail: 'Front camera preview is running.',
      label: 'Live',
      tone: 'success' as const,
    };
  }, [cameraPermission, isFocused, isPrimaryHomePage]);

  const pinStatusValue =
    pin.length === 0 ? 'Awaiting PIN' : canSubmit ? 'Ready' : `${pin.length}/4 Entered`;
  const pinStatusTone: StatusTone = error
    ? 'danger'
    : canSubmit
      ? 'success'
      : pin.length > 0
        ? 'warning'
        : 'neutral';
  const propertyNameLabel =
    propertyProfile.propertyName.trim().length > 0
      ? propertyProfile.propertyName.trim()
      : 'Property';
  const propertyMetaLabel = [propertyProfile.propertyAddress, propertyProfile.propertyDetails]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' • ');
  const pinSupportText = error
    ? error
    : pin.length === 0
      ? ' '
      : canSubmit
        ? 'PIN complete. Clock In or Clock Out.'
        : `Enter ${digitsRemaining} more digit${digitsRemaining === 1 ? '' : 's'}.`;
  const cameraSupportText = cameraStatus.tone === 'success' ? null : cameraStatus.detail;
  const actionSupportText = canSubmit
    ? 'Choose the correct clock action for this employee.'
    : 'Finish the PIN to unlock clock actions.';
  const adminAccessMessage = isHoldingAdmin
    ? `Keep holding to open Admin Access in ${adminSecondsRemaining}s.`
    : 'Press and hold to open Admin Access.';

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
          setPropertyProfile(propertySettings);
        } catch {
          if (!isActive) {
            return;
          }
          setPropertyProfile({
            propertyAddress: '',
            propertyDetails: '',
            propertyName: '',
          });
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

  const handlePagerLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const nextWidth = Math.round(nativeEvent.layout.width);
      if (nextWidth <= 0 || nextWidth === pageViewportWidth) {
        return;
      }

      setPageViewportWidth(nextWidth);
      requestAnimationFrame(() => {
        pagerScrollRef.current?.scrollTo({
          animated: false,
          x: nextWidth * activePageIndex,
        });
      });
    },
    [activePageIndex, pageViewportWidth],
  );

  const handlePagerMomentumEnd = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageViewportWidth <= 0) {
        return;
      }

      const nextPageIndex = Math.round(nativeEvent.contentOffset.x / pageViewportWidth);
      setActivePageIndex(Math.max(0, Math.min(HOME_SWIPE_PAGES.length, nextPageIndex)));
    },
    [pageViewportWidth],
  );

  const renderPlaceholderPage = useCallback(
    (page: HomeSwipePage) => (
      <View
        key={page.id}
        style={[
          styles.swipePage,
          pageViewportWidth > 0 ? { width: pageViewportWidth } : styles.swipePageFallback,
        ]}
      >
        <View style={styles.placeholderPageCard}>
          <Text
            style={[
              styles.placeholderPageTitle,
              isCompactWidth || isVeryCompactWidth ? styles.placeholderPageTitleCompact : null,
            ]}
          >
            {page.title}
          </Text>

          <View style={styles.placeholderGrid}>
            <View style={[styles.placeholderTile, styles.placeholderTileWide]} />
            <View style={styles.placeholderTile} />
            <View style={styles.placeholderTile} />
            <View style={styles.placeholderTile} />
          </View>
        </View>
      </View>
    ),
    [isCompactWidth, isVeryCompactWidth, pageViewportWidth],
  );

  return (
    <ScreenContainer style={styles.container}>
      <View style={[styles.screen, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.content}>
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerEyebrow}>Shift kiosk</Text>
              <Text numberOfLines={1} style={styles.headerProperty}>
                {propertyNameLabel}
              </Text>
              {propertyMetaLabel ? (
                <Text numberOfLines={1} style={styles.headerPropertyMeta}>
                  {propertyMetaLabel}
                </Text>
              ) : null}
            </View>

            <View style={styles.headerCenter}>
              <Text style={styles.headerAppName}>{APP_NAME}</Text>
            </View>

            <View style={styles.headerRight}>
              <StatusChip label={cameraStatus.label} size="sm" tone={toChipTone(cameraStatus.tone)} />
              <View style={styles.headerTimeBlock}>
                <Text style={styles.headerTime}>{headerTime}</Text>
                <Text style={styles.headerDate}>{headerDate}</Text>
              </View>
            </View>
          </View>

          <View style={styles.pagerShell}>
            <View onLayout={handlePagerLayout} style={styles.pagerViewport}>
              <ScrollView
                alwaysBounceHorizontal={false}
                bounces={false}
                contentContainerStyle={styles.pagerTrack}
                decelerationRate="fast"
                horizontal
                onMomentumScrollEnd={handlePagerMomentumEnd}
                pagingEnabled
                ref={pagerScrollRef}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.swipePage,
                    pageViewportWidth > 0 ? { width: pageViewportWidth } : styles.swipePageFallback,
                  ]}
                >
                  <View style={styles.mainRow}>
                    <View style={[styles.panelColumn, styles.pinColumn]}>
                      <View style={[styles.panelCard, styles.pinPanel]}>
                        <View style={styles.panelHeader}>
                          <View style={styles.panelHeading}>
                            <Text style={styles.panelEyebrow}>Clock entry</Text>
                            <Text style={styles.panelTitle}>PIN entry</Text>
                          </View>
                          <StatusChip
                            label={pinStatusValue}
                            size="sm"
                            tone={toChipTone(pinStatusTone)}
                          />
                        </View>

                        <View style={styles.pinStage}>
                          <PinDots length={pin.length} maxLength={EMPLOYEE_PIN_LENGTH} />
                        </View>

                        <Text
                          style={[
                            styles.supportText,
                            error ? styles.supportTextError : styles.supportTextMuted,
                          ]}
                        >
                          {pinSupportText}
                        </Text>

                        <View style={styles.keypadWrapper}>
                          <NumericKeypad
                            compactKeyMinHeight={80}
                            disabled={isSubmitting}
                            keyGap={12}
                            keyMinHeight={keypadButtonHeight}
                            onBackspace={backspacePin}
                            onClear={clearPin}
                            onDigitPress={appendDigit}
                            rowGap={12}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={[styles.panelColumn, styles.clockColumn]}>
                      <View style={[styles.panelCard, styles.clockPanel]}>
                        <View style={styles.panelHeader}>
                          <View style={styles.panelHeading}>
                            <Text style={styles.panelEyebrow}>Current time</Text>
                            <Text style={styles.panelTitle}>Shift clock</Text>
                          </View>
                        </View>

                        <View style={styles.clockBody}>
                          <Text
                            adjustsFontSizeToFit
                            minimumFontScale={0.76}
                            numberOfLines={1}
                            style={[
                              styles.clockTime,
                              isShortHeight ? styles.clockTimeCompact : null,
                              isVeryCompactWidth ? styles.clockTimeVeryCompact : null,
                            ]}
                          >
                            {heroTime}
                          </Text>
                          <Text style={styles.clockDate}>{heroDate}</Text>

                          <View style={styles.analogClockWrap}>
                            <AppClock date={now} size={analogClockSize} />
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.panelColumn, styles.cameraColumn]}>
                      <View style={[styles.panelCard, styles.cameraPanel]}>
                        <View style={styles.panelHeader}>
                          <View style={styles.panelHeading}>
                            <Text style={styles.panelEyebrow}>Identity check</Text>
                            <Text style={styles.panelTitle}>Camera verification</Text>
                          </View>
                          <StatusChip
                            label={cameraStatus.label}
                            size="sm"
                            tone={toChipTone(cameraStatus.tone)}
                          />
                        </View>

                        <View style={[styles.cameraShell, { height: cameraPreviewHeight }]}>
                          {!cameraPermission ? (
                            <View style={styles.cameraPlaceholder}>
                              <ActivityIndicator color={colors.accents.bronze} size="small" />
                              <Text style={styles.cameraPlaceholderText}>
                                Checking camera access...
                              </Text>
                            </View>
                          ) : cameraPermission.granted ? (
                            <CameraView
                              active={isFocused && isPrimaryHomePage}
                              animateShutter={false}
                              facing="front"
                              mirror
                              mode="picture"
                              style={styles.cameraPreview}
                            />
                          ) : (
                            <View style={styles.cameraPlaceholder}>
                              <Text style={styles.cameraPlaceholderTitle}>Camera unavailable</Text>
                              <Text style={styles.cameraPlaceholderText}>
                                Enable camera access to capture shift photos.
                              </Text>
                            </View>
                          )}
                        </View>

                        {cameraSupportText ? (
                          <Text style={[styles.supportText, styles.supportTextMuted]}>
                            {cameraSupportText}
                          </Text>
                        ) : null}

                        <Text style={styles.actionHelperText}>{actionSupportText}</Text>

                        <View style={styles.actionButtonGroup}>
                          {CLOCK_ACTIONS.map((action) => (
                            <PrimaryButton
                              disabled={!canSubmit}
                              fullWidth
                              key={action.eventType}
                              onPress={() => void processClockAction(action.eventType)}
                              size="lg"
                              style={[styles.actionButton, { minHeight: actionButtonMinHeight }]}
                              title={isSubmitting ? 'Processing...' : action.title}
                              variant={action.variant}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {HOME_SWIPE_PAGES.map(renderPlaceholderPage)}
              </ScrollView>

              <View pointerEvents="none" style={styles.pagerArrowRail}>
                <Text
                  style={[
                    styles.pagerArrow,
                    styles.pagerArrowLeft,
                    activePageIndex === 0 ? styles.pagerArrowHidden : null,
                  ]}
                >
                  {'<'}
                </Text>
                <Text
                  style={[
                    styles.pagerArrow,
                    styles.pagerArrowRight,
                    activePageIndex === HOME_SWIPE_PAGES.length
                      ? styles.pagerArrowHidden
                      : null,
                  ]}
                >
                  {'>'}
                </Text>
              </View>
            </View>
          </View>

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
            style={({ pressed }) => [styles.adminFooter, pressed ? styles.adminFooterPressed : null]}
          >
            <View style={styles.adminFooterContent}>
              <View style={styles.adminFooterTextGroup}>
                <Text style={styles.adminFooterLabel}>Admin access</Text>
                <Text numberOfLines={1} style={styles.adminFooterMessage}>
                  {adminAccessMessage}
                </Text>
              </View>
              <StatusChip
                label={isHoldingAdmin ? `${adminSecondsRemaining}s` : 'Hold 3s'}
                size="sm"
                tone="info"
              />
            </View>

            <View style={styles.adminProgressTrack}>
              <View
                style={[
                  styles.adminProgressFill,
                  {
                    width: `${Math.max(0, Math.min(100, adminHoldProgress * 100))}%`,
                  },
                ]}
              />
            </View>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    width: '100%',
  },
  actionButtonGroup: {
    gap: 12,
    width: '100%',
  },
  actionHelperText: {
    ...typography.bodySm,
    color: colors.text.secondary,
    minHeight: componentTokens.input.messageMinHeight,
    textAlign: 'center',
  },
  adminFooter: {
    ...shadows.card,
    backgroundColor: withAlpha(colors.backgrounds.card, 0.94),
    borderColor: withAlpha(colors.accents.bronze, 0.24),
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: KIOSK_FOOTER_HEIGHT,
    paddingBottom: 8,
    paddingHorizontal: CARD_PADDING,
    paddingTop: 10,
  },
  adminFooterContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SECTION_GAP,
    justifyContent: 'space-between',
  },
  adminFooterLabel: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  adminFooterMessage: {
    ...typography.bodySm,
    color: colors.text.primary,
    flex: 1,
  },
  adminFooterPressed: {
    opacity: 0.94,
  },
  adminFooterTextGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  adminProgressFill: {
    backgroundColor: colors.accents.bronze,
    borderRadius: radius.pill,
    height: '100%',
  },
  adminProgressTrack: {
    backgroundColor: withAlpha(colors.accents.bronze, 0.16),
    borderRadius: radius.pill,
    height: 4,
    marginTop: 8,
    overflow: 'hidden',
    width: '100%',
  },
  analogClockWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cameraColumn: {
    flex: 35,
  },
  cameraPanel: {
    backgroundColor: colors.backgrounds.secondary,
    borderColor: withAlpha(colors.accents.bronze, 0.18),
  },
  cameraPlaceholder: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: CARD_PADDING,
  },
  cameraPlaceholderText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  cameraPlaceholderTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    textAlign: 'center',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraShell: {
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  clockBody: {
    alignItems: 'center',
    flex: 1,
    gap: SECTION_GAP,
    justifyContent: 'center',
    width: '100%',
  },
  clockColumn: {
    flex: 9,
  },
  clockDate: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  clockPanel: {
    borderColor: withAlpha(colors.accents.bronze, 0.26),
  },
  clockTime: {
    ...typography.display,
    color: colors.text.primary,
    fontSize: 46,
    lineHeight: 50,
    textAlign: 'center',
  },
  clockTimeCompact: {
    fontSize: 42,
    lineHeight: 46,
  },
  clockTimeVeryCompact: {
    fontSize: 38,
    lineHeight: 42,
  },
  container: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    gap: SECTION_GAP,
    maxWidth: layout.maxWidth.kiosk,
    width: '100%',
  },
  headerAppName: {
    ...typography.label,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  headerBar: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: withAlpha(colors.backgrounds.card, 0.94),
    borderColor: colors.borders.subtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: KIOSK_HEADER_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SECTION_GAP,
  },
  headerDate: {
    ...typography.bodySm,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  headerEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  headerProperty: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginTop: 2,
  },
  headerPropertyMeta: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: SECTION_GAP,
    justifyContent: 'flex-end',
  },
  headerTime: {
    ...typography.cardTitle,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  headerTimeBlock: {
    alignItems: 'flex-end',
  },
  keypadWrapper: {
    width: '100%',
  },
  mainRow: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    gap: PANEL_GAP,
    minHeight: 0,
  },
  pagerArrow: {
    ...typography.label,
    color: withAlpha(colors.text.secondary, 0.55),
    fontSize: 14,
    lineHeight: 14,
    paddingHorizontal: 4,
    position: 'absolute',
    top: '50%',
  },
  pagerArrowHidden: {
    opacity: 0,
  },
  pagerArrowLeft: {
    left: 6,
    marginTop: -7,
  },
  pagerArrowRail: {
    ...StyleSheet.absoluteFillObject,
  },
  pagerArrowRight: {
    marginTop: -7,
    right: 6,
  },
  pagerShell: {
    flex: 1,
    minHeight: 0,
  },
  pagerTrack: {
    alignItems: 'stretch',
  },
  pagerViewport: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  panelCard: {
    ...shadows.card,
    backgroundColor: colors.backgrounds.card,
    borderColor: colors.borders.default,
    borderRadius: radius.heroCard,
    borderWidth: 1,
    flex: 1,
    gap: SECTION_GAP,
    justifyContent: 'center',
    minHeight: 0,
    padding: CARD_PADDING,
  },
  panelColumn: {
    minWidth: 0,
  },
  panelEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  panelHeading: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
    marginTop: 2,
  },
  pinColumn: {
    flex: 59,
  },
  pinPanel: {
    backgroundColor: colors.backgrounds.card,
  },
  pinStage: {
    alignItems: 'center',
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 16,
    width: '100%',
  },
  placeholderGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SECTION_GAP,
    minHeight: 0,
  },
  placeholderPageCard: {
    ...shadows.card,
    backgroundColor: withAlpha(colors.backgrounds.card, 0.98),
    borderColor: colors.borders.default,
    borderRadius: radius.heroCard,
    borderWidth: 1,
    flex: 1,
    gap: SECTION_GAP,
    minHeight: 0,
    padding: CARD_PADDING,
  },
  placeholderPageTitle: {
    ...typography.display,
    color: colors.text.primary,
    fontSize: 42,
    lineHeight: 44,
  },
  placeholderPageTitleCompact: {
    fontSize: 32,
    lineHeight: 34,
  },
  placeholderTile: {
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 140,
  },
  placeholderTileWide: {
    flexBasis: '100%',
    minHeight: 110,
  },
  screen: {
    flex: 1,
    paddingVertical: 12,
  },
  swipePage: {
    flex: 1,
    minHeight: 0,
  },
  swipePageFallback: {
    width: '100%',
  },
  supportText: {
    ...typography.bodySm,
    minHeight: componentTokens.input.messageMinHeight,
    textAlign: 'center',
  },
  supportTextError: {
    color: colors.states.danger,
  },
  supportTextMuted: {
    color: colors.text.secondary,
  },
});
