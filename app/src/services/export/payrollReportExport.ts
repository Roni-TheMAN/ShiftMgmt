import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { PayrollHoursSummary } from '../payroll/hoursAggregation';

const DAY_MS = 24 * 60 * 60 * 1000;

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
type EmployeeShiftEntry = EmployeeShiftGroup['shifts'][number];

type EmployeeBreakdown = {
  dayTotals: Array<{ date: string; hours: number }>;
  weekTotals: Array<{ weekNumber: number; startDate: string; endDate: string; hours: number }>;
};

export type ExportPayrollPeriodReportParams = {
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

  const weekTotals = [];
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

function buildShiftDetailRows(
  employee: EmployeeShiftGroup,
  payPeriod: PayrollReportPeriod,
) {
  const runningWeekHours = new Map<number, number>();

  const sortedShifts = [...employee.shifts].sort((a, b) => {
    const aAnchor = a.clockInTimestamp ?? a.clockOutTimestamp ?? '';
    const bAnchor = b.clockInTimestamp ?? b.clockOutTimestamp ?? '';
    return aAnchor.localeCompare(bAnchor);
  });

  const rows = sortedShifts.map((shift) => {
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
    if (shift.adminTag && shift.adminTag !== 'NONE') {
      punchInfoParts.push(shift.adminTag);
    }
    const punchInfo = punchInfoParts.length > 0 ? punchInfoParts.join(' | ') : '-';

    return `<tr>
  <td>${escapeHtml(formatDateOnly(anchorTimestamp ?? null, payPeriod))}</td>
  <td>${escapeHtml(formatClockInTime(shift.clockInTimestamp, shift.clockOutTimestamp, payPeriod))}</td>
  <td>${escapeHtml(formatClockOutTime(shift.clockInTimestamp, shift.clockOutTimestamp, payPeriod))}</td>
  <td class="number">${formatNumber(recordedHours)}</td>
  <td class="number">${formatNumber(recordedHours)}</td>
  <td class="number">${formatNumber(shift.regularHours)}</td>
  <td class="number">${formatNumber(shift.ot1Hours)}</td>
  <td class="number">${formatNumber(shift.ot2Hours)}</td>
  <td class="number">${formatNumber(weeklyTotal)}</td>
  <td><span class="status ${getStatusClass(shift.status)}">${shift.status}</span></td>
  <td>${escapeHtml(punchInfo)}</td>
</tr>`;
  });

  if (rows.length === 0) {
    return '<tr><td colspan="11" class="empty-row">No shift records for this employee in this period.</td></tr>';
  }

  return rows.join('\n');
}

function buildPayrollReportHtml(params: ExportPayrollPeriodReportParams) {
  const generatedAt = new Date().toISOString();
  const employeeCount = params.summary.shiftsByEmployee.length;
  const payClass = getPayClassLabel(params.schedule.payPeriodLength);

  if (employeeCount === 0) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payroll Report</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 24px; }
  </style>
</head>
<body>
  <h1>Detail Payroll Report</h1>
  <p>No employee data was found for this pay period.</p>
</body>
</html>`;
  }

  const employeePages = params.summary.shiftsByEmployee
    .map((employee, index) => {
      const breakdown = getEmployeeBreakdown(employee, params.payPeriod);
      const ot1Hours = employee.ot1Hours;
      const ot2Hours = employee.ot2Hours;
      const regHours = employee.regularHours;
      const hourlyRate = employee.hourlyRate;
      const totalAmount = employee.totalPay;
      const employeeWarnings = params.summary.warnings.filter((warning) =>
        warning.includes(employee.employeeName),
      );

      const payTypeRowsHtml = `<tr>
  <td>OT1</td>
  <td>OT</td>
  <td class="number">${formatNumber(hourlyRate)}</td>
  <td class="number">${formatNumber(params.schedule.ot1Multiplier)}</td>
  <td class="number">${formatNumber(ot1Hours)}</td>
  <td class="number">${formatCurrency(employee.ot1Pay)}</td>
</tr>
<tr>
  <td>OT2</td>
  <td>OT</td>
  <td class="number">${formatNumber(hourlyRate)}</td>
  <td class="number">${formatNumber(params.schedule.ot2Multiplier)}</td>
  <td class="number">${formatNumber(ot2Hours)}</td>
  <td class="number">${formatCurrency(employee.ot2Pay)}</td>
</tr>
<tr>
  <td>REG</td>
  <td>REG</td>
  <td class="number">${formatNumber(hourlyRate)}</td>
  <td class="number">1.00</td>
  <td class="number">${formatNumber(regHours)}</td>
  <td class="number">${formatCurrency(employee.regularPay)}</td>
</tr>
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
  <td>${escapeHtml(formatDay(day.date, params.payPeriod))}</td>
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

      const warningsHtml =
        employeeWarnings.length === 0
          ? '<p class="muted">No data warnings for this employee.</p>'
          : `<ul>${employeeWarnings
              .map((warning) => `<li>${escapeHtml(warning)}</li>`)
              .join('')}</ul>`;

      const shiftRowsHtml = buildShiftDetailRows(employee, params.payPeriod);

      return `<section class="employee-page ${index === 0 ? 'first' : ''}">
  <header class="header">
    <h1 class="main-title">DETAIL PAYROLL REPORT</h1>
    <div class="header-grid">
      <div class="meta-col">
        <p><strong>Name</strong> : ${escapeHtml(employee.employeeName)}</p>
        <p><strong>Employee ID</strong> : ${employee.employeeId}</p>
        <p><strong>Base Hourly</strong> : ${formatCurrency(employee.hourlyRate)}</p>
        <p><strong>From</strong> : ${escapeHtml(formatPeriodBoundary(params.payPeriod.periodStartDate, false))}</p>
      </div>
      <div class="meta-col">
        <p><strong>Pay Class</strong> : ${escapeHtml(payClass)}</p>
        <p><strong>Period Label</strong> : ${escapeHtml(params.periodLabel)}</p>
        <p><strong>To</strong> : ${escapeHtml(formatPeriodBoundary(params.payPeriod.periodEndDate, true))}</p>
      </div>
    </div>
    <p class="meta-foot">Generated: ${escapeHtml(formatDateTime(generatedAt))} | Schedule: ${escapeHtml(params.schedule.payPeriodLength)} (${escapeHtml(params.schedule.payPeriodStartDay)}) | Anchor: ${escapeHtml(params.schedule.payPeriodStartDate)}</p>
    <p class="meta-foot">First run override: ${params.schedule.firstPayrollRunDays ? `${params.schedule.firstPayrollRunDays} day(s)` : 'None'} | OT1 ${params.schedule.ot1Multiplier.toFixed(2)}x above ${params.schedule.ot1WeeklyThresholdHours}h/week | OT2 ${params.schedule.ot2Multiplier.toFixed(2)}x on ${params.schedule.ot2HolidayDates.length} holiday(s).</p>
  </header>

  <section class="section section-compact">
    <table>
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
  </section>

  <section class="section section-compact dual-grid">
    <div>
      <h2 class="section-title">Weekly Totals</h2>
      <table>
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
    <div>
      <h2 class="section-title">Daily Totals</h2>
      <table>
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
    <h2 class="section-title">Shift Detail</h2>
    <table>
      <thead>
        <tr>
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
        ${shiftRowsHtml}
        <tr class="totals-row">
          <td colspan="4"><strong>Pay Period Totals</strong></td>
          <td class="number"><strong>${formatNumber(employee.totalHours)}</strong></td>
          <td class="number"><strong>${formatNumber(employee.regularHours)}</strong></td>
          <td class="number"><strong>${formatNumber(employee.ot1Hours)}</strong></td>
          <td class="number"><strong>${formatNumber(employee.ot2Hours)}</strong></td>
          <td class="number"><strong>${formatNumber(employee.totalHours)}</strong></td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="section section-compact">
    <h2 class="section-title">Data Warnings</h2>
    ${warningsHtml}
  </section>

  <footer class="footer">Employee ${index + 1} of ${employeeCount}</footer>
</section>`;
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
      size: A4;
    }
    body {
      background: #f0f0f0;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      margin: 0;
    }
    .employee-page {
      page-break-before: always;
      padding: 2mm;
    }
    .employee-page.first {
      page-break-before: auto;
    }
    .header {
      margin-bottom: 8px;
    }
    .main-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.4px;
      margin: 0 0 8px;
      text-align: center;
      text-transform: uppercase;
    }
    .header-grid {
      display: grid;
      gap: 8px 20px;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 6px;
    }
    .meta-col p {
      margin: 3px 0;
    }
    .meta-foot {
      margin: 3px 0;
    }
    .section {
      margin-top: 8px;
      page-break-inside: auto;
    }
    .section-compact {
      page-break-inside: avoid;
    }
    .section-breakable {
      page-break-inside: auto;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      margin: 0 0 4px;
      text-transform: uppercase;
    }
    .dual-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: 1fr 1fr;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th,
    td {
      border: 1px solid #2f2f2f;
      padding: 3px 4px;
      vertical-align: top;
    }
    tr {
      page-break-inside: avoid;
    }
    th {
      background: #bdbdbd;
      font-size: 10px;
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
      text-align: right;
      white-space: nowrap;
    }
    .status {
      border-radius: 999px;
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
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
      font-size: 11px;
      margin-top: 10px;
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
    html,
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
