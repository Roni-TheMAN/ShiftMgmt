import type {
  PayPeriodLength,
  PayrollSettings,
} from '../repositories/settingsRepository';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PayPeriodPreview = {
  periodStartDate: string;
  periodEndDate: string;
  nextPeriodStartDate: string;
  periodLengthDays: number;
  isFirstPeriod: boolean;
  referenceInPeriod: boolean;
};

function parseIsoDate(value: string) {
  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function addMonthsUtc(date: Date, monthsToAdd: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const firstOfTarget = new Date(Date.UTC(year, month + monthsToAdd, 1));
  const maxDay = new Date(
    Date.UTC(
      firstOfTarget.getUTCFullYear(),
      firstOfTarget.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, maxDay));
  return firstOfTarget;
}

function getFixedCycleDays(payPeriodLength: PayPeriodLength) {
  if (payPeriodLength === 'WEEKLY') {
    return 7;
  }
  if (payPeriodLength === 'BIWEEKLY') {
    return 14;
  }
  return null;
}

function getMonthCycleSize(payPeriodLength: PayPeriodLength) {
  switch (payPeriodLength) {
    case 'MONTHLY':
      return 1;
    case 'QUARTERLY':
      return 3;
    case 'SEMIANNUAL':
      return 6;
    case 'YEARLY':
      return 12;
    default:
      return null;
  }
}

function inclusiveDayLength(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function getPayPeriodPreview(
  settings: PayrollSettings,
  referenceDate = startOfTodayUtc(),
): PayPeriodPreview {
  const referenceUtc = new Date(
    Date.UTC(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    ),
  );
  const start = parseIsoDate(settings.payPeriodStartDate);

  const fixedCycleDays = getFixedCycleDays(settings.payPeriodLength);
  if (fixedCycleDays !== null) {
    const firstCycleDays =
      settings.firstPayrollRunDays && settings.firstPayrollRunDays > 0
        ? Math.min(settings.firstPayrollRunDays, fixedCycleDays)
        : fixedCycleDays;

    const firstEnd = addDaysUtc(start, firstCycleDays - 1);
    if (referenceUtc <= firstEnd || referenceUtc < start) {
      return {
        isFirstPeriod: true,
        nextPeriodStartDate: formatIsoDate(addDaysUtc(firstEnd, 1)),
        periodEndDate: formatIsoDate(firstEnd),
        periodLengthDays: firstCycleDays,
        periodStartDate: formatIsoDate(start),
        referenceInPeriod: referenceUtc >= start && referenceUtc <= firstEnd,
      };
    }

    const secondStart = addDaysUtc(firstEnd, 1);
    const elapsedDays = Math.floor(
      (referenceUtc.getTime() - secondStart.getTime()) / DAY_MS,
    );
    const completedCycles = Math.floor(elapsedDays / fixedCycleDays);
    const currentStart = addDaysUtc(secondStart, completedCycles * fixedCycleDays);
    const currentEnd = addDaysUtc(currentStart, fixedCycleDays - 1);

    return {
      isFirstPeriod: false,
      nextPeriodStartDate: formatIsoDate(addDaysUtc(currentEnd, 1)),
      periodEndDate: formatIsoDate(currentEnd),
      periodLengthDays: fixedCycleDays,
      periodStartDate: formatIsoDate(currentStart),
      referenceInPeriod: true,
    };
  }

  const monthCycleSize = getMonthCycleSize(settings.payPeriodLength) ?? 1;
  let currentStart = start;
  let nextStart = addMonthsUtc(currentStart, monthCycleSize);

  if (referenceUtc >= currentStart) {
    while (referenceUtc >= nextStart) {
      currentStart = nextStart;
      nextStart = addMonthsUtc(currentStart, monthCycleSize);
    }
  }

  const currentEnd = addDaysUtc(nextStart, -1);
  return {
    isFirstPeriod: currentStart.getTime() === start.getTime(),
    nextPeriodStartDate: formatIsoDate(nextStart),
    periodEndDate: formatIsoDate(currentEnd),
    periodLengthDays: inclusiveDayLength(currentStart, currentEnd),
    periodStartDate: formatIsoDate(currentStart),
    referenceInPeriod: referenceUtc >= currentStart && referenceUtc <= currentEnd,
  };
}

export function getPayPeriodPreviewByHistoryOffset(
  settings: PayrollSettings,
  periodsBack: number,
  referenceDate = startOfTodayUtc(),
) {
  const safePeriodsBack = Math.max(0, Math.floor(periodsBack));
  let preview = getPayPeriodPreview(settings, referenceDate);

  for (let i = 0; i < safePeriodsBack; i += 1) {
    const previousReferenceDate = addDaysUtc(parseIsoDate(preview.periodStartDate), -1);
    preview = getPayPeriodPreview(settings, previousReferenceDate);
  }

  return preview;
}
