import type {
  ClockEventAdminTag,
  ClockEventSource,
  ClockEventWithEmployee,
} from '../../types/database';
import type { PayPeriodPreview } from './payPeriod';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OT1_WEEKLY_THRESHOLD_HOURS = 40;
const DEFAULT_OT1_MULTIPLIER = 1.5;
const DEFAULT_OT2_MULTIPLIER = 2;

export type PayrollCompensationRules = {
  employeeHourlyRates?: Map<number, number>;
  ot1WeeklyThresholdHours?: number;
  ot1Multiplier?: number;
  ot2Multiplier?: number;
  ot2HolidayDates?: string[];
};

export type EmployeeShiftEntry = {
  employeeId: number;
  employeeName: string;
  clockInEventId: number | null;
  clockInTimestamp: string | null;
  clockOutEventId: number | null;
  clockOutTimestamp: string | null;
  clockOutSource: ClockEventSource | null;
  adminTag: ClockEventAdminTag | null;
  lastEditedAt: string | null;
  durationHours: number;
  regularHours: number;
  ot1Hours: number;
  ot2Hours: number;
  weekNumber: number;
  status: 'COMPLETE' | 'OPEN' | 'UNMATCHED_OUT';
};

export type EmployeeShiftGroup = {
  employeeId: number;
  employeeName: string;
  hourlyRate: number;
  totalHours: number;
  regularHours: number;
  ot1Hours: number;
  ot2Hours: number;
  regularPay: number;
  ot1Pay: number;
  ot2Pay: number;
  totalPay: number;
  completedShiftCount: number;
  shifts: EmployeeShiftEntry[];
};

export type PayrollDayTotal = {
  date: string;
  hours: number;
};

export type PayrollWeekTotal = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  hours: number;
};

export type PayrollHoursSummary = {
  totalPeriodHours: number;
  totalPeriodPay: number;
  employeeTotals: Array<{
    employeeId: number;
    employeeName: string;
    hourlyRate: number;
    hours: number;
    regularHours: number;
    ot1Hours: number;
    ot2Hours: number;
    regularPay: number;
    ot1Pay: number;
    ot2Pay: number;
    totalPay: number;
    completedShiftCount: number;
  }>;
  dayTotals: PayrollDayTotal[];
  weekTotals: PayrollWeekTotal[];
  shiftsByEmployee: EmployeeShiftGroup[];
  warnings: string[];
};

function toLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKeyToUtcEpoch(dayKey: string) {
  const [yearPart, monthPart, dayPart] = dayKey.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  return Date.UTC(year, month - 1, day);
}

function addDaysToDayKey(dayKey: string, days: number) {
  const epoch = dayKeyToUtcEpoch(dayKey);
  return new Date(epoch + days * DAY_MS).toISOString().slice(0, 10);
}

function addSegmentDurationByDay(
  start: Date,
  end: Date,
  dayTotalsMs: Map<string, number>,
  periodEndDate?: string,
) {
  let cursor = new Date(start);
  while (cursor < end) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(24, 0, 0, 0);
    const segmentEnd = end < dayEnd ? end : dayEnd;
    const durationMs = segmentEnd.getTime() - cursor.getTime();
    const dayKey = toLocalDayKey(cursor);
    const targetDayKey =
      periodEndDate && dayKey > periodEndDate ? periodEndDate : dayKey;
    dayTotalsMs.set(
      targetDayKey,
      (dayTotalsMs.get(targetDayKey) ?? 0) + durationMs,
    );
    cursor = segmentEnd;
  }
}

function toHours(durationMs: number) {
  return durationMs / (1000 * 60 * 60);
}

function roundHours(value: number) {
  return Number.parseFloat(value.toFixed(4));
}

function roundCurrency(value: number) {
  return Number.parseFloat(value.toFixed(2));
}

function sanitizeHourlyRate(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined || value < 0) {
    return 0;
  }
  return value;
}

