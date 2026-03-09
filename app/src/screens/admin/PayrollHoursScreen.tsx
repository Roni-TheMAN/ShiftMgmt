import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { buildPayrollHoursSummary } from '../../services/payroll/hoursAggregation';
import { getPayPeriodPreviewByHistoryOffset } from '../../services/payroll/payPeriod';
import { exportPayrollPeriodReportPdf } from '../../services/export/payrollReportExport';
import {
  deleteAdminShift,
  findFirstClockOutAfterTimestamp,
  listClockEventsWithEmployeeInRange,
  upsertAdminShift,
} from '../../services/repositories/clockEventRepository';
import { listEmployees } from '../../services/repositories/employeeRepository';
import { getPayrollSettings } from '../../services/repositories/settingsRepository';
import { colors, spacing, typography } from '../../theme';
import type { ClockEventWithEmployee, EmployeeRecord } from '../../types/database';
import type { RootStackParamList } from '../../types/navigation';

type PayrollHoursScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminPayrollHours'
>;

type PayrollHoursState = {
  payPeriod: ReturnType<typeof getPayPeriodPreviewByHistoryOffset>;
  schedule: {
    payPeriodLength: string;
    payPeriodStartDate: string;
    payPeriodStartDay: string;
    firstPayrollRunDays: number | null;
    ot1WeeklyThresholdHours: number;
    ot1Multiplier: number;
    ot2Multiplier: number;
    ot2HolidayDates: string[];
  };
  summary: ReturnType<typeof buildPayrollHoursSummary>;
};

type ShiftEntry =
  ReturnType<typeof buildPayrollHoursSummary>['shiftsByEmployee'][number]['shifts'][number];
type EmployeeTotalEntry =
  ReturnType<typeof buildPayrollHoursSummary>['employeeTotals'][number];

type ShiftFormState = {
  mode: 'ADD' | 'EDIT' | 'CLOSE';
  employeeId: number;
  employeeName: string;
  clockInEventId: number | null;
  clockOutEventId: number | null;
  clockInInput: string;
  clockOutInput: string;
  includeClockOut: boolean;
};

type ShiftPickerTarget = 'clockIn' | 'clockOut';
type ShiftPickerMode = 'date' | 'time';
type ActiveShiftPicker = {
  mode: ShiftPickerMode;
  target: ShiftPickerTarget;
};

function localDayKeyToRangeIso(dayKey: string) {
  const [yearPart, monthPart, dayPart] = dayKey.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return {
    endIsoExclusive: end.toISOString(),
    startIsoInclusive: start.toISOString(),
  };
}

function collectOpenClockInsAtRangeEnd(events: ClockEventWithEmployee[]) {
  const openClockInsByEmployee = new Map<number, ClockEventWithEmployee>();
  for (const event of events) {
    if (event.type === 'IN') {
      openClockInsByEmployee.set(event.employee_id, event);
      continue;
    }
    openClockInsByEmployee.delete(event.employee_id);
  }
  return Array.from(openClockInsByEmployee.values());
}

function mergePayrollEvents(
  eventsInRange: ClockEventWithEmployee[],
  carryoverClockOuts: ClockEventWithEmployee[],
) {
  const mergedEvents = [...eventsInRange];
  const seenIds = new Set(eventsInRange.map((event) => event.id));

  for (const event of carryoverClockOuts) {
    if (seenIds.has(event.id)) {
      continue;
    }
    seenIds.add(event.id);
    mergedEvents.push(event);
  }

  mergedEvents.sort(
    (a, b) =>
      a.employee_id - b.employee_id ||
      a.timestamp.localeCompare(b.timestamp) ||
      a.id - b.id,
  );

  return mergedEvents;
}

function formatHours(hours: number) {
  return `${hours.toFixed(2)}h`;
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function formatEmployeeInlineSummary(employee: EmployeeTotalEntry) {
  return [
    `REG ${formatHours(employee.regularHours)}`,
    `OT1 ${formatHours(employee.ot1Hours)}`,
    `OT2 ${formatHours(employee.ot2Hours)}`,
    `TOT ${formatHours(employee.hours)}`,
    `PAY ${formatCurrency(employee.totalPay)}`,
  ].join(' | ');
}

function formatDay(dayKey: string, short = false) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: short ? 'short' : 'numeric',
    year: short ? undefined : 'numeric',
  });
}

