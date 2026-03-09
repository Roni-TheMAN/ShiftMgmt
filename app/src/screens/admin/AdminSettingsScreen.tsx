import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { getPayPeriodPreview } from '../../services/payroll/payPeriod';
import {
  getNominalPayPeriodDays,
  getPropertySettings,
  getPayrollSettings,
  PAY_PERIOD_LENGTHS,
  PAY_PERIOD_START_DAYS,
  savePropertySettings,
  savePayrollSettings,
  supportsFirstPayrollRunDays,
  type PayPeriodLength,
  type PayPeriodStartDay,
} from '../../services/repositories/settingsRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type AdminSettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminSettings'
>;

type SettingsDraft = {
  propertyName: string;
  propertyAddress: string;
  propertyDetails: string;
  payPeriodLength: PayPeriodLength;
  payPeriodStartDay: PayPeriodStartDay;
  payPeriodStartDate: string;
  firstPayrollRunDaysInput: string;
  ot1MultiplierInput: string;
  ot2MultiplierInput: string;
  ot2HolidayDatesInput: string;
  autoClockOutEnabled: boolean;
  autoClockOutHoursInput: string;
};

const PAY_PERIOD_LABELS: Record<PayPeriodLength, string> = {
  BIWEEKLY: 'Biweekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Semiannual',
  WEEKLY: 'Weekly',
  YEARLY: 'Yearly',
};

const START_DAY_LABELS: Record<PayPeriodStartDay, string> = {
  FRIDAY: 'Friday',
  MONDAY: 'Monday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
  THURSDAY: 'Thursday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
};

const WEEKDAY_INDEX: Record<PayPeriodStartDay, number> = {
  FRIDAY: 5,
  MONDAY: 1,
  SATURDAY: 6,
  SUNDAY: 0,
  THURSDAY: 4,
  TUESDAY: 2,
  WEDNESDAY: 3,
};

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMostRecentStartDayIsoDate(day: PayPeriodStartDay) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const dayDiff = (date.getDay() - WEEKDAY_INDEX[day] + 7) % 7;
  date.setDate(date.getDate() - dayDiff);
  return toIsoDateLocal(date);
}

function parseIsoDateLocal(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  const [yearPart, monthPart, dayPart] = isoDate.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function toMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDateLabel(isoDate: string) {
  const parsed = parseIsoDateLocal(isoDate);
  if (!parsed) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: 'numeric',
  });
}

function buildCalendarDays(monthStart: Date, weekStartIndex: number) {
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = monthStart.getDay();
  const daysBefore = (firstWeekday - weekStartIndex + 7) % 7;
  const rawTotal = daysBefore + daysInMonth;
  const trailingDays = (7 - (rawTotal % 7)) % 7;
  const totalCells = rawTotal + trailingDays;

  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - daysBefore);
  gridStart.setHours(0, 0, 0, 0);

  const todayIso = toIsoDateLocal(new Date());
  const cells: Array<{
    dayLabel: string;
    inCurrentMonth: boolean;
    isoDate: string;
    isToday: boolean;
  }> = [];

  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const isoDate = toIsoDateLocal(cellDate);
    cells.push({
      dayLabel: String(cellDate.getDate()),
      inCurrentMonth: cellDate.getMonth() === monthStart.getMonth(),
      isToday: isoDate === todayIso,
      isoDate,
    });
  }
  return cells;
}

function buildWeekdayLabels(weekStartIndex: number) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 7 }, (_, offset) => labels[(weekStartIndex + offset) % 7]);
}