function sanitizePositiveNumber(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return fallback;
  }
  return value;
}

function getWeekNumberForDay(dayKey: string, payPeriodStartDate: string) {
  const dayEpoch = dayKeyToUtcEpoch(dayKey);
  const periodStartEpoch = dayKeyToUtcEpoch(payPeriodStartDate);
  const dayOffset = Math.floor((dayEpoch - periodStartEpoch) / DAY_MS);
  return Math.floor(Math.max(0, dayOffset) / 7) + 1;
}

type ShiftDaySegment = {
  shiftIndex: number;
  weekNumber: number;
  dayKey: string;
  hours: number;
  startEpoch: number;
};

function splitShiftIntoDaySegments(
  start: Date,
  end: Date,
  shiftIndex: number,
  payPeriodStartDate: string,
  payPeriodEndDate: string,
) {
  const segments: ShiftDaySegment[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(24, 0, 0, 0);
    const segmentEnd = end < dayEnd ? end : dayEnd;
    const durationMs = segmentEnd.getTime() - cursor.getTime();
    if (durationMs > 0) {
      const rawDayKey = toLocalDayKey(cursor);
      const dayKey = rawDayKey > payPeriodEndDate ? payPeriodEndDate : rawDayKey;
      segments.push({
        dayKey,
        hours: toHours(durationMs),
        shiftIndex,
        startEpoch: cursor.getTime(),
        weekNumber: getWeekNumberForDay(dayKey, payPeriodStartDate),
      });
    }
    cursor = segmentEnd;
  }

  return segments;
}

function pickShiftAdminTag(
  inTag: ClockEventAdminTag | null,
  outTag: ClockEventAdminTag | null,
) {
  if (inTag === 'EDITED' || outTag === 'EDITED') {
    return 'EDITED' as const;
  }
  if (inTag === 'CREATED' || outTag === 'CREATED') {
    return 'CREATED' as const;
  }
  if (inTag === 'NONE' || outTag === 'NONE') {
    return 'NONE' as const;
  }
  return null;
}

function pickLatestEditedAt(inEditedAt: string | null, outEditedAt: string | null) {
  if (!inEditedAt && !outEditedAt) {
    return null;
  }
  if (!inEditedAt) {
    return outEditedAt;
  }
  if (!outEditedAt) {
    return inEditedAt;
  }
  return new Date(inEditedAt).getTime() >= new Date(outEditedAt).getTime()
    ? inEditedAt
    : outEditedAt;
}

