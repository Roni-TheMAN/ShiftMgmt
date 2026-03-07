import type {
  ClockEventAdminTag,
  ClockEventSource,
  ClockEventWithEmployee,
} from '../../types/database';
import type { PayPeriodPreview } from './payPeriod';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  status: 'COMPLETE' | 'OPEN' | 'UNMATCHED_OUT';
};

export type EmployeeShiftGroup = {
  employeeId: number;
  employeeName: string;
  totalHours: number;
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
  employeeTotals: Array<{
    employeeId: number;
    employeeName: string;
    hours: number;
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
) {
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
            employeeId,
            employeeName,
            status: 'OPEN',
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
          employeeId,
          employeeName,
          status: 'UNMATCHED_OUT',
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
          employeeId,
          employeeName,
          status: 'UNMATCHED_OUT',
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
        employeeId,
        employeeName,
        status: 'COMPLETE',
      });
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
        employeeId,
        employeeName,
        status: 'OPEN',
      });
    }

    employeeTotalsMs.set(employeeId, completedTotalMs);
    shiftsByEmployee.set(employeeId, {
      completedShiftCount,
      employeeId,
      employeeName,
      shifts,
      totalHours: toHours(completedTotalMs),
    });
  }

  const employeeTotals = Array.from(employeeTotalsMs.entries())
    .map(([employeeId, totalMs]) => ({
      completedShiftCount: shiftsByEmployee.get(employeeId)?.completedShiftCount ?? 0,
      employeeId,
      employeeName: employeeNames.get(employeeId) ?? `Employee ${employeeId}`,
      hours: toHours(totalMs),
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
    warnings,
    weekTotals,
  } satisfies PayrollHoursSummary;
}
