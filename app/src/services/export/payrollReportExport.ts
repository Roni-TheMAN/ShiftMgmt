import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { PayrollHoursSummary } from '../payroll/hoursAggregation';

const DAY_MS = 24 * 60 * 60 * 1000;
const LANDSCAPE_PAGE_WIDTH = 842;
const LANDSCAPE_PAGE_HEIGHT = 595;

// Tune these two if your printer/PDF engine renders slightly differently.
const FIRST_PAGE_DETAIL_BODY_HEIGHT = 175;
const CONTINUATION_PAGE_DETAIL_BODY_HEIGHT = 360;
const DETAIL_TOTAL_ROW_ESTIMATED_HEIGHT = 24;

type PayrollReportSchedule = {
  payPeriodLength: string;
  payPeriodStartDate: string;
  payPeriodStartDay: string;
  firstPayrollRunDays: number | null;
  ot1WeeklyThresholdHours: number;
  ot1Multiplier: number;
  ot2Multiplier: number;
  ot2HolidayDates: string[];
};

type PayrollReportPeriod = {
  periodStartDate: string;
  periodEndDate: string;
  periodLengthDays: number;
};

type EmployeeShiftGroup = PayrollHoursSummary['shiftsByEmployee'][number];

type EmployeeBreakdown = {
  dayTotals: Array<{ date: string; hours: number }>;
  weekTotals: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    hours: number;
  }>;
};

type ShiftDetailRowModel = {
  dateLabel: string;
  clockInLabel: string;
  clockOutLabel: string;
  recordedHours: number;
  dailyHours: number;
  regularHours: number;
  ot1Hours: number;
  ot2Hours: number;
  weeklyTotal: number;
  status: 'COMPLETE' | 'OPEN' | 'UNMATCHED_OUT';
  punchInfo: string;
  estimatedHeight: number;
};

type ShiftDetailChunk = {
  rows: ShiftDetailRowModel[];
  includeTotals: boolean;
  isContinuation: boolean;
  usedHeight: number;
};

export type ExportPayrollPeriodReportParams = {
  businessName: string;
  propertyAddress: string;
  propertyDetails: string;
  periodLabel: string;
  payPeriod: PayrollReportPeriod;
  schedule: PayrollReportSchedule;
  summary: PayrollHoursSummary;
};

function escapeHtml(value: string) {
  return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
}