export function buildPayrollHoursSummary(
  events: ClockEventWithEmployee[],
  payPeriod: Pick<PayPeriodPreview, 'periodStartDate' | 'periodEndDate'>,
  rules: PayrollCompensationRules = {},
) {
  const hourlyRates = rules.employeeHourlyRates ?? new Map<number, number>();
  const ot1WeeklyThresholdHours = sanitizePositiveNumber(
    rules.ot1WeeklyThresholdHours,
    DEFAULT_OT1_WEEKLY_THRESHOLD_HOURS,
  );
  const ot1Multiplier = sanitizePositiveNumber(
    rules.ot1Multiplier,
    DEFAULT_OT1_MULTIPLIER,
  );
  const ot2Multiplier = sanitizePositiveNumber(
    rules.ot2Multiplier,
    DEFAULT_OT2_MULTIPLIER,
  );
  const holidayDates = new Set(
    (rules.ot2HolidayDates ?? []).filter((dayKey) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey)),
  );

  const warnings: string[] = [];
  const employeeEvents = new Map<number, ClockEventWithEmployee[]>();
  const employeeTotalsMs = new Map<number, number>();
  const employeeNames = new Map<number, string>();
  const dayTotalsMs = new Map<string, number>();
  const shiftsByEmployee = new Map<number, EmployeeShiftGroup>();

  for (const event of events) {
    const bucket = employeeEvents.get(event.employee_id) ?? [];
    bucket.push(event);
    employeeEvents.set(event.employee_id, bucket);
    employeeNames.set(event.employee_id, event.employee_name ?? `Employee ${event.employee_id}`);
  }

  for (const [employeeId, employeeRows] of employeeEvents.entries()) {
    const employeeName = employeeNames.get(employeeId) ?? `Employee ${employeeId}`;
    const shifts: EmployeeShiftEntry[] = [];
    const completedShiftSegments: ShiftDaySegment[] = [];
    let openClockIn: ClockEventWithEmployee | null = null;
    let completedShiftCount = 0;
    let completedTotalMs = 0;

    for (const event of employeeRows) {
      if (event.type === 'IN') {
        if (openClockIn) {
          warnings.push(
            `${employeeName} has consecutive CLOCK IN events without CLOCK OUT.`,
          );
          shifts.push({
            adminTag: openClockIn.admin_tag,
            clockInEventId: openClockIn.id,
            clockInTimestamp: openClockIn.timestamp,
            clockOutEventId: null,
            clockOutTimestamp: null,
            clockOutSource: null,
            lastEditedAt: openClockIn.last_edited_at,
            durationHours: toHours(
              Math.max(0, Date.now() - new Date(openClockIn.timestamp).getTime()),
            ),
            ot1Hours: 0,
            ot2Hours: 0,
            employeeId,
            employeeName,
            regularHours: 0,
            status: 'OPEN',
            weekNumber: getWeekNumberForDay(
              toLocalDayKey(new Date(openClockIn.timestamp)),
              payPeriod.periodStartDate,
            ),
          });
        }
        openClockIn = event;
        continue;
      }

      if (!openClockIn) {
        warnings.push(`${employeeName} has CLOCK OUT without a matching CLOCK IN.`);
        shifts.push({
          adminTag: event.admin_tag,
          clockInEventId: null,
          clockInTimestamp: null,
          clockOutEventId: event.id,
          clockOutTimestamp: event.timestamp,
          clockOutSource: event.source,
          lastEditedAt: event.last_edited_at,
          durationHours: 0,
          ot1Hours: 0,
          ot2Hours: 0,
          employeeId,
          employeeName,
          regularHours: 0,
          status: 'UNMATCHED_OUT',
          weekNumber: getWeekNumberForDay(
            toLocalDayKey(new Date(event.timestamp)),
            payPeriod.periodStartDate,
          ),
        });
        continue;
      }

      const inTime = new Date(openClockIn.timestamp);
      const outTime = new Date(event.timestamp);
      const durationMs = outTime.getTime() - inTime.getTime();
      if (durationMs <= 0) {
        warnings.push(
          `${employeeName} has invalid shift ordering (CLOCK OUT before CLOCK IN).`,
        );
        shifts.push({
          adminTag: pickShiftAdminTag(openClockIn.admin_tag, event.admin_tag),
          clockInEventId: openClockIn.id,
          clockInTimestamp: openClockIn.timestamp,
          clockOutEventId: event.id,
          clockOutTimestamp: event.timestamp,
          clockOutSource: event.source,
          lastEditedAt: pickLatestEditedAt(
            openClockIn.last_edited_at,
            event.last_edited_at,
          ),
          durationHours: 0,
          ot1Hours: 0,
          ot2Hours: 0,
          employeeId,
          employeeName,
          regularHours: 0,
          status: 'UNMATCHED_OUT',
          weekNumber: getWeekNumberForDay(
            toLocalDayKey(new Date(openClockIn.timestamp)),
            payPeriod.periodStartDate,
          ),
        });
        openClockIn = null;
        continue;
      }

      completedShiftCount += 1;
      completedTotalMs += durationMs;
      addSegmentDurationByDay(
        inTime,
        outTime,
        dayTotalsMs,
        payPeriod.periodEndDate,
      );
      const shiftIndex = shifts.length;
      shifts.push({
        adminTag: pickShiftAdminTag(openClockIn.admin_tag, event.admin_tag),
        clockInEventId: openClockIn.id,
        clockInTimestamp: openClockIn.timestamp,
        clockOutEventId: event.id,
        clockOutTimestamp: event.timestamp,
        clockOutSource: event.source,
        lastEditedAt: pickLatestEditedAt(
          openClockIn.last_edited_at,
          event.last_edited_at,
        ),
        durationHours: toHours(durationMs),
        ot1Hours: 0,
        ot2Hours: 0,
        employeeId,
        employeeName,
        regularHours: 0,
        status: 'COMPLETE',
        weekNumber: getWeekNumberForDay(
          toLocalDayKey(inTime),
          payPeriod.periodStartDate,
        ),
      });
      completedShiftSegments.push(
        ...splitShiftIntoDaySegments(
          inTime,
          outTime,
          shiftIndex,
          payPeriod.periodStartDate,
          payPeriod.periodEndDate,
        ),
      );
      openClockIn = null;
    }

    if (openClockIn) {
      warnings.push(`${employeeName} has an open shift with no CLOCK OUT.`);
      shifts.push({
        adminTag: openClockIn.admin_tag,
        clockInEventId: openClockIn.id,
        clockInTimestamp: openClockIn.timestamp,
        clockOutEventId: null,
        clockOutTimestamp: null,
        clockOutSource: null,
        lastEditedAt: openClockIn.last_edited_at,
        durationHours: toHours(
          Math.max(0, Date.now() - new Date(openClockIn.timestamp).getTime()),
        ),
        ot1Hours: 0,
        ot2Hours: 0,
        employeeId,
        employeeName,
        regularHours: 0,
        status: 'OPEN',
        weekNumber: getWeekNumberForDay(
          toLocalDayKey(new Date(openClockIn.timestamp)),
          payPeriod.periodStartDate,
        ),
      });
    }

    const runningWeekHours = new Map<number, number>();
    const orderedSegments = [...completedShiftSegments].sort(
      (a, b) => a.startEpoch - b.startEpoch,
    );

    for (const segment of orderedSegments) {
      const priorWeekHours = runningWeekHours.get(segment.weekNumber) ?? 0;
      let regularHours = 0;
      let ot1Hours = 0;
      let ot2Hours = 0;

      if (holidayDates.has(segment.dayKey)) {
        ot2Hours = segment.hours;
      } else {
        const regularHoursRemaining = Math.max(
          0,
          ot1WeeklyThresholdHours - priorWeekHours,
        );
        regularHours = Math.min(segment.hours, regularHoursRemaining);
        ot1Hours = Math.max(0, segment.hours - regularHours);
      }

      const shift = shifts[segment.shiftIndex];
      if (shift) {
        shift.regularHours = roundHours(shift.regularHours + regularHours);
        shift.ot1Hours = roundHours(shift.ot1Hours + ot1Hours);
        shift.ot2Hours = roundHours(shift.ot2Hours + ot2Hours);
      }

      runningWeekHours.set(segment.weekNumber, priorWeekHours + segment.hours);
    }

    employeeTotalsMs.set(employeeId, completedTotalMs);
    const hourlyRate = sanitizeHourlyRate(hourlyRates.get(employeeId));
    const regularHours = roundHours(
      shifts.reduce((sum, shift) => sum + shift.regularHours, 0),
    );
    const ot1Hours = roundHours(shifts.reduce((sum, shift) => sum + shift.ot1Hours, 0));
    const ot2Hours = roundHours(shifts.reduce((sum, shift) => sum + shift.ot2Hours, 0));
    const regularPay = roundCurrency(regularHours * hourlyRate);
    const ot1Pay = roundCurrency(ot1Hours * hourlyRate * ot1Multiplier);
    const ot2Pay = roundCurrency(ot2Hours * hourlyRate * ot2Multiplier);
    const totalPay = roundCurrency(regularPay + ot1Pay + ot2Pay);

    shiftsByEmployee.set(employeeId, {
      completedShiftCount,
      employeeId,
      employeeName,
      hourlyRate,
      ot1Hours,
      ot1Pay,
      ot2Hours,
      ot2Pay,
      regularHours,
      regularPay,
      shifts,
      totalHours: toHours(completedTotalMs),
      totalPay,
    });
  }

  const employeeTotals = Array.from(employeeTotalsMs.entries())
    .map(([employeeId, totalMs]) => ({
      completedShiftCount: shiftsByEmployee.get(employeeId)?.completedShiftCount ?? 0,
      employeeId,
      employeeName: employeeNames.get(employeeId) ?? `Employee ${employeeId}`,
      hours: toHours(totalMs),
      hourlyRate: shiftsByEmployee.get(employeeId)?.hourlyRate ?? 0,
      ot1Hours: shiftsByEmployee.get(employeeId)?.ot1Hours ?? 0,
      ot1Pay: shiftsByEmployee.get(employeeId)?.ot1Pay ?? 0,
      ot2Hours: shiftsByEmployee.get(employeeId)?.ot2Hours ?? 0,
      ot2Pay: shiftsByEmployee.get(employeeId)?.ot2Pay ?? 0,
      regularHours: shiftsByEmployee.get(employeeId)?.regularHours ?? 0,
      regularPay: shiftsByEmployee.get(employeeId)?.regularPay ?? 0,
      totalPay: shiftsByEmployee.get(employeeId)?.totalPay ?? 0,
    }))
    .sort((a, b) => b.hours - a.hours || a.employeeName.localeCompare(b.employeeName));

  const dayTotals = Array.from(dayTotalsMs.entries())
    .map(([date, durationMs]) => ({
      date,
      hours: toHours(durationMs),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const periodStartEpoch = dayKeyToUtcEpoch(payPeriod.periodStartDate);
  const periodEndEpoch = dayKeyToUtcEpoch(payPeriod.periodEndDate);
  const totalWeeksInPeriod =
    Math.floor((periodEndEpoch - periodStartEpoch) / DAY_MS / 7) + 1;
  const weekTotalsMs = new Map<number, number>();

  for (const dayTotal of dayTotals) {
    const dayEpoch = dayKeyToUtcEpoch(dayTotal.date);
    const dayOffset = Math.floor((dayEpoch - periodStartEpoch) / DAY_MS);
    if (dayOffset < 0) {
      continue;
    }
    const weekNumber = Math.floor(dayOffset / 7) + 1;
    weekTotalsMs.set(
      weekNumber,
      (weekTotalsMs.get(weekNumber) ?? 0) + dayTotal.hours * 60 * 60 * 1000,
    );
  }

  const weekTotals: PayrollWeekTotal[] = [];
  for (let weekNumber = 1; weekNumber <= totalWeeksInPeriod; weekNumber += 1) {
    const weekStartDate = addDaysToDayKey(payPeriod.periodStartDate, (weekNumber - 1) * 7);
    const weekEndCandidate = addDaysToDayKey(weekStartDate, 6);
    const endDate =
      dayKeyToUtcEpoch(weekEndCandidate) > periodEndEpoch
        ? payPeriod.periodEndDate
        : weekEndCandidate;

    weekTotals.push({
      endDate,
      hours: toHours(weekTotalsMs.get(weekNumber) ?? 0),
      startDate: weekStartDate,
      weekNumber,
    });
  }

  const shiftsByEmployeeList = Array.from(shiftsByEmployee.values()).sort(
    (a, b) => b.totalHours - a.totalHours || a.employeeName.localeCompare(b.employeeName),
  );

  return {
    dayTotals,
    employeeTotals,
    shiftsByEmployee: shiftsByEmployeeList,
    totalPeriodHours: employeeTotals.reduce((sum, item) => sum + item.hours, 0),
    totalPeriodPay: employeeTotals.reduce((sum, item) => sum + item.totalPay, 0),
    warnings,
    weekTotals,
  } satisfies PayrollHoursSummary;
}