function parsePositiveWholeNumber(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseHolidayDatesInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export default function AdminSettingsScreen({ navigation }: AdminSettingsScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [calendarMonthStart, setCalendarMonthStart] = useState(() =>
    toMonthStart(new Date()),
  );

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [payrollSettings, propertySettings] = await Promise.all([
        getPayrollSettings(),
        getPropertySettings(),
      ]);
      const parsedStartDate = parseIsoDateLocal(payrollSettings.payPeriodStartDate);
      setIsDateDropdownOpen(false);
      setCalendarMonthStart(toMonthStart(parsedStartDate ?? new Date()));
      setDraft({
        autoClockOutEnabled: payrollSettings.autoClockOutEnabled,
        autoClockOutHoursInput: String(payrollSettings.autoClockOutHours),
        firstPayrollRunDaysInput:
          payrollSettings.firstPayrollRunDays === null
            ? ''
            : String(payrollSettings.firstPayrollRunDays),
        ot1MultiplierInput: String(payrollSettings.ot1Multiplier),
        ot2HolidayDatesInput: payrollSettings.ot2HolidayDates.join('\n'),
        ot2MultiplierInput: String(payrollSettings.ot2Multiplier),
        payPeriodLength: payrollSettings.payPeriodLength,
        payPeriodStartDate: payrollSettings.payPeriodStartDate,
        payPeriodStartDay: payrollSettings.payPeriodStartDay,
        propertyAddress: propertySettings.propertyAddress,
        propertyDetails: propertySettings.propertyDetails,
        propertyName: propertySettings.propertyName,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      markActivity();
      setMessage(null);
      void loadSettings();
    }, [loadSettings, markActivity]),
  );

  const supportsFirstRunDays = draft
    ? supportsFirstPayrollRunDays(draft.payPeriodLength)
    : false;
  const maxFirstRunDays = draft ? getNominalPayPeriodDays(draft.payPeriodLength) : 0;

  const preview = useMemo(() => {
    if (!draft) {
      return null;
    }

    const parsedFirstRunDays = parsePositiveWholeNumber(
      draft.firstPayrollRunDaysInput.trim(),
    );
    const firstPayrollRunDays =
      supportsFirstPayrollRunDays(draft.payPeriodLength) && parsedFirstRunDays !== null
        ? parsedFirstRunDays
        : null;

    try {
      return getPayPeriodPreview({
        autoClockOutEnabled: draft.autoClockOutEnabled,
        autoClockOutHours:
          Number.parseFloat(draft.autoClockOutHoursInput) > 0
            ? Number.parseFloat(draft.autoClockOutHoursInput)
            : 12,
        firstPayrollRunDays,
        ot1Multiplier:
          Number.parseFloat(draft.ot1MultiplierInput) >= 1
            ? Number.parseFloat(draft.ot1MultiplierInput)
            : 1.5,
        ot1WeeklyThresholdHours: 40,
        ot2HolidayDates: parseHolidayDatesInput(draft.ot2HolidayDatesInput),
        ot2Multiplier:
          Number.parseFloat(draft.ot2MultiplierInput) >= 1
            ? Number.parseFloat(draft.ot2MultiplierInput)
            : 2,
        payPeriodLength: draft.payPeriodLength,
        payPeriodStartDate: draft.payPeriodStartDate,
        payPeriodStartDay: draft.payPeriodStartDay,
      });
    } catch {
      return null;
    }
  }, [draft]);

  const weekStartIndex = draft ? WEEKDAY_INDEX[draft.payPeriodStartDay] : 0;
  const weekdayLabels = useMemo(() => buildWeekdayLabels(weekStartIndex), [weekStartIndex]);
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonthStart, weekStartIndex),
    [calendarMonthStart, weekStartIndex],
  );
  const calendarMonthLabel = useMemo(
    () =>
      calendarMonthStart.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [calendarMonthStart],
  );

  const save = async () => {
    markActivity();
    if (!draft) {
      return;
    }

    setError(null);
    setMessage(null);

    const autoClockOutHours = Number.parseFloat(draft.autoClockOutHoursInput.trim());
    if (!Number.isFinite(autoClockOutHours) || autoClockOutHours <= 0) {
      setError('Auto clock-out hours must be greater than 0.');
      return;
    }
    if (autoClockOutHours > 24) {
      setError('Auto clock-out hours cannot exceed 24.');
      return;
    }

    const ot1Multiplier = Number.parseFloat(draft.ot1MultiplierInput.trim());
    if (!Number.isFinite(ot1Multiplier) || ot1Multiplier < 1) {
      setError('OT1 multiplier must be at least 1.0.');
      return;
    }
    if (ot1Multiplier > 5) {
      setError('OT1 multiplier cannot exceed 5.0.');
      return;
    }

    const ot2Multiplier = Number.parseFloat(draft.ot2MultiplierInput.trim());
    if (!Number.isFinite(ot2Multiplier) || ot2Multiplier < 1) {
      setError('OT2 multiplier must be at least 1.0.');
      return;
    }
    if (ot2Multiplier > 5) {
      setError('OT2 multiplier cannot exceed 5.0.');
      return;
    }

    const ot2HolidayDates = parseHolidayDatesInput(draft.ot2HolidayDatesInput);
    const invalidHolidayDate = ot2HolidayDates.find(
      (value) => parseIsoDateLocal(value) === null,
    );
    if (invalidHolidayDate) {
      setError(`Invalid holiday date: ${invalidHolidayDate}. Use YYYY-MM-DD.`);
      return;
    }
    if (ot2HolidayDates.length > 366) {
      setError('Holiday dates cannot exceed 366 entries.');
      return;
    }

    let firstPayrollRunDays: number | null = null;
    if (supportsFirstPayrollRunDays(draft.payPeriodLength)) {
      const rawValue = draft.firstPayrollRunDaysInput.trim();
      if (rawValue.length > 0) {
        const parsed = parsePositiveWholeNumber(rawValue);
        if (parsed === null) {
          setError('First payroll run days must be a positive whole number.');
          return;
        }
        if (parsed > maxFirstRunDays) {
          setError(`First payroll run days cannot exceed ${maxFirstRunDays}.`);
          return;
        }
        firstPayrollRunDays = parsed;
      }
    }

    setIsSaving(true);
    try {
      await Promise.all([
        savePayrollSettings({
          autoClockOutEnabled: draft.autoClockOutEnabled,
          autoClockOutHours,
          firstPayrollRunDays,
          ot1Multiplier,
          ot1WeeklyThresholdHours: 40,
          ot2HolidayDates,
          ot2Multiplier,
          payPeriodLength: draft.payPeriodLength,
          payPeriodStartDate: draft.payPeriodStartDate,
          payPeriodStartDay: draft.payPeriodStartDay,
        }),
        savePropertySettings({
          propertyAddress: draft.propertyAddress,
          propertyDetails: draft.propertyDetails,
          propertyName: draft.propertyName,
        }),
      ]);
      setMessage('Settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <AdminScreenContainer style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScrollContainer>
      <PageHeader
        actions={
          <PrimaryButton
            fullWidth={isCompactWidth}
            onPress={() => {
              markActivity();
              navigation.navigate('AdminPayrollHours');
            }}
            title="View Payroll Hours"
            variant="primary"
          />
        }
        onBack={() => {
          navigation.goBack();
        }}
        subtitle="Configure payroll schedule and period boundaries for reporting."
        title="Settings"
      />

      <SurfaceCard padding="lg" style={styles.card}>
          <Text style={styles.sectionLabel}>Property Name</Text>
          <TextInput
            editable={!isSaving}
            maxLength={120}
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      propertyName: value,
                    }
                  : current,
              );
            }}
            placeholder="Enter property name"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={draft.propertyName}
          />

          <Text style={styles.sectionLabel}>Property Address</Text>
          <TextInput
            editable={!isSaving}
            maxLength={240}
            multiline
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      propertyAddress: value,
                    }
                  : current,
              );
            }}
            placeholder="Enter property address"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={draft.propertyAddress}
          />

          <Text style={styles.sectionLabel}>Additional Property Details (Optional)</Text>
          <TextInput
            editable={!isSaving}
            maxLength={500}
            multiline
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      propertyDetails: value,
                    }
                  : current,
              );
            }}
            placeholder="Office phone, gate code instructions, manager notes, etc."
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.multilineInputTall]}
            textAlignVertical="top"
            value={draft.propertyDetails}
          />

          <Text style={styles.helpText}>
            Property details appear on the kiosk home screen and can help staff confirm the
            active location.
          </Text>

          <Text style={styles.sectionLabel}>Pay Period Length</Text>
          <View style={styles.optionsGrid}>
            {PAY_PERIOD_LENGTHS.map((option) => (
              <PrimaryButton
                disabled={isSaving}
                key={option}
                onPress={() => {
                  markActivity();
                  setError(null);
                  setMessage(null);
                  setDraft((current) => {
                    if (!current) {
                      return current;
                    }

                    const next: SettingsDraft = {
                      ...current,
                      payPeriodLength: option,
                    };
                    if (!supportsFirstPayrollRunDays(option)) {
                      next.firstPayrollRunDaysInput = '';
                    } else {
                      const parsed = parsePositiveWholeNumber(
                        current.firstPayrollRunDaysInput.trim(),
                      );
                      const maxDays = getNominalPayPeriodDays(option);
                      if (parsed !== null && parsed > maxDays) {
                        next.firstPayrollRunDaysInput = String(maxDays);
                      }
                    }
                    return next;
                  });
                }}
                style={styles.optionButton}
                title={PAY_PERIOD_LABELS[option]}
                variant={draft.payPeriodLength === option ? 'success' : 'neutral'}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>Week Start Day</Text>
          <View style={styles.optionsGrid}>
            {PAY_PERIOD_START_DAYS.map((option) => (
              <PrimaryButton
                disabled={isSaving}
                key={option}
                onPress={() => {
                  markActivity();
                  setError(null);
                  setMessage(null);
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          payPeriodStartDay: option,
                        }
                      : current,
                  );
                }}
                style={styles.optionButton}
                title={START_DAY_LABELS[option]}
                variant={draft.payPeriodStartDay === option ? 'success' : 'neutral'}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>Pay Period Start Date (YYYY-MM-DD)</Text>
          <Pressable
            onPress={() => {
              markActivity();
              setIsDateDropdownOpen((current) => {
                const next = !current;
                if (next) {
                  const selectedDate = parseIsoDateLocal(draft.payPeriodStartDate);
                  setCalendarMonthStart(toMonthStart(selectedDate ?? new Date()));
                }
                return next;
              });
            }}
            style={styles.dateDropdownTrigger}
          >
            <Text style={styles.dateDropdownLabel}>Selected Date</Text>
            <Text style={styles.dateDropdownValue}>
              {formatDateLabel(draft.payPeriodStartDate)}
            </Text>
            <Text style={styles.dateDropdownHint}>
              {isDateDropdownOpen ? 'Hide calendar' : 'Open compact calendar'}
            </Text>
          </Pressable>
          {isDateDropdownOpen ? (
            <View style={styles.dateDropdownPanel}>
              <View style={styles.calendarHeader}>
                <Pressable
                  onPress={() => {
                    markActivity();
                    setCalendarMonthStart((current) => addMonths(current, -1));
                  }}
                  style={styles.calendarNavButton}
                >
                  <Text style={styles.calendarNavButtonText}>{'<'}</Text>
                </Pressable>
                <Text style={styles.calendarHeaderLabel}>{calendarMonthLabel}</Text>
                <Pressable
                  onPress={() => {
                    markActivity();
                    setCalendarMonthStart((current) => addMonths(current, 1));
                  }}
                  style={styles.calendarNavButton}
                >
                  <Text style={styles.calendarNavButtonText}>{'>'}</Text>
                </Pressable>
              </View>

              <View style={styles.calendarWeekdayRow}>
                {weekdayLabels.map((label) => (
                  <Text key={label} style={styles.calendarWeekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day) => {
                  const isSelected = draft.payPeriodStartDate === day.isoDate;
                  return (
                    <Pressable
                      key={day.isoDate}
                      onPress={() => {
                        markActivity();
                        setError(null);
                        setMessage(null);
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                payPeriodStartDate: day.isoDate,
                              }
                            : current,
                        );
                        setIsDateDropdownOpen(false);
                      }}
                      style={[
                        styles.calendarDayCell,
                        !day.inCurrentMonth ? styles.calendarDayCellOutside : null,
                        day.isToday ? styles.calendarDayCellToday : null,
                        isSelected ? styles.calendarDayCellSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayLabel,
                          !day.inCurrentMonth ? styles.calendarDayLabelOutside : null,
                          isSelected ? styles.calendarDayLabelSelected : null,
                        ]}
                      >
                        {day.dayLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View style={styles.inlineActions}>
            <PrimaryButton
              disabled={isSaving}
              onPress={() => {
                markActivity();
                setError(null);
                setMessage(null);
                const nextDate = getMostRecentStartDayIsoDate(draft.payPeriodStartDay);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        payPeriodStartDate: nextDate,
                      }
                    : current,
                );
                const parsed = parseIsoDateLocal(nextDate);
                if (parsed) {
                  setCalendarMonthStart(toMonthStart(parsed));
                }
              }}
              title={`Use Last ${START_DAY_LABELS[draft.payPeriodStartDay]}`}
              variant="neutral"
            />
            <PrimaryButton
              disabled={isSaving}
              onPress={() => {
                markActivity();
                setError(null);
                setMessage(null);
                const nextDate = toIsoDateLocal(new Date());
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        payPeriodStartDate: nextDate,
                      }
                    : current,
                );
                const parsed = parseIsoDateLocal(nextDate);
                if (parsed) {
                  setCalendarMonthStart(toMonthStart(parsed));
                }
              }}
              title="Use Today"
              variant="neutral"
            />
          </View>

          {supportsFirstRunDays ? (
            <>
              <Text style={styles.sectionLabel}>First Payroll Run Days (Optional)</Text>
              <Text style={styles.helpText}>
                Set this for startup payroll (for example, 7 days on a biweekly schedule).
                Leave blank to use the full period length ({maxFirstRunDays} days).
              </Text>
              <TextInput
                editable={!isSaving}
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={(value) => {
                  markActivity();
                  setError(null);
                  setMessage(null);
                  const sanitized = value.replace(/\D/g, '');
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          firstPayrollRunDaysInput: sanitized,
                        }
                      : current,
                  );
                }}
                placeholder={`1-${maxFirstRunDays}`}
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={draft.firstPayrollRunDaysInput}
              />
            </>
          ) : (
            <Text style={styles.helpText}>
              First payroll run override is available for weekly and biweekly schedules.
            </Text>
          )}

          <Text style={styles.sectionLabel}>Overtime Rules</Text>
          <Text style={styles.helpText}>
            OT1 applies to non-holiday hours above 40 per week. OT2 applies to
            holiday dates listed below.
          </Text>
          <TextInput
            editable={false}
            style={[styles.input, styles.inputDisabled]}
            value="OT1 Threshold: 40 hours/week (fixed)"
          />

          <Text style={styles.sectionLabel}>OT1 Multiplier</Text>
          <TextInput
            editable={!isSaving}
            keyboardType="decimal-pad"
            maxLength={5}
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              const sanitized = value.replace(/[^0-9.]/g, '');
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      ot1MultiplierInput: sanitized,
                    }
                  : current,
              );
            }}
            placeholder="1.50"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={draft.ot1MultiplierInput}
          />

          <Text style={styles.sectionLabel}>OT2 Multiplier</Text>
          <TextInput
            editable={!isSaving}
            keyboardType="decimal-pad"
            maxLength={5}
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              const sanitized = value.replace(/[^0-9.]/g, '');
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      ot2MultiplierInput: sanitized,
                    }
                  : current,
              );
            }}
            placeholder="2.00"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={draft.ot2MultiplierInput}
          />

          <Text style={styles.sectionLabel}>OT2 Holiday Dates (YYYY-MM-DD)</Text>
          <Text style={styles.helpText}>
            Enter one date per line or separate dates with commas.
          </Text>
          <TextInput
            editable={!isSaving}
            maxLength={5000}
            multiline
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      ot2HolidayDatesInput: value,
                    }
                  : current,
              );
            }}
            placeholder={`2026-01-01\n2026-12-25`}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.multilineInputTall]}
            textAlignVertical="top"
            value={draft.ot2HolidayDatesInput}
          />

          <Text style={styles.sectionLabel}>Auto Clock-Out</Text>
          <View style={styles.inlineActions}>
            <PrimaryButton
              disabled={isSaving}
              onPress={() => {
                markActivity();
                setError(null);
                setMessage(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        autoClockOutEnabled: true,
                      }
                    : current,
                );
              }}
              title="Enabled"
              variant={draft.autoClockOutEnabled ? 'success' : 'neutral'}
            />
            <PrimaryButton
              disabled={isSaving}
              onPress={() => {
                markActivity();
                setError(null);
                setMessage(null);
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        autoClockOutEnabled: false,
                      }
                    : current,
                );
              }}
              title="Disabled"
              variant={!draft.autoClockOutEnabled ? 'danger' : 'neutral'}
            />
          </View>
          <Text style={styles.helpText}>
            If enabled, open shifts are automatically clocked out once they exceed this
            threshold.
          </Text>
          <TextInput
            editable={!isSaving}
            keyboardType="decimal-pad"
            maxLength={5}
            onChangeText={(value) => {
              markActivity();
              setError(null);
              setMessage(null);
              const sanitized = value.replace(/[^0-9.]/g, '');
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      autoClockOutHoursInput: sanitized,
                    }
                  : current,
              );
            }}
            placeholder="Hours (e.g. 12)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={draft.autoClockOutHoursInput}
          />

          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Current Period Preview</Text>
            {preview ? (
              <>
                <Text style={styles.previewLine}>
                  Start: <Text style={styles.previewValue}>{preview.periodStartDate}</Text>
                </Text>
                <Text style={styles.previewLine}>
                  End: <Text style={styles.previewValue}>{preview.periodEndDate}</Text>
                </Text>
                <Text style={styles.previewLine}>
                  Next Start:{' '}
                  <Text style={styles.previewValue}>{preview.nextPeriodStartDate}</Text>
                </Text>
                <Text style={styles.previewLine}>
                  Days in Period:{' '}
                  <Text style={styles.previewValue}>{preview.periodLengthDays}</Text>
                </Text>
                <Text style={styles.previewHint}>
                  {preview.referenceInPeriod
                    ? 'Today is inside this period.'
                    : 'Start date is in the future, showing the first upcoming period.'}
                </Text>
              </>
            ) : (
              <Text style={styles.previewHint}>
                Enter a valid start date to preview the current period.
              </Text>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          <View
            style={[
              styles.actions,
              isCompactWidth ? styles.actionsCompact : null,
              isVeryCompactWidth ? styles.actionsStacked : null,
            ]}
          >
            <PrimaryButton
              disabled={isSaving}
              fullWidth={isVeryCompactWidth}
              onPress={() => {
                void save();
              }}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title={isSaving ? 'Saving...' : 'Save Settings'}
              variant="success"
            />
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={() => {
                navigation.goBack();
              }}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Back"
              variant="neutral"
            />
          </View>
      </SurfaceCard>
    </AdminScrollContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionsCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  card: {
    maxWidth: 920,
    width: '100%',
  },
  compactActionButton: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCell: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: spacing.xs,
    width: '14.2857%',
  },
  calendarDayCellOutside: {
    opacity: 0.45,
  },
  calendarDayCellSelected: {
    backgroundColor: colors.primary,
  },
  calendarDayCellToday: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  calendarDayLabel: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  calendarDayLabelOutside: {
    color: colors.textSecondary,
  },
  calendarDayLabelSelected: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarHeaderLabel: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  calendarNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  calendarNavButtonText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  calendarWeekdayLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    width: '14.2857%',
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  dateDropdownHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dateDropdownLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  dateDropdownPanel: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
    padding: spacing.md,
  },
  dateDropdownTrigger: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateDropdownValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.md,
  },
  helpText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputDisabled: {
    color: colors.textSecondary,
    opacity: 0.85,
  },
  multilineInput: {
    minHeight: 72,
  },
  multilineInputTall: {
    minHeight: 110,
  },
  messageText: {
    ...typography.label,
    color: colors.success,
    marginTop: spacing.md,
  },
  optionButton: {
    flexGrow: 1,
    minWidth: 140,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  previewCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  previewHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  previewLine: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  previewTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  previewValue: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sectionLabel: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
});