function formatNumber(value: number) {
  return value.toFixed(2);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatWeekdayShort(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function formatCalendarDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateWithWeekday(date: Date) {
  return `${formatCalendarDate(date)} (${formatWeekdayShort(date)})`;
}

function getTotalWeeksInPayPeriod(payPeriod: PayrollReportPeriod) {
  const periodStartEpoch = dayKeyToUtcEpoch(payPeriod.periodStartDate);
  const periodEndEpoch = dayKeyToUtcEpoch(payPeriod.periodEndDate);
  return Math.floor((periodEndEpoch - periodStartEpoch) / DAY_MS / 7) + 1;
}

function getPayPeriodWeekNumber(dayKey: string, payPeriod: PayrollReportPeriod) {
  const periodStartEpoch = dayKeyToUtcEpoch(payPeriod.periodStartDate);
  const dayEpoch = dayKeyToUtcEpoch(dayKey);
  const dayOffset = Math.floor((dayEpoch - periodStartEpoch) / DAY_MS);
  const rawWeekNumber = dayOffset < 0 ? 1 : Math.floor(dayOffset / 7) + 1;
  return Math.min(Math.max(rawWeekNumber, 1), getTotalWeeksInPayPeriod(payPeriod));
}

function formatPayPeriodWeekLabel(dayKey: string, payPeriod: PayrollReportPeriod) {
  return `W${getPayPeriodWeekNumber(dayKey, payPeriod)}`;
}

function formatDateWithPayPeriodWeek(date: Date, payPeriod: PayrollReportPeriod) {
  return `${formatDateWithWeekday(date)} - ${formatPayPeriodWeekLabel(
      toLocalDayKey(date),
      payPeriod,
  )}`;
}

function formatDay(dayKey: string, payPeriod?: PayrollReportPeriod) {
  const date = new Date(`${dayKey}T00:00:00`);
  return payPeriod
      ? formatDateWithPayPeriodWeek(date, payPeriod)
      : formatDateWithWeekday(date);
}

function formatDateOnly(
    isoTimestamp: string | null,
    payPeriod?: PayrollReportPeriod,
) {
  if (!isoTimestamp) {
    return '-';
  }

  const date = new Date(isoTimestamp);
  return payPeriod
      ? formatDateWithPayPeriodWeek(date, payPeriod)
      : formatDateWithWeekday(date);
}

function formatTimeOnly(isoTimestamp: string | null) {
  if (!isoTimestamp) {
    return '-';
  }
  return new Date(isoTimestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPunchDisplayContext(
    isoTimestamp: string,
    payPeriod: PayrollReportPeriod,
) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const dayKey = toLocalDayKey(date);
  return {
    dayKey,
    weekday: formatWeekdayShort(date),
    weekLabel: formatPayPeriodWeekLabel(dayKey, payPeriod),
  };
}

function formatClockInTime(
    clockInTimestamp: string | null,
    clockOutTimestamp: string | null,
    payPeriod: PayrollReportPeriod,
) {
  if (!clockInTimestamp) {
    return '-';
  }

  const formattedInTime = formatTimeOnly(clockInTimestamp);
  if (!clockOutTimestamp) {
    return formattedInTime;
  }

  const inContext = getPunchDisplayContext(clockInTimestamp, payPeriod);
  const outContext = getPunchDisplayContext(clockOutTimestamp, payPeriod);
  if (!inContext || !outContext) {
    return formattedInTime;
  }

  if (inContext.weekLabel === outContext.weekLabel) {
    return formattedInTime;
  }

  return `${formattedInTime} (${inContext.weekday} - ${inContext.weekLabel})`;
}

function formatClockOutTime(
    clockInTimestamp: string | null,
    clockOutTimestamp: string | null,
    payPeriod: PayrollReportPeriod,
) {
  if (!clockOutTimestamp) {
    return '-';
  }

  const formattedOutTime = formatTimeOnly(clockOutTimestamp);
  if (!clockInTimestamp) {
    return formattedOutTime;
  }

  const inContext = getPunchDisplayContext(clockInTimestamp, payPeriod);
  const outContext = getPunchDisplayContext(clockOutTimestamp, payPeriod);
  if (!inContext || !outContext) {
    return formattedOutTime;
  }

  if (inContext.weekLabel !== outContext.weekLabel) {
    return `${formattedOutTime} (${outContext.weekday} - ${outContext.weekLabel})`;
  }

  if (inContext.dayKey === outContext.dayKey) {
    return formattedOutTime;
  }

  return `${formattedOutTime} (${outContext.weekday})`;
}

function formatDateTime(isoTimestamp: string) {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPeriodBoundary(dayKey: string, isEnd: boolean) {
  const [yearPart, monthPart, dayPart] = dayKey.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const date = isEnd
      ? new Date(year, month - 1, day, 23, 59, 0, 0)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

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
    periodEndDate: string,
) {
  let cursor = new Date(start);
  while (cursor < end) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(24, 0, 0, 0);
    const segmentEnd = end < dayEnd ? end : dayEnd;
    const durationMs = segmentEnd.getTime() - cursor.getTime();
    const dayKey = toLocalDayKey(cursor);
    const targetDayKey = dayKey > periodEndDate ? periodEndDate : dayKey;
    dayTotalsMs.set(
        targetDayKey,
        (dayTotalsMs.get(targetDayKey) ?? 0) + durationMs,
    );
    cursor = segmentEnd;
  }
}

function getEmployeeOt2DayKeys(
    employee: EmployeeShiftGroup,
    payPeriod: PayrollReportPeriod,
    ot2HolidayDates: string[],
) {
  const ot2HolidaySet = new Set(ot2HolidayDates);
  const ot2DayKeys = new Set<string>();

  for (const shift of employee.shifts) {
    if (
        shift.status !== 'COMPLETE' ||
        shift.ot2Hours <= 0 ||
        !shift.clockInTimestamp ||
        !shift.clockOutTimestamp
    ) {
      continue;
    }

    const start = new Date(shift.clockInTimestamp);
    const end = new Date(shift.clockOutTimestamp);
    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
      continue;
    }

    let cursor = new Date(start);
    while (cursor < end) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(24, 0, 0, 0);
      const segmentEnd = end < dayEnd ? end : dayEnd;
      const rawDayKey = toLocalDayKey(cursor);
      const dayKey = rawDayKey > payPeriod.periodEndDate ? payPeriod.periodEndDate : rawDayKey;
      if (
          dayKey >= payPeriod.periodStartDate &&
          ot2HolidaySet.has(dayKey)
      ) {
        ot2DayKeys.add(dayKey);
      }
      cursor = segmentEnd;
    }
  }

  return ot2DayKeys;
}

function toHours(durationMs: number) {
  return durationMs / (1000 * 60 * 60);
}

function getStatusClass(status: 'COMPLETE' | 'OPEN' | 'UNMATCHED_OUT') {
  if (status === 'COMPLETE') {
    return 'status-complete';
  }
  if (status === 'OPEN') {
    return 'status-open';
  }
  return 'status-unmatched';
}

function getPayClassLabel(payPeriodLength: string) {
  switch (payPeriodLength) {
    case 'WEEKLY':
      return 'WKLY';
    case 'BIWEEKLY':
      return 'BIWK';
    case 'MONTHLY':
      return 'MNTH';
    case 'QUARTERLY':
      return 'QTR';
    case 'SEMIANNUAL':
      return 'SEMI';
    case 'YEARLY':
      return 'YRLY';
    default:
      return payPeriodLength;
  }
}

function getEmployeeBreakdown(
    employee: EmployeeShiftGroup,
    payPeriod: PayrollReportPeriod,
): EmployeeBreakdown {
  const dayTotalsMs = new Map<string, number>();
  for (const shift of employee.shifts) {
    if (
        shift.status !== 'COMPLETE' ||
        !shift.clockInTimestamp ||
        !shift.clockOutTimestamp
    ) {
      continue;
    }

    const inTime = new Date(shift.clockInTimestamp);
    const outTime = new Date(shift.clockOutTimestamp);
    if (
        Number.isNaN(inTime.getTime()) ||
        Number.isNaN(outTime.getTime()) ||
        outTime <= inTime
    ) {
      continue;
    }

    addSegmentDurationByDay(
        inTime,
        outTime,
        dayTotalsMs,
        payPeriod.periodEndDate,
    );
  }

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

  const weekTotals: EmployeeBreakdown['weekTotals'] = [];
  for (let weekNumber = 1; weekNumber <= totalWeeksInPeriod; weekNumber += 1) {
    const weekStartDate = addDaysToDayKey(
        payPeriod.periodStartDate,
        (weekNumber - 1) * 7,
    );
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

  return {
    dayTotals,
    weekTotals,
  };
}

function estimateWrappedLines(text: string, charsPerLine: number) {
  if (!text || text.trim() === '' || text === '-') {
    return 1;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  return Math.max(1, Math.ceil(normalized.length / charsPerLine));
}

function estimateShiftDetailRowHeight(
    row: Omit<ShiftDetailRowModel, 'estimatedHeight'>,
) {
  const dateLines = estimateWrappedLines(row.dateLabel, 24);
  const inLines = estimateWrappedLines(row.clockInLabel, 16);
  const outLines = estimateWrappedLines(row.clockOutLabel, 16);
  const statusLines = estimateWrappedLines(row.status, 12);
  const punchLines = estimateWrappedLines(row.punchInfo, 22);

  const maxLines = Math.max(dateLines, inLines, outLines, statusLines, punchLines, 1);

  return 22 + (maxLines - 1) * 10;
}

function buildShiftDetailRowModels(
    employee: EmployeeShiftGroup,
    payPeriod: PayrollReportPeriod,
): ShiftDetailRowModel[] {
  const runningWeekHours = new Map<number, number>();

  const sortedShifts = [...employee.shifts].sort((a, b) => {
    const aAnchor = a.clockInTimestamp ?? a.clockOutTimestamp ?? '';
    const bAnchor = b.clockInTimestamp ?? b.clockOutTimestamp ?? '';
    return aAnchor.localeCompare(bAnchor);
  });

  return sortedShifts.map((shift) => {
    const recordedHours = shift.status === 'COMPLETE' ? shift.durationHours : 0;
    const anchorTimestamp = shift.clockInTimestamp ?? shift.clockOutTimestamp;

    let weeklyTotal = 0;
    if (anchorTimestamp && recordedHours > 0) {
      const anchorDayKey = toLocalDayKey(new Date(anchorTimestamp));
      const weekNumber = getPayPeriodWeekNumber(anchorDayKey, payPeriod);
      weeklyTotal = (runningWeekHours.get(weekNumber) ?? 0) + recordedHours;
      runningWeekHours.set(weekNumber, weeklyTotal);
    }

    const punchInfoParts = [];
    if (shift.clockOutSource === 'AUTO') {
      punchInfoParts.push('AUTO OUT');
    }
    if (shift.ot2Hours > 0) {
      punchInfoParts.push('OT2 APPLIED');
    }
    if (shift.adminTag && shift.adminTag !== 'NONE') {
      punchInfoParts.push(shift.adminTag);
    }

    const rowBase = {
      dateLabel: formatDateOnly(anchorTimestamp ?? null, payPeriod),
      clockInLabel: formatClockInTime(
          shift.clockInTimestamp,
          shift.clockOutTimestamp,
          payPeriod,
      ),
      clockOutLabel: formatClockOutTime(
          shift.clockInTimestamp,
          shift.clockOutTimestamp,
          payPeriod,
      ),
      recordedHours,
      dailyHours: recordedHours,
      regularHours: shift.regularHours,
      ot1Hours: shift.ot1Hours,
      ot2Hours: shift.ot2Hours,
      weeklyTotal,
      status: shift.status,
      punchInfo: punchInfoParts.length > 0 ? punchInfoParts.join(' | ') : '-',
    };

    return {
      ...rowBase,
      estimatedHeight: estimateShiftDetailRowHeight(rowBase),
    };
  });
}

function paginateShiftDetailRows(
    rows: ShiftDetailRowModel[],
): ShiftDetailChunk[] {
  if (rows.length === 0) {
    return [
      {
        rows: [],
        includeTotals: true,
        isContinuation: false,
        usedHeight: 0,
      },
    ];
  }

  const chunks: ShiftDetailChunk[] = [];
  let index = 0;
  let isFirstPage = true;

  while (index < rows.length) {
    const budget = isFirstPage
        ? FIRST_PAGE_DETAIL_BODY_HEIGHT
        : CONTINUATION_PAGE_DETAIL_BODY_HEIGHT;

    let usedHeight = 0;
    const chunkRows: ShiftDetailRowModel[] = [];

    while (index < rows.length) {
      const row = rows[index];
      const remainingRowsAfterThis = rows.length - (index + 1);
      const reserveForTotals =
          remainingRowsAfterThis === 0 ? DETAIL_TOTAL_ROW_ESTIMATED_HEIGHT : 0;

      if (
          chunkRows.length > 0 &&
          usedHeight + row.estimatedHeight + reserveForTotals > budget
      ) {
        break;
      }

      chunkRows.push(row);
      usedHeight += row.estimatedHeight;
      index += 1;

      if (
          chunkRows.length === 1 &&
          usedHeight + reserveForTotals > budget
      ) {
        break;
      }
    }

    chunks.push({
      rows: chunkRows,
      includeTotals: index >= rows.length,
      isContinuation: !isFirstPage,
      usedHeight,
    });

    isFirstPage = false;
  }

  return chunks;
}

function renderShiftDetailRows(rows: ShiftDetailRowModel[]) {
  if (rows.length === 0) {
    return '<tr><td colspan="11" class="empty-row">No shift records for this employee in this period.</td></tr>';
  }

  return rows
      .map(
          (row) => `<tr>
  <td>${escapeHtml(row.dateLabel)}</td>
  <td>${escapeHtml(row.clockInLabel)}</td>
  <td>${escapeHtml(row.clockOutLabel)}</td>
  <td class="number">${formatNumber(row.recordedHours)}</td>
  <td class="number">${formatNumber(row.dailyHours)}</td>
  <td class="number">${formatNumber(row.regularHours)}</td>
  <td class="number">${formatNumber(row.ot1Hours)}</td>
  <td class="number">${formatNumber(row.ot2Hours)}</td>
  <td class="number">${formatNumber(row.weeklyTotal)}</td>
  <td><span class="status ${getStatusClass(row.status)}">${row.status}</span></td>
  <td>${escapeHtml(row.punchInfo)}</td>
</tr>`,
      )
      .join('\n');
}

function renderShiftDetailTable(params: {
  employee: EmployeeShiftGroup;
  periodLabel: string;
  rows: ShiftDetailRowModel[];
  includeTotals: boolean;
}) {
  const { employee, periodLabel, rows, includeTotals } = params;
  const rowsHtml = renderShiftDetailRows(rows);

  const totalsHtml = includeTotals
      ? `<tr class="totals-row">
  <td colspan="4"><strong>Pay Period Totals</strong></td>
  <td class="number"><strong>${formatNumber(employee.totalHours)}</strong></td>
  <td class="number"><strong>${formatNumber(employee.regularHours)}</strong></td>
  <td class="number"><strong>${formatNumber(employee.ot1Hours)}</strong></td>
  <td class="number"><strong>${formatNumber(employee.ot2Hours)}</strong></td>
  <td class="number"><strong>${formatNumber(employee.totalHours)}</strong></td>
  <td colspan="2"></td>
</tr>`
      : '';

  return `<table class="detail-table">
  <colgroup>
    <col class="col-date" />
    <col class="col-time" />
    <col class="col-time" />
    <col class="col-hours" />
    <col class="col-hours" />
    <col class="col-hours" />
    <col class="col-hours" />
    <col class="col-hours" />
    <col class="col-weekly" />
    <col class="col-status" />
    <col class="col-punch" />
  </colgroup>
  <thead>
    <tr class="detail-repeat-gap">
      <th colspan="11"></th>
    </tr>
    <tr class="detail-repeat-title">
      <th colspan="11">
        Shift Detail — ${escapeHtml(employee.employeeName)} — ${escapeHtml(periodLabel)}
      </th>
    </tr>
    <tr class="detail-column-head">
      <th>Date</th>
      <th>In</th>
      <th>Out</th>
      <th class="number">In/Out</th>
      <th class="number">Daily</th>
      <th class="number">REG</th>
      <th class="number">OT1</th>
      <th class="number">OT2</th>
      <th class="number">Weekly Total</th>
      <th>Status</th>
      <th>Punch Info</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${totalsHtml}
  </tbody>
</table>`;
}

function renderWarningsSection(employeeWarnings: string[]) {
  if (employeeWarnings.length === 0) {
    return '';
  }

  return `<section class="section section-compact">
    <h2 class="section-title">Data Warnings</h2>
    <ul>${employeeWarnings
      .map((warning) => `<li>${escapeHtml(warning)}</li>`)
      .join('')}</ul>
  </section>`;
}

function buildPayrollReportHtml(params: ExportPayrollPeriodReportParams) {
  const generatedAt = new Date().toISOString();
  const generatedAtLabel = formatDateTime(generatedAt);
  const employeeCount = params.summary.shiftsByEmployee.length;
  const firstRunOverrideLabel = params.schedule.firstPayrollRunDays
      ? `${params.schedule.firstPayrollRunDays} day(s)`
      : 'None';
  const payClass = getPayClassLabel(params.schedule.payPeriodLength);
  const businessName = params.businessName.trim();
  const propertyAddress = params.propertyAddress.trim();
  const propertyDetails = params.propertyDetails.trim();
  const businessNameHtml = businessName
      ? `<p class="business-name">${escapeHtml(businessName)}</p>`
      : '';
  const propertyAddressHtml = propertyAddress
      ? `<p class="property-meta">${escapeHtml(propertyAddress)}</p>`
      : '';
  const propertyDetailsHtml = propertyDetails
      ? `<p class="property-meta property-meta-secondary">${escapeHtml(propertyDetails)}</p>`
      : '';
  const propertyHeaderHtml = [businessNameHtml, propertyAddressHtml, propertyDetailsHtml]
      .filter((value) => value.length > 0)
      .join('\n');

  if (employeeCount === 0) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payroll Report</title>
  <style>
    @page {
      margin: 12mm;
      size: A4 landscape;
    }
    body {
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      margin: 0;
      padding: 0;
    }
    .empty-state {
      border: 1px solid #2f2f2f;
      margin: 0 auto;
      max-width: 240mm;
      padding: 10mm;
    }
    .business-name {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin: 0 0 4px;
      text-align: center;
      text-transform: uppercase;
    }
    .property-meta {
      color: #3f3f3f;
      font-size: 11px;
      margin: 0 0 4px;
      text-align: center;
    }
    .property-meta-secondary {
      margin-bottom: 8px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 8px;
      text-align: center;
      text-transform: uppercase;
    }
    p {
      margin: 0;
      text-align: center;
    }
  </style>
</head>
<body>
  <section class="empty-state">
    ${propertyHeaderHtml}
    <h1>Detail Payroll Report</h1>
    <p>No employee data was found for this pay period.</p>
  </section>
</body>
</html>`;
  }

  const employeePages = params.summary.shiftsByEmployee
      .map((employee, index) => {
        const breakdown = getEmployeeBreakdown(employee, params.payPeriod);
        const ot2DayKeys = getEmployeeOt2DayKeys(
            employee,
            params.payPeriod,
            params.schedule.ot2HolidayDates,
        );
        const ot1Hours = employee.ot1Hours;
        const ot2Hours = employee.ot2Hours;
        const regHours = employee.regularHours;
        const hourlyRateLabel = employee.hasMultipleRates
            ? `${formatCurrency(employee.minHourlyRate)} - ${formatCurrency(employee.maxHourlyRate)}`
            : formatCurrency(employee.hourlyRate);
        const totalAmount = employee.totalPay;
        const employeeWarnings = params.summary.warnings.filter((warning) =>
            warning.includes(employee.employeeName),
        );
        const payBreakdowns =
            employee.rateBreakdowns.length > 0
                ? employee.rateBreakdowns
                : [
                    {
                      hourlyRate: employee.hourlyRate,
                      ot1Hours,
                      ot1Pay: employee.ot1Pay,
                      ot2Hours,
                      ot2Pay: employee.ot2Pay,
                      regularHours: regHours,
                      regularPay: employee.regularPay,
                      totalPay: employee.totalPay,
                    },
                  ];
        const payTypeRowsHtml = payBreakdowns
            .flatMap((breakdown) => {
              const rows: string[] = [];
              if (breakdown.ot1Hours > 0) {
                rows.push(`<tr>
  <td>OT1</td>
  <td>OT</td>
  <td class="number">${formatNumber(breakdown.hourlyRate)}</td>
  <td class="number">${formatNumber(params.schedule.ot1Multiplier)}</td>
  <td class="number">${formatNumber(breakdown.ot1Hours)}</td>
  <td class="number">${formatCurrency(breakdown.ot1Pay)}</td>
</tr>`);
              }
              if (breakdown.ot2Hours > 0) {
                rows.push(`<tr>
  <td>OT2</td>
  <td>OT</td>
  <td class="number">${formatNumber(breakdown.hourlyRate)}</td>
  <td class="number">${formatNumber(params.schedule.ot2Multiplier)}</td>
  <td class="number">${formatNumber(breakdown.ot2Hours)}</td>
  <td class="number">${formatCurrency(breakdown.ot2Pay)}</td>
</tr>`);
              }
              if (breakdown.regularHours > 0 || rows.length === 0) {
                rows.push(`<tr>
  <td>REG</td>
  <td>REG</td>
  <td class="number">${formatNumber(breakdown.hourlyRate)}</td>
  <td class="number">1.00</td>
  <td class="number">${formatNumber(breakdown.regularHours)}</td>
  <td class="number">${formatCurrency(breakdown.regularPay)}</td>
</tr>`);
              }
              return rows;
            })
            .join('\n') + `
<tr class="totals-row">
  <td colspan="4"><strong>Totals</strong></td>
  <td class="number"><strong>${formatNumber(employee.totalHours)}</strong></td>
  <td class="number"><strong>${formatCurrency(totalAmount)}</strong></td>
</tr>`;

        const dayRowsHtml =
            breakdown.dayTotals.length === 0
                ? '<tr><td colspan="2" class="empty-row">No daily totals.</td></tr>'
                : breakdown.dayTotals
                    .map(
                        (day) => `<tr>
  <td>${escapeHtml(formatDay(day.date, params.payPeriod))}${ot2DayKeys.has(day.date) ? ' <span class="ot2-flag">OT2</span>' : ''}</td>
  <td class="number">${formatNumber(day.hours)}</td>
</tr>`,
                    )
                    .join('\n');

        const weekRowsHtml =
            breakdown.weekTotals.length === 0
                ? '<tr><td colspan="3" class="empty-row">No weekly totals.</td></tr>'
                : breakdown.weekTotals
                    .map(
                        (week) => `<tr>
  <td>Week ${week.weekNumber}</td>
  <td>${escapeHtml(formatDay(week.startDate))} - ${escapeHtml(formatDay(week.endDate))}</td>
  <td class="number">${formatNumber(week.hours)}</td>
</tr>`,
                    )
                    .join('\n');

        const shiftRowModels = buildShiftDetailRowModels(employee, params.payPeriod);
        const shiftChunks = paginateShiftDetailRows(shiftRowModels);
        const warningPageHtml = renderWarningsSection(employeeWarnings);
        const totalPagesForEmployee =
            shiftChunks.length + (warningPageHtml ? 1 : 0);

        const pages: string[] = [];

        shiftChunks.forEach((chunk, chunkIndex) => {
          const pageNumber = chunkIndex + 1;
          const detailTableHtml = renderShiftDetailTable({
            employee,
            periodLabel: params.periodLabel,
            rows: chunk.rows,
            includeTotals: chunk.includeTotals,
          });

          if (chunkIndex === 0) {
            pages.push(`<section class="employee-page ${index === 0 ? 'first' : ''}">
  <header class="header">
    ${propertyHeaderHtml}
    <h1 class="main-title">DETAIL PAYROLL REPORT</h1>
    <div class="header-grid">
      <section class="meta-card">
        <h2 class="meta-title">Employee</h2>
        <p><strong>Name</strong> : ${escapeHtml(employee.employeeName)}</p>
        <p><strong>Employee ID</strong> : ${employee.employeeId}</p>
        <p><strong>Base Hourly</strong> : ${escapeHtml(hourlyRateLabel)}</p>
      </section>
      <section class="meta-card">
        <h2 class="meta-title">Pay Period</h2>
        <p><strong>Pay Class</strong> : ${escapeHtml(payClass)}</p>
        <p><strong>Period Label</strong> : ${escapeHtml(params.periodLabel)}</p>
        <p><strong>From</strong> : ${escapeHtml(formatPeriodBoundary(params.payPeriod.periodStartDate, false))}</p>
        <p><strong>To</strong> : ${escapeHtml(formatPeriodBoundary(params.payPeriod.periodEndDate, true))}</p>
      </section>
      <section class="meta-card">
        <h2 class="meta-title">Schedule</h2>
        <p><strong>Cycle</strong> : ${escapeHtml(params.schedule.payPeriodLength)}</p>
        <p><strong>Start Day</strong> : ${escapeHtml(params.schedule.payPeriodStartDay)}</p>
        <p><strong>Anchor</strong> : ${escapeHtml(params.schedule.payPeriodStartDate)}</p>
        <p><strong>First Run Override</strong> : ${escapeHtml(firstRunOverrideLabel)}</p>
      </section>
      <section class="meta-card">
        <h2 class="meta-title">Overtime</h2>
        <p><strong>OT1</strong> : ${params.schedule.ot1Multiplier.toFixed(2)}x above ${params.schedule.ot1WeeklyThresholdHours}h/week</p>
        <p><strong>OT2</strong> : ${params.schedule.ot2Multiplier.toFixed(2)}x on ${params.schedule.ot2HolidayDates.length} holiday(s)</p>
        <p><strong>Generated</strong> : ${escapeHtml(generatedAtLabel)}</p>
      </section>
    </div>
  </header>

  <section class="section section-compact summary-grid">
    <div class="summary-card summary-pay">
      <h2 class="section-title">Pay Summary</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Pay Type</th>
            <th>Applied As</th>
            <th class="number">Hourly Rate</th>
            <th class="number">Rate Modifier</th>
            <th class="number">Hours</th>
            <th class="number">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${payTypeRowsHtml}
        </tbody>
      </table>
    </div>
    <div class="summary-card">
      <h2 class="section-title">Weekly Totals</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Range</th>
            <th class="number">Hours</th>
          </tr>
        </thead>
        <tbody>
          ${weekRowsHtml}
        </tbody>
      </table>
    </div>
    <div class="summary-card">
      <h2 class="section-title">Daily Totals</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Date</th>
            <th class="number">Hours</th>
          </tr>
        </thead>
        <tbody>
          ${dayRowsHtml}
        </tbody>
      </table>
    </div>
  </section>

  <section class="section section-breakable">
    ${detailTableHtml}
  </section>

  <footer class="footer">
    Employee ${index + 1} of ${employeeCount} • Page ${pageNumber} of ${totalPagesForEmployee}
  </footer>
</section>`);
          } else {
            pages.push(`<section class="employee-page">
  <header class="continuation-header">
    ${propertyHeaderHtml}
    <div class="continuation-title">DETAIL PAYROLL REPORT — CONTINUED</div>
    <div class="continuation-meta">
      ${escapeHtml(employee.employeeName)} • ${escapeHtml(params.periodLabel)} • Page ${pageNumber} of ${totalPagesForEmployee}
    </div>
  </header>

  <section class="section section-breakable continuation-detail-section">
    ${detailTableHtml}
  </section>

  <footer class="footer">
    Employee ${index + 1} of ${employeeCount} • Page ${pageNumber} of ${totalPagesForEmployee}
  </footer>
</section>`);
          }
        });

        if (warningPageHtml) {
          pages.push(`<section class="employee-page">
  <header class="continuation-header">
    ${propertyHeaderHtml}
    <div class="continuation-title">DETAIL PAYROLL REPORT — WARNINGS</div>
    <div class="continuation-meta">
      ${escapeHtml(employee.employeeName)} • ${escapeHtml(params.periodLabel)} • Page ${totalPagesForEmployee} of ${totalPagesForEmployee}
    </div>
  </header>

  ${warningPageHtml}

  <footer class="footer">
    Employee ${index + 1} of ${employeeCount} • Page ${totalPagesForEmployee} of ${totalPagesForEmployee}
  </footer>
</section>`);
        }

        return pages.join('\n');
      })
      .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payroll Report</title>
  <style>
    @page {
      margin: 14mm 10mm 14mm 10mm;
      size: A4 landscape;
    }
    html {
      box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }
    body {
      background: #fff;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11.25px;
      line-height: 1.3;
      margin: 0;
    }
    .employee-page {
      break-inside: avoid;
      break-before: page;
      page-break-inside: avoid;
      page-break-before: always;
      padding: 0 2mm;
      width: 100%;
    }
    .employee-page.first {
      break-before: auto;
      page-break-before: auto;
    }
    .header {
      break-after: avoid;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    .continuation-header {
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    .business-name {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin: 0 0 4px;
      text-align: center;
      text-transform: uppercase;
    }
    .property-meta {
      color: #4a4a4a;
      font-size: 10.5px;
      margin: 0 0 4px;
      text-align: center;
    }
    .property-meta-secondary {
      margin-bottom: 8px;
    }
    .main-title {
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 0.6px;
      margin: 0 0 8px;
      text-align: center;
      text-transform: uppercase;
    }
    .continuation-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.4px;
      margin: 0 0 4px;
      text-align: center;
      text-transform: uppercase;
    }
    .continuation-meta {
      color: #333;
      font-size: 10.5px;
      text-align: center;
    }
    .header-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: 1.15fr 1.15fr 1fr 1fr;
    }
    .meta-card {
      background: #f3f3f3;
      border: 1px solid #2f2f2f;
      break-inside: avoid;
      min-height: 100%;
      page-break-inside: avoid;
      padding: 7px 9px;
    }
    .meta-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0 0 5px;
      text-transform: uppercase;
    }
    .meta-card p {
      margin: 3px 0;
    }
    .section {
      margin-top: 8px;
      page-break-inside: auto;
    }
    .section-compact {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .section-breakable {
      break-inside: auto;
      page-break-inside: auto;
    }
    .continuation-detail-section {
      margin-top: 2px;
    }
    .section-title {
      font-size: 11.5px;
      font-weight: 700;
      margin: 0 0 5px;
      text-transform: uppercase;
    }
    .summary-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: 1.25fr 1fr 1fr;
      align-items: start;
    }
    .summary-card {
      border: 1px solid #2f2f2f;
      break-inside: avoid;
      page-break-inside: avoid;
      padding: 7px 7px 5px;
    }
    .summary-pay {
      background: #fbfbfb;
    }
    table {
      border-collapse: collapse;
      page-break-inside: auto;
      table-layout: fixed;
      width: 100%;
    }
    thead {
      display: table-header-group;
    }
    tbody {
      page-break-inside: auto;
    }
    th,
    td {
      border: 1px solid #2f2f2f;
      overflow-wrap: anywhere;
      padding: 5px 6px;
      vertical-align: top;
    }
    tr {
      page-break-inside: avoid;
    }
    th {
      background: #c8c8c8;
      font-size: 10.5px;
      text-transform: uppercase;
    }
    tr:nth-child(even) td {
      background: #ededed;
    }
    .totals-row td {
      background: #d0d0d0;
      font-weight: 700;
    }
    .number {
      overflow-wrap: normal;
      text-align: right;
      white-space: nowrap;
    }
    .summary-table {
      table-layout: auto;
    }

    .detail-table {
      border-collapse: separate;
      border-spacing: 0;
      font-size: 9.75px;
      page-break-inside: auto;
      table-layout: fixed;
      width: 100%;
    }
    .detail-table thead {
      display: table-header-group;
    }
    .detail-table tbody {
      page-break-inside: auto;
    }
    .detail-table tr {
      page-break-inside: avoid;
    }
    .detail-table th,
    .detail-table td {
      padding: 4px 5px;
    }
    .detail-table tbody tr:nth-child(even) td {
      background: #ededed;
    }

    .detail-repeat-gap th {
      background: #fff !important;
      border: 0 !important;
      height: 8px;
      padding: 0;
    }
    .detail-repeat-title th {
      background: #efefef !important;
      border: 1px solid #2f2f2f !important;
      font-size: 10.25px;
      font-weight: 700;
      letter-spacing: 0.3px;
      padding: 6px 8px;
      text-align: left;
      text-transform: uppercase;
    }
    .detail-column-head th {
      background: #c8c8c8;
      font-size: 10.5px;
      text-transform: uppercase;
    }

    col.col-date {
      width: 19%;
    }
    col.col-time {
      width: 8%;
    }
    col.col-hours {
      width: 6%;
    }
    col.col-weekly {
      width: 8%;
    }
    col.col-status {
      width: 8%;
    }
    col.col-punch {
      width: 17%;
    }

    .status {
      border-radius: 999px;
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      text-transform: uppercase;
    }
    .status-complete {
      background: #d9efe0;
      color: #275d3b;
    }
    .status-open {
      background: #fff2d5;
      color: #7a5a1b;
    }
    .status-unmatched {
      background: #f6d9d9;
      color: #7f2a2a;
    }
    .ot2-flag {
      background: #fff1cc;
      border: 1px solid #d3a333;
      border-radius: 999px;
      color: #8a5b00;
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      margin-left: 4px;
      padding: 1px 6px;
      vertical-align: middle;
    }
    .empty-row {
      color: #4f4f4f;
      text-align: center;
    }
    .muted {
      color: #4f4f4f;
      margin: 0;
    }
    ul {
      margin: 0;
      padding-left: 16px;
    }
    .footer {
      font-size: 10px;
      margin-top: 10px;
      page-break-before: avoid;
      text-align: right;
    }
  </style>
</head>
<body>
  ${employeePages}
</body>
</html>`;
}

export async function exportPayrollPeriodReportPdf(
    params: ExportPayrollPeriodReportParams,
) {
  const html = buildPayrollReportHtml(params);
  const result = await Print.printToFileAsync({
    base64: false,
    height: LANDSCAPE_PAGE_HEIGHT,
    html,
    width: LANDSCAPE_PAGE_WIDTH,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Export Payroll Report',
      mimeType: 'application/pdf',
    });
  }

  return result.uri;
}