function formatTimestampShort(timestamp: string | null) {
  if (!timestamp) {
    return '-';
  }
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

function formatEditedTime(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

function toLocalDateTimeInput(isoTimestamp: string | null) {
  if (!isoTimestamp) {
    return '';
  }
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function parseLocalDateTimeInput(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error('Use date/time format YYYY-MM-DD HH:mm.');
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error('Invalid date/time value.');
  }
  return date.toISOString();
}

function parseLocalDateTimeInputToDate(value: string, fallback = new Date()) {
  try {
    return new Date(parseLocalDateTimeInput(value));
  } catch {
    return fallback;
  }
}

function mergeShiftPickerValue(
  currentInput: string,
  selectedDate: Date,
  mode: ShiftPickerMode,
) {
  const current = parseLocalDateTimeInputToDate(currentInput, selectedDate);
  const next = new Date(current);

  if (mode === 'date') {
    next.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );
  } else {
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  }

  return toLocalDateTimeInput(next.toISOString());
}

function formatShiftFormDate(value: string) {
  return parseLocalDateTimeInputToDate(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShiftFormDateTime(value: string) {
  return parseLocalDateTimeInputToDate(value).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatShiftFormTime(value: string) {
  return parseLocalDateTimeInputToDate(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function addHoursToShiftInput(value: string, hours: number) {
  const current = parseLocalDateTimeInputToDate(value);
  return toLocalDateTimeInput(new Date(current.getTime() + hours * 60 * 60 * 1000).toISOString());
}

function formatDurationClock(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatShiftWindow(shift: ShiftEntry) {
  if (shift.status === 'UNMATCHED_OUT') {
    return `OUT ${formatTimestampShort(shift.clockOutTimestamp)}`;
  }
  const inText = formatTimestampShort(shift.clockInTimestamp);
  const outText = shift.clockOutTimestamp
    ? formatTimestampShort(shift.clockOutTimestamp)
    : 'Open';
  return `${inText} -> ${outText}`;
}

function historyLabel(periodsBack: number) {
  if (periodsBack === 0) {
    return 'Current Period';
  }
  if (periodsBack === 1) {
    return '1 Period Back';
  }
  return `${periodsBack} Periods Back`;
}

export default function PayrollHoursScreen({ navigation }: PayrollHoursScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const usesNativeShiftPickers = Platform.OS === 'android' || Platform.OS === 'ios';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [state, setState] = useState<PayrollHoursState | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [periodsBack, setPeriodsBack] = useState(0);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);
  const [showAllShiftLogs, setShowAllShiftLogs] = useState(false);
  const [showAllDayTotals, setShowAllDayTotals] = useState(false);
  const [isSavingShiftAction, setIsSavingShiftAction] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [shiftForm, setShiftForm] = useState<ShiftFormState | null>(null);
  const [activeShiftPicker, setActiveShiftPicker] = useState<ActiveShiftPicker | null>(null);

  useEffect(() => {
    setExpandedEmployeeId(null);
    setShowAllShiftLogs(false);
    setShowAllDayTotals(false);
    setShiftForm(null);
    setActiveShiftPicker(null);
    setActionMessage(null);
  }, [periodsBack]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [payrollSettings, allEmployees] = await Promise.all([
        getPayrollSettings(),
        listEmployees(),
      ]);
      const payPeriod = getPayPeriodPreviewByHistoryOffset(payrollSettings, periodsBack);
      const startRange = localDayKeyToRangeIso(payPeriod.periodStartDate);
      const endRange = localDayKeyToRangeIso(payPeriod.periodEndDate);

      const eventsInRange = await listClockEventsWithEmployeeInRange(
        startRange.startIsoInclusive,
        endRange.endIsoExclusive,
      );
      const openClockInsAtRangeEnd = collectOpenClockInsAtRangeEnd(eventsInRange);
      const carryoverClockOutCandidates = await Promise.all(
        openClockInsAtRangeEnd.map((clockInEvent) =>
          findFirstClockOutAfterTimestamp({
            afterTimestampExclusive: clockInEvent.timestamp,
            employeeId: clockInEvent.employee_id,
          }),
        ),
      );
      const carryoverClockOuts = carryoverClockOutCandidates.filter(
        (event): event is ClockEventWithEmployee => Boolean(event),
      );
      const eventsForSummary = mergePayrollEvents(eventsInRange, carryoverClockOuts);
      const employeeHourlyRates = new Map(
        allEmployees.map((employee) => [employee.id, employee.hourly_rate]),
      );

      const summary = buildPayrollHoursSummary(eventsForSummary, {
        periodEndDate: payPeriod.periodEndDate,
        periodStartDate: payPeriod.periodStartDate,
      }, {
        employeeHourlyRates,
        ot1Multiplier: payrollSettings.ot1Multiplier,
        ot1WeeklyThresholdHours: payrollSettings.ot1WeeklyThresholdHours,
        ot2HolidayDates: payrollSettings.ot2HolidayDates,
        ot2Multiplier: payrollSettings.ot2Multiplier,
      });

      setState({
        payPeriod,
        schedule: {
          firstPayrollRunDays: payrollSettings.firstPayrollRunDays,
          ot1Multiplier: payrollSettings.ot1Multiplier,
          ot1WeeklyThresholdHours: payrollSettings.ot1WeeklyThresholdHours,
          ot2HolidayDates: payrollSettings.ot2HolidayDates,
          ot2Multiplier: payrollSettings.ot2Multiplier,
          payPeriodLength: payrollSettings.payPeriodLength,
          payPeriodStartDate: payrollSettings.payPeriodStartDate,
          payPeriodStartDay: payrollSettings.payPeriodStartDay,
        },
        summary,
      });
      setEmployees(allEmployees);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to calculate payroll hours.',
      );
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, [periodsBack]);

  useFocusEffect(
    useCallback(() => {
      markActivity();
      void loadData();
    }, [loadData, markActivity]),
  );

  const completedShiftCount = useMemo(() => {
    if (!state) {
      return 0;
    }
    return state.summary.employeeTotals.reduce(
      (sum, employee) => sum + employee.completedShiftCount,
      0,
    );
  }, [state]);

  const employeeCount = state?.summary.employeeTotals.length ?? 0;
  const avgDailyHours = state
    ? state.summary.totalPeriodHours / Math.max(state.payPeriod.periodLengthDays, 1)
    : 0;
  const displayedDayTotals = state
    ? showAllDayTotals
      ? state.summary.dayTotals
      : state.summary.dayTotals.slice(-14)
    : [];
  const canGoOlder = state ? !state.payPeriod.isFirstPeriod : false;

  const visibleShiftGroups = useMemo(() => {
    if (!state) {
      return [];
    }
    if (showAllShiftLogs) {
      return state.summary.shiftsByEmployee;
    }
    if (expandedEmployeeId !== null) {
      return state.summary.shiftsByEmployee.filter(
        (employee) => employee.employeeId === expandedEmployeeId,
      );
    }
    return [];
  }, [expandedEmployeeId, showAllShiftLogs, state]);

  const updateShiftFormInput = useCallback(
    (target: ShiftPickerTarget, nextValue: string) => {
      setError(null);
      setActionMessage(null);
      setShiftForm((current) => {
        if (!current) {
          return current;
        }
        return target === 'clockIn'
          ? {
              ...current,
              clockInInput: nextValue,
            }
          : {
              ...current,
              clockOutInput: nextValue,
            };
      });
    },
    [],
  );

  const updateShiftFormFromPicker = useCallback(
    (target: ShiftPickerTarget, mode: ShiftPickerMode, selectedDate: Date) => {
      setError(null);
      setActionMessage(null);
      setShiftForm((current) => {
        if (!current) {
          return current;
        }
        const currentInput =
          target === 'clockIn' ? current.clockInInput : current.clockOutInput;
        const nextValue = mergeShiftPickerValue(currentInput, selectedDate, mode);
        return target === 'clockIn'
          ? {
              ...current,
              clockInInput: nextValue,
            }
          : {
              ...current,
              clockOutInput: nextValue,
            };
      });
    },
    [],
  );

  const openShiftPicker = useCallback(
    (target: ShiftPickerTarget, mode: ShiftPickerMode) => {
      if (!shiftForm) {
        return;
      }

      markActivity();
      setError(null);
      const currentInput =
        target === 'clockIn' ? shiftForm.clockInInput : shiftForm.clockOutInput;
      const currentDate = parseLocalDateTimeInputToDate(currentInput);

      if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({
          display: mode === 'date' ? 'calendar' : 'clock',
          is24Hour: false,
          mode,
          onChange: (event, selectedDate) => {
            if (event.type !== 'set' || !selectedDate) {
              return;
            }
            updateShiftFormFromPicker(target, mode, selectedDate);
          },
          value: currentDate,
        });
        return;
      }

      if (Platform.OS === 'ios') {
        setActiveShiftPicker({ mode, target });
      }
    },
    [markActivity, shiftForm, updateShiftFormFromPicker],
  );

  const handleIosShiftPickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!activeShiftPicker || !selectedDate || event.type === 'dismissed') {
        return;
      }
      updateShiftFormFromPicker(activeShiftPicker.target, activeShiftPicker.mode, selectedDate);
    },
    [activeShiftPicker, updateShiftFormFromPicker],
  );

  const activeShiftPickerValue = useMemo(() => {
    if (!shiftForm || !activeShiftPicker) {
      return null;
    }
    return parseLocalDateTimeInputToDate(
      activeShiftPicker.target === 'clockIn'
        ? shiftForm.clockInInput
        : shiftForm.clockOutInput,
    );
  }, [activeShiftPicker, shiftForm]);

  const shiftDurationPreview = useMemo(() => {
    if (!shiftForm || !shiftForm.includeClockOut) {
      return null;
    }

    try {
      const start = new Date(parseLocalDateTimeInput(shiftForm.clockInInput)).getTime();
      const end = new Date(parseLocalDateTimeInput(shiftForm.clockOutInput)).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }
      if (end <= start) {
        return 'Clock out must be after clock in.';
      }
      const durationMinutes = Math.round((end - start) / (60 * 1000));
      return `Duration ${formatDurationClock(durationMinutes)}`;
    } catch {
      return null;
    }
  }, [shiftForm]);

  const openAddShiftForm = () => {
    const preferredEmployee =
      employees.find((employee) => employee.id === expandedEmployeeId) ?? employees[0];
    if (!preferredEmployee) {
      setError('Create an employee first before adding shifts.');
      return;
    }

    const now = new Date();
    const startDefault = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    setShiftForm({
      clockInEventId: null,
      clockInInput: toLocalDateTimeInput(startDefault.toISOString()),
      clockOutEventId: null,
      clockOutInput: toLocalDateTimeInput(now.toISOString()),
      employeeId: preferredEmployee.id,
      employeeName: preferredEmployee.name,
      includeClockOut: true,
      mode: 'ADD',
    });
    setActiveShiftPicker(null);
    setActionMessage(null);
    setError(null);
  };

  const openEditShiftForm = (
    employeeId: number,
    employeeName: string,
    shift: ShiftEntry,
  ) => {
    if (!shift.clockInEventId) {
      setError('This shift cannot be edited because clock-in is missing.');
      return;
    }
    const isOpenShift = !shift.clockOutEventId;
    setShiftForm({
      clockInEventId: shift.clockInEventId,
      clockInInput: toLocalDateTimeInput(shift.clockInTimestamp),
      clockOutEventId: shift.clockOutEventId,
      clockOutInput: isOpenShift
        ? toLocalDateTimeInput(new Date().toISOString())
        : toLocalDateTimeInput(shift.clockOutTimestamp),
      employeeId,
      employeeName,
      includeClockOut: true,
      mode: isOpenShift ? 'CLOSE' : 'EDIT',
    });
    setActiveShiftPicker(null);
    setActionMessage(null);
    setError(null);
  };

  const closeForm = () => {
    setActiveShiftPicker(null);
    setShiftForm(null);
  };

  const exportCurrentPayPeriodReport = async () => {
    if (!state) {
      return;
    }

    setIsExportingReport(true);
    setError(null);
    setActionMessage(null);
    markActivity();

    try {
      await exportPayrollPeriodReportPdf({
        payPeriod: {
          periodEndDate: state.payPeriod.periodEndDate,
          periodLengthDays: state.payPeriod.periodLengthDays,
          periodStartDate: state.payPeriod.periodStartDate,
        },
        periodLabel: historyLabel(periodsBack),
        schedule: state.schedule,
        summary: state.summary,
      });
      setActionMessage('Payroll report exported.');
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Failed to export payroll report.',
      );
    } finally {
      setIsExportingReport(false);
    }
  };

  const saveShiftForm = async () => {
    if (!shiftForm) {
      return;
    }

    setIsSavingShiftAction(true);
    setError(null);
    setActionMessage(null);
    markActivity();

    try {
      const clockInTimestamp = parseLocalDateTimeInput(shiftForm.clockInInput);
      const clockOutTimestamp =
        shiftForm.includeClockOut && shiftForm.clockOutInput.trim().length > 0
          ? parseLocalDateTimeInput(shiftForm.clockOutInput)
          : null;

      if (
        clockOutTimestamp &&
        new Date(clockOutTimestamp).getTime() <= new Date(clockInTimestamp).getTime()
      ) {
        setError('Clock out must be after clock in.');
        return;
      }

      await upsertAdminShift({
        clockInEventId: shiftForm.clockInEventId,
        clockInTimestamp,
        clockOutEventId: shiftForm.clockOutEventId,
        clockOutTimestamp,
        employeeId: shiftForm.employeeId,
      });

      setActionMessage(
        shiftForm.mode === 'ADD'
          ? 'Shift added.'
          : shiftForm.mode === 'CLOSE'
            ? 'Open shift closed.'
            : 'Shift updated.',
      );
      setActiveShiftPicker(null);
      setShiftForm(null);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Shift update failed.');
    } finally {
      setIsSavingShiftAction(false);
    }
  };

  const confirmDeleteShift = (
    employeeId: number,
    employeeName: string,
    shift: ShiftEntry,
  ) => {
    if (!shift.clockInEventId && !shift.clockOutEventId) {
      setError('This shift has no deletable events.');
      return;
    }

    Alert.alert(
      'Delete Shift',
      `Delete this shift for ${employeeName}?`,
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: () => {
            void (async () => {
              setIsSavingShiftAction(true);
              setError(null);
              setActionMessage(null);
              markActivity();
              try {
                await deleteAdminShift({
                  clockInEventId: shift.clockInEventId,
                  clockOutEventId: shift.clockOutEventId,
                  employeeId,
                });
                setActionMessage('Shift deleted.');
                if (
                  shiftForm &&
                  shiftForm.employeeId === employeeId &&
                  shiftForm.clockInEventId === shift.clockInEventId &&
                  shiftForm.clockOutEventId === shift.clockOutEventId
                ) {
                  setShiftForm(null);
                }
                await loadData();
              } catch (deleteError) {
                setError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : 'Shift deletion failed.',
                );
              } finally {
                setIsSavingShiftAction(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <AdminScrollContainer style={styles.content}>
        <PageHeader
          actions={
            <>
              <PrimaryButton
                disabled={isLoading || !state || isExportingReport}
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  void exportCurrentPayPeriodReport();
                }}
                style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
                title={isExportingReport ? 'Exporting...' : 'Report'}
                variant="success"
              />
              <PrimaryButton
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  markActivity();
                  void loadData();
                }}
                style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
                title="Refresh"
                variant="primary"
              />
            </>
          }
          onBack={() => {
            navigation.goBack();
          }}
          subtitle="Condensed payroll view with period history and shift-level detail."
          title="Payroll Hours"
        />

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && state ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{historyLabel(periodsBack)}</Text>
              <Text style={styles.periodLine}>
                {formatDay(state.payPeriod.periodStartDate, true)} -{' '}
                {formatDay(state.payPeriod.periodEndDate, true)}
              </Text>
              <Text style={styles.periodMeta}>
                Schedule: {state.schedule.payPeriodLength} | Start day:{' '}
                {state.schedule.payPeriodStartDay} | Anchor date:{' '}
                {state.schedule.payPeriodStartDate}
              </Text>
              <Text style={styles.periodMeta}>
                First run override:{' '}
                {state.schedule.firstPayrollRunDays
                  ? `${state.schedule.firstPayrollRunDays} day(s)`
                  : 'None'}
              </Text>
              <Text style={styles.periodMeta}>
                OT1: {state.schedule.ot1Multiplier.toFixed(2)}x over{' '}
                {state.schedule.ot1WeeklyThresholdHours}h/week | OT2:{' '}
                {state.schedule.ot2Multiplier.toFixed(2)}x on{' '}
                {state.schedule.ot2HolidayDates.length} holiday(s)
              </Text>

              <View style={styles.periodNavRow}>
                <Pressable
                  disabled={!canGoOlder}
                  onPress={() => {
                    markActivity();
                    setPeriodsBack((current) => current + 1);
                  }}
                  style={[
                    styles.compactNavButton,
                    !canGoOlder ? styles.compactNavButtonDisabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.compactNavText,
                      !canGoOlder ? styles.compactNavTextDisabled : null,
                    ]}
                  >
                    Older
                  </Text>
                </Pressable>
                <Pressable
                  disabled={periodsBack === 0}
                  onPress={() => {
                    markActivity();
                    setPeriodsBack((current) => Math.max(0, current - 1));
                  }}
                  style={[
                    styles.compactNavButton,
                    periodsBack === 0 ? styles.compactNavButtonDisabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.compactNavText,
                      periodsBack === 0 ? styles.compactNavTextDisabled : null,
                    ]}
                  >
                    Newer
                  </Text>
                </Pressable>
                <Pressable
                  disabled={periodsBack === 0}
                  onPress={() => {
                    markActivity();
                    setPeriodsBack(0);
                  }}
                  style={[
                    styles.compactNavButton,
                    periodsBack === 0 ? styles.compactNavButtonDisabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.compactNavText,
                      periodsBack === 0 ? styles.compactNavTextDisabled : null,
                    ]}
                  >
                    Current
                  </Text>
                </Pressable>
              </View>

              <View style={styles.quickHistoryRow}>
                {[0, 1, 2, 3, 4].map((offset) => (
                  <Pressable
                    key={offset}
                    onPress={() => {
                      markActivity();
                      setPeriodsBack(offset);
                    }}
                    style={[
                      styles.quickHistoryChip,
                      periodsBack === offset ? styles.quickHistoryChipActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickHistoryText,
                        periodsBack === offset ? styles.quickHistoryTextActive : null,
                      ]}
                    >
                      {offset === 0 ? 'Now' : `-${offset}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.metricsWrap}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Hours</Text>
                <Text style={styles.metricValue}>
                  {formatHours(state.summary.totalPeriodHours)}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Payroll</Text>
                <Text style={styles.metricValue}>
                  {formatCurrency(state.summary.totalPeriodPay)}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Shifts</Text>
                <Text style={styles.metricValue}>{completedShiftCount}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Employees</Text>
                <Text style={styles.metricValue}>{employeeCount}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Avg / Day</Text>
                <Text style={styles.metricValue}>{formatHours(avgDailyHours)}</Text>
              </View>
            </View>

            <View style={styles.dualColumnRow}>
              <View style={styles.dualCard}>
                <Text style={styles.sectionTitle}>Week Totals</Text>
                {state.summary.weekTotals.map((week) => (
                  <View key={week.weekNumber} style={styles.compactRow}>
                    <Text style={styles.compactRowLabel}>
                      W{week.weekNumber} {formatDay(week.startDate, true)} -{' '}
                      {formatDay(week.endDate, true)}
                    </Text>
                    <Text style={styles.compactRowValue}>{formatHours(week.hours)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.dualCard}>
                <Text style={styles.sectionTitle}>Day Totals</Text>
                {displayedDayTotals.length === 0 ? (
                  <Text style={styles.emptyText}>No completed shifts in this period.</Text>
                ) : (
                  displayedDayTotals.map((day) => (
                    <View key={day.date} style={styles.compactRow}>
                      <Text style={styles.compactRowLabel}>{formatDay(day.date, true)}</Text>
                      <Text style={styles.compactRowValue}>{formatHours(day.hours)}</Text>
                    </View>
                  ))
                )}
                {state.summary.dayTotals.length > 14 ? (
                  <Pressable
                    onPress={() => {
                      markActivity();
                      setShowAllDayTotals((current) => !current);
                    }}
                    style={styles.inlineLinkButton}
                  >
                    <Text style={styles.inlineLinkText}>
                      {showAllDayTotals ? 'Show Last 14 Days' : 'Show All Days'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Employee Totals</Text>
              {state.summary.employeeTotals.length === 0 ? (
                <Text style={styles.emptyText}>No employee totals for this period.</Text>
              ) : (
                state.summary.employeeTotals.map((employee) => {
                  const isSelected = expandedEmployeeId === employee.employeeId;
                  return (
                    <Pressable
                      key={employee.employeeId}
                      onPress={() => {
                        markActivity();
                        setExpandedEmployeeId((current) =>
                          current === employee.employeeId ? null : employee.employeeId,
                        );
                        setShowAllShiftLogs(false);
                      }}
                      style={[
                        styles.employeeRow,
                        isSelected ? styles.employeeRowSelected : null,
                      ]}
                    >
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={styles.employeeRowLine}
                      >
                        <Text style={styles.employeeRowName}>
                          {employee.employeeName}
                        </Text>
                        <Text style={styles.employeeRowSummary}>
                          {` | ${formatEmployeeInlineSummary(employee)}`}
                        </Text>
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              {shiftForm ? (
                <View style={styles.shiftEditorCard}>
                  <Text style={styles.sectionTitle}>
                    {shiftForm.mode === 'ADD'
                      ? 'Add Shift'
                      : shiftForm.mode === 'CLOSE'
                        ? 'Close / Edit Open Shift'
                        : 'Edit Shift'}
                  </Text>
                  <Text style={styles.shiftEditorMeta}>
                    Employee: {shiftForm.employeeName}
                  </Text>

                  {shiftForm.mode === 'ADD' ? (
                    <View style={styles.employeePickerRow}>
                      {employees.map((employee) => (
                        <Pressable
                          key={employee.id}
                          onPress={() => {
                            markActivity();
                            setShiftForm((current) =>
                              current
                                ? {
                                    ...current,
                                    employeeId: employee.id,
                                    employeeName: employee.name,
                                  }
                                : current,
                            );
                          }}
                          style={[
                            styles.employeeChip,
                            shiftForm.employeeId === employee.id
                              ? styles.employeeChipActive
                              : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.employeeChipText,
                              shiftForm.employeeId === employee.id
                                ? styles.employeeChipTextActive
                                : null,
                            ]}
                          >
                            {employee.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <Text style={styles.fieldLabel}>Clock In</Text>
                  {usesNativeShiftPickers ? (
                    <>
                      <View
                        style={[
                          styles.dateTimeRow,
                          isCompactWidth ? styles.dateTimeRowCompact : null,
                        ]}
                      >
                        <Pressable
                          onPress={() => {
                            void openShiftPicker('clockIn', 'date');
                          }}
                          style={[
                            styles.dateTimeFieldButton,
                            activeShiftPicker?.target === 'clockIn' &&
                            activeShiftPicker.mode === 'date'
                              ? styles.dateTimeFieldButtonActive
                              : null,
                          ]}
                        >
                          <Text style={styles.dateTimeFieldLabel}>Date</Text>
                          <Text style={styles.dateTimeFieldValue}>
                            {formatShiftFormDate(shiftForm.clockInInput)}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            void openShiftPicker('clockIn', 'time');
                          }}
                          style={[
                            styles.dateTimeFieldButton,
                            activeShiftPicker?.target === 'clockIn' &&
                            activeShiftPicker.mode === 'time'
                              ? styles.dateTimeFieldButtonActive
                              : null,
                          ]}
                        >
                          <Text style={styles.dateTimeFieldLabel}>Time</Text>
                          <Text style={styles.dateTimeFieldValue}>
                            {formatShiftFormTime(shiftForm.clockInInput)}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.quickAdjustRow}>
                        <Pressable
                          onPress={() => {
                            markActivity();
                            updateShiftFormInput(
                              'clockIn',
                              toLocalDateTimeInput(new Date().toISOString()),
                            );
                          }}
                          style={styles.quickAdjustButton}
                        >
                          <Text style={styles.quickAdjustText}>Now</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.fieldPreview}>
                        {formatShiftFormDateTime(shiftForm.clockInInput)}
                      </Text>
                    </>
                  ) : (
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSavingShiftAction}
                      onChangeText={(value) => {
                        setShiftForm((current) =>
                          current
                            ? {
                                ...current,
                                clockInInput: value,
                              }
                            : current,
                        );
                      }}
                      placeholder="2026-03-06 09:00"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                      value={shiftForm.clockInInput}
                    />
                  )}

                  <View style={styles.closeToggleRow}>
                    <Pressable
                      onPress={() => {
                        markActivity();
                        setActiveShiftPicker(null);
                        setShiftForm((current) =>
                          current
                            ? {
                                ...current,
                                includeClockOut: true,
                              }
                            : current,
                        );
                      }}
                      style={[
                        styles.inlineActionButton,
                        shiftForm.includeClockOut ? styles.inlineActionButtonActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.inlineActionText,
                          shiftForm.includeClockOut ? styles.inlineActionTextActive : null,
                        ]}
                      >
                        With Clock Out
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        markActivity();
                        setActiveShiftPicker((current) =>
                          current?.target === 'clockOut' ? null : current,
                        );
                        setShiftForm((current) =>
                          current
                            ? {
                                ...current,
                                includeClockOut: false,
                              }
                            : current,
                        );
                      }}
                      style={[
                        styles.inlineActionButton,
                        !shiftForm.includeClockOut ? styles.inlineActionButtonActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.inlineActionText,
                          !shiftForm.includeClockOut ? styles.inlineActionTextActive : null,
                        ]}
                      >
                        Open Shift
                      </Text>
                    </Pressable>
                  </View>

                  {shiftForm.includeClockOut ? (
                    <>
                      <Text style={styles.fieldLabel}>Clock Out</Text>
                      {usesNativeShiftPickers ? (
                        <>
                          <View
                            style={[
                              styles.dateTimeRow,
                              isCompactWidth ? styles.dateTimeRowCompact : null,
                            ]}
                          >
                            <Pressable
                              onPress={() => {
                                void openShiftPicker('clockOut', 'date');
                              }}
                              style={[
                                styles.dateTimeFieldButton,
                                activeShiftPicker?.target === 'clockOut' &&
                                activeShiftPicker.mode === 'date'
                                  ? styles.dateTimeFieldButtonActive
                                  : null,
                              ]}
                            >
                              <Text style={styles.dateTimeFieldLabel}>Date</Text>
                              <Text style={styles.dateTimeFieldValue}>
                                {formatShiftFormDate(shiftForm.clockOutInput)}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                void openShiftPicker('clockOut', 'time');
                              }}
                              style={[
                                styles.dateTimeFieldButton,
                                activeShiftPicker?.target === 'clockOut' &&
                                activeShiftPicker.mode === 'time'
                                  ? styles.dateTimeFieldButtonActive
                                  : null,
                              ]}
                            >
                              <Text style={styles.dateTimeFieldLabel}>Time</Text>
                              <Text style={styles.dateTimeFieldValue}>
                                {formatShiftFormTime(shiftForm.clockOutInput)}
                              </Text>
                            </Pressable>
                          </View>
                          <View style={styles.quickAdjustRow}>
                            <Pressable
                              onPress={() => {
                                markActivity();
                                updateShiftFormInput(
                                  'clockOut',
                                  toLocalDateTimeInput(new Date().toISOString()),
                                );
                              }}
                              style={styles.quickAdjustButton}
                            >
                              <Text style={styles.quickAdjustText}>Now</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                markActivity();
                                updateShiftFormInput(
                                  'clockOut',
                                  addHoursToShiftInput(shiftForm.clockInInput, 8),
                                );
                              }}
                              style={styles.quickAdjustButton}
                            >
                              <Text style={styles.quickAdjustText}>+8h</Text>
                            </Pressable>
                          </View>
                          <Text style={styles.fieldPreview}>
                            {formatShiftFormDateTime(shiftForm.clockOutInput)}
                          </Text>
                        </>
                      ) : (
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isSavingShiftAction}
                          onChangeText={(value) => {
                            setShiftForm((current) =>
                              current
                                ? {
                                    ...current,
                                    clockOutInput: value,
                                  }
                                : current,
                            );
                          }}
                          placeholder="2026-03-06 17:00"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          value={shiftForm.clockOutInput}
                        />
                      )}
                      {shiftDurationPreview ? (
                        <Text
                          style={[
                            styles.durationPreview,
                            shiftDurationPreview === 'Clock out must be after clock in.'
                              ? styles.durationPreviewError
                              : null,
                          ]}
                        >
                          {shiftDurationPreview}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  {Platform.OS === 'ios' && activeShiftPicker && activeShiftPickerValue ? (
                    <View style={styles.pickerPanel}>
                      <View style={styles.pickerPanelHeader}>
                        <Text style={styles.pickerPanelTitle}>
                          {activeShiftPicker.target === 'clockIn' ? 'Clock In' : 'Clock Out'}{' '}
                          {activeShiftPicker.mode === 'date' ? 'Date' : 'Time'}
                        </Text>
                        <Pressable
                          onPress={() => {
                            markActivity();
                            setActiveShiftPicker(null);
                          }}
                          style={styles.quickAdjustButton}
                        >
                          <Text style={styles.quickAdjustText}>Done</Text>
                        </Pressable>
                      </View>
                      <DateTimePicker
                        display={activeShiftPicker.mode === 'date' ? 'inline' : 'spinner'}
                        mode={activeShiftPicker.mode}
                        onChange={handleIosShiftPickerChange}
                        themeVariant="dark"
                        value={activeShiftPickerValue}
                      />
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.shiftEditorActions,
                      isVeryCompactWidth ? styles.shiftEditorActionsStacked : null,
                    ]}
                  >
                    <PrimaryButton
                      disabled={isSavingShiftAction}
                      fullWidth={isVeryCompactWidth}
                      onPress={() => {
                        void saveShiftForm();
                      }}
                      title={isSavingShiftAction ? 'Saving...' : 'Save Shift'}
                      variant="success"
                    />
                    <PrimaryButton
                      fullWidth={isVeryCompactWidth}
                      onPress={closeForm}
                      title="Cancel"
                      variant="neutral"
                    />
                  </View>
                </View>
              ) : null}

              <View
                style={[styles.shiftHeaderRow, isCompactWidth ? styles.shiftHeaderRowCompact : null]}
              >
                <Text style={styles.sectionTitle}>Shift Logs</Text>
                <View style={styles.shiftHeaderActions}>
                  <Pressable
                    onPress={() => {
                      markActivity();
                      openAddShiftForm();
                    }}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>Add Shift</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      markActivity();
                      setShowAllShiftLogs((current) => !current);
                    }}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>
                      {showAllShiftLogs ? 'Show Selected' : 'Show All'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      markActivity();
                      setExpandedEmployeeId(null);
                    }}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>Clear</Text>
                  </Pressable>
                </View>
              </View>

              {visibleShiftGroups.length === 0 ? (
                <Text style={styles.emptyText}>
                  Select an employee row above or choose "Show All".
                </Text>
              ) : (
                visibleShiftGroups.map((employee) => (
                  <View key={employee.employeeId} style={styles.shiftEmployeeBlock}>
                    <Text style={styles.shiftEmployeeTitle}>
                      {employee.employeeName} - {formatHours(employee.totalHours)}
                    </Text>
                    {employee.shifts.map((shift, index) => (
                      <View
                        key={`${employee.employeeId}-${shift.clockInTimestamp ?? 'no-in'}-${index}`}
                      style={styles.shiftCompactRow}
                    >
                        <Text
                          style={[
                            styles.shiftStatusBadge,
                            shift.status === 'COMPLETE'
                              ? styles.shiftStatusComplete
                              : shift.status === 'OPEN'
                                ? styles.shiftStatusOpen
                                : styles.shiftStatusUnmatched,
                          ]}
                        >
                          {shift.status}
                        </Text>
                        <Text style={styles.shiftWindowText}>{formatShiftWindow(shift)}</Text>
                        {shift.clockOutSource === 'AUTO' ? (
                          <Text style={styles.autoTag}>AUTO OUT</Text>
                        ) : null}
                        {shift.adminTag && shift.adminTag !== 'NONE' ? (
                          <Text style={styles.editTag}>{shift.adminTag}</Text>
                        ) : null}
                        {shift.lastEditedAt ? (
                          <Text style={styles.editTime}>
                            Edit: {formatEditedTime(shift.lastEditedAt)}
                          </Text>
                        ) : null}
                        <Text style={styles.shiftHoursText}>
                          {formatHours(shift.durationHours)}
                        </Text>
                        <View style={styles.shiftActionRow}>
                          {(shift.clockInEventId || shift.clockOutEventId) &&
                          shift.status !== 'UNMATCHED_OUT' ? (
                            <Pressable
                              onPress={() => {
                                markActivity();
                                openEditShiftForm(employee.employeeId, employee.employeeName, shift);
                              }}
                              style={styles.shiftInlineButton}
                            >
                              <Text style={styles.shiftInlineButtonText}>
                                {shift.status === 'OPEN' ? 'Close/Edit' : 'Edit'}
                              </Text>
                            </Pressable>
                          ) : null}
                          {(shift.clockInEventId || shift.clockOutEventId) ? (
                            <Pressable
                              onPress={() => {
                                markActivity();
                                confirmDeleteShift(employee.employeeId, employee.employeeName, shift);
                              }}
                              style={[styles.shiftInlineButton, styles.shiftInlineDeleteButton]}
                            >
                              <Text
                                style={[
                                  styles.shiftInlineButtonText,
                                  styles.shiftInlineDeleteButtonText,
                                ]}
                              >
                                Delete
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </View>

            {state.summary.warnings.length > 0 ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Data Warnings</Text>
                {state.summary.warnings.map((warning, index) => (
                  <Text key={`${warning}-${index}`} style={styles.warningText}>
                    {`- ${warning}`}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {actionMessage ? <Text style={styles.successText}>{actionMessage}</Text> : null}
        {!isLoading && error ? <Text style={styles.errorText}>{error}</Text> : null}
    </AdminScrollContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  compactNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  compactNavButtonDisabled: {
    opacity: 0.45,
  },
  compactNavText: {
    ...typography.label,
    color: colors.textPrimary,
  },
  compactNavTextDisabled: {
    color: colors.textSecondary,
  },
  compactRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  compactRowLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  compactRowValue: {
    ...typography.label,
    color: colors.textPrimary,
  },
  content: {
    gap: spacing.sm,
  },
  dualCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    minWidth: 280,
    padding: spacing.md,
  },
  dualColumnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  employeeChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  employeeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  employeeChipText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  employeeChipTextActive: {
    color: colors.textInverse,
  },
  employeePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  employeeRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  employeeRowLine: {
    color: colors.textPrimary,
    flex: 1,
  },
  employeeRowName: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  employeeRowSummary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  employeeRowSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  editTag: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  editTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
  },
  compactActionButton: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  inlineActionButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inlineActionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  inlineActionText: {
    ...typography.caption,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  inlineActionTextActive: {
    color: colors.textInverse,
  },
  inlineLinkButton: {
    marginTop: spacing.sm,
  },
  inlineLinkText: {
    ...typography.caption,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 150,
    padding: spacing.sm,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  metricsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodLine: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  periodMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  periodNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickHistoryChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickHistoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickHistoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  quickHistoryText: {
    ...typography.caption,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  quickHistoryTextActive: {
    color: colors.textInverse,
  },
  shiftActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  fieldPreview: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  dateTimeFieldButton: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 140,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dateTimeFieldButtonActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  dateTimeFieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  dateTimeFieldValue: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  dateTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dateTimeRowCompact: {
    flexDirection: 'column',
  },
  durationPreview: {
    ...typography.label,
    color: colors.success,
    marginTop: spacing.sm,
  },
  durationPreviewError: {
    color: colors.danger,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickerPanel: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  pickerPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  pickerPanelTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  quickAdjustButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickAdjustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  quickAdjustText: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  shiftCompactRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shiftEditorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shiftEditorActionsStacked: {
    flexDirection: 'column',
  },
  shiftEditorCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  shiftEditorMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  shiftEmployeeBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  shiftEmployeeTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  shiftHeaderActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  shiftHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shiftHeaderRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  shiftHoursText: {
    ...typography.caption,
    color: colors.textPrimary,
    marginLeft: 'auto',
  },
  shiftStatusBadge: {
    ...typography.caption,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    textTransform: 'uppercase',
  },
  shiftStatusComplete: {
    backgroundColor: colors.successMuted,
    color: colors.success,
  },
  shiftStatusOpen: {
    backgroundColor: colors.warningMuted,
    color: colors.warning,
  },
  shiftStatusUnmatched: {
    backgroundColor: colors.dangerMuted,
    color: colors.danger,
  },
  shiftInlineButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  shiftInlineButtonText: {
    ...typography.caption,
    color: colors.primary,
  },
  shiftInlineDeleteButton: {
    borderColor: colors.danger,
  },
  shiftInlineDeleteButtonText: {
    color: colors.danger,
  },
  autoTag: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
  },
  shiftWindowText: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  successText: {
    ...typography.label,
    color: colors.success,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  warningCard: {
    backgroundColor: colors.warningMuted,
    borderColor: colors.warningMuted,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
  },
  warningText: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  warningTitle: {
    ...typography.h2,
    color: colors.warning,
  },
});
