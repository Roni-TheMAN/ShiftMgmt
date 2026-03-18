import type { EmployeeRecord } from '../../types/database';
import type { PayrollExceptionReport } from '../payroll/exceptionReport';
import type { PayrollHoursSummary } from '../payroll/hoursAggregation';
import { escapeCsvValue, writeAndShareCsv } from './csvUtils';

export type PayrollCsvTemplate = 'GENERIC' | 'QUICKBOOKS' | 'GUSTO' | 'ADP';

type PayrollPeriodBounds = {
  periodStartDate: string;
  periodEndDate: string;
};

type ExportPayrollTemplateCsvParams = {
  template: PayrollCsvTemplate;
  employees: EmployeeRecord[];
  payPeriod: PayrollPeriodBounds;
  schedule: {
    ot1Multiplier: number;
    ot2Multiplier: number;
  };
  summary: PayrollHoursSummary;
};

type ExportPayrollExceptionsCsvParams = {
  exceptions: PayrollExceptionReport;
  payPeriod: PayrollPeriodBounds;
};

type EarningsExportRow = {
  employeeId: number;
  employeeName: string;
  department: string;
  jobTitle: string;
  earningCode: 'REG' | 'OT1' | 'OT2';
  hours: number;
  rate: number;
  multiplier: number;
  amount: number;
};

function formatHours(value: number) {
  return value.toFixed(2);
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function formatRateRange(minHourlyRate: number, maxHourlyRate: number, hasMultipleRates: boolean) {
  if (!hasMultipleRates) {
    return minHourlyRate.toFixed(2);
  }
  return `${minHourlyRate.toFixed(2)}-${maxHourlyRate.toFixed(2)}`;
}

function buildEarningsRows(
  summary: PayrollHoursSummary,
  employees: EmployeeRecord[],
  schedule: ExportPayrollTemplateCsvParams['schedule'],
) {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const rows: EarningsExportRow[] = [];

  for (const employee of summary.employeeTotals) {
    const employeeRecord = employeesById.get(employee.employeeId);
    const department = employeeRecord?.department ?? '';
    const jobTitle = employeeRecord?.job_title ?? '';

    for (const rateBreakdown of employee.rateBreakdowns) {
      if (rateBreakdown.regularHours > 0) {
        rows.push({
          amount: rateBreakdown.regularPay,
          department,
          earningCode: 'REG',
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          hours: rateBreakdown.regularHours,
          jobTitle,
          multiplier: 1,
          rate: rateBreakdown.hourlyRate,
        });
      }
      if (rateBreakdown.ot1Hours > 0) {
        rows.push({
          amount: rateBreakdown.ot1Pay,
          department,
          earningCode: 'OT1',
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          hours: rateBreakdown.ot1Hours,
          jobTitle,
          multiplier: schedule.ot1Multiplier,
          rate: rateBreakdown.hourlyRate,
        });
      }
      if (rateBreakdown.ot2Hours > 0) {
        rows.push({
          amount: rateBreakdown.ot2Pay,
          department,
          earningCode: 'OT2',
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          hours: rateBreakdown.ot2Hours,
          jobTitle,
          multiplier: schedule.ot2Multiplier,
          rate: rateBreakdown.hourlyRate,
        });
      }
    }
  }

  return rows.sort(
    (a, b) =>
      a.employeeName.localeCompare(b.employeeName) ||
      a.earningCode.localeCompare(b.earningCode) ||
      a.rate - b.rate,
  );
}

function buildTemplateCsvLines(params: ExportPayrollTemplateCsvParams) {
  const earningsRows = buildEarningsRows(
    params.summary,
    params.employees,
    params.schedule,
  );

  switch (params.template) {
    case 'GENERIC':
      return [
        'employee_id,employee_name,department,job_title,pay_period_start,pay_period_end,earning_code,hours,hourly_rate,rate_multiplier,amount',
        ...earningsRows.map((row) =>
          [
            String(row.employeeId),
            escapeCsvValue(row.employeeName),
            escapeCsvValue(row.department),
            escapeCsvValue(row.jobTitle),
            params.payPeriod.periodStartDate,
            params.payPeriod.periodEndDate,
            row.earningCode,
            formatHours(row.hours),
            formatMoney(row.rate),
            row.multiplier.toFixed(2),
            formatMoney(row.amount),
          ].join(','),
        ),
      ];
    case 'QUICKBOOKS':
      return [
        'employee,payroll_item,hours,rate,class,pay_period_start,pay_period_end,notes',
        ...earningsRows.map((row) =>
          [
            escapeCsvValue(row.employeeName),
            row.earningCode === 'REG'
              ? 'Regular Pay'
              : row.earningCode === 'OT1'
                ? 'Overtime Pay'
                : 'Double Overtime Pay',
            formatHours(row.hours),
            formatMoney(row.rate),
            escapeCsvValue(row.department || row.jobTitle),
            params.payPeriod.periodStartDate,
            params.payPeriod.periodEndDate,
            escapeCsvValue('CSV template for payroll import mapping'),
          ].join(','),
        ),
      ];
    case 'GUSTO':
      return [
        'employee_name,employee_id,regular_hours,overtime_hours,double_overtime_hours,rate_reference,total_gross_pay,department,job_title,pay_period_start,pay_period_end,notes',
        ...params.summary.employeeTotals.map((employee) =>
          [
            escapeCsvValue(employee.employeeName),
            String(employee.employeeId),
            formatHours(employee.regularHours),
            formatHours(employee.ot1Hours),
            formatHours(employee.ot2Hours),
            escapeCsvValue(
              formatRateRange(
                employee.minHourlyRate,
                employee.maxHourlyRate,
                employee.hasMultipleRates,
              ),
            ),
            formatMoney(employee.totalPay),
            escapeCsvValue(
              params.employees.find((entry) => entry.id === employee.employeeId)?.department ?? '',
            ),
            escapeCsvValue(
              params.employees.find((entry) => entry.id === employee.employeeId)?.job_title ?? '',
            ),
            params.payPeriod.periodStartDate,
            params.payPeriod.periodEndDate,
            escapeCsvValue(
              employee.hasMultipleRates
                ? 'Multiple hourly rates applied during this period.'
                : 'Single hourly rate applied during this period.',
            ),
          ].join(','),
        ),
      ];
    case 'ADP':
      return [
        'employee_id,employee_name,earning_code,hours,rate,department,job_title,pay_period_start,pay_period_end,amount',
        ...earningsRows.map((row) =>
          [
            String(row.employeeId),
            escapeCsvValue(row.employeeName),
            row.earningCode,
            formatHours(row.hours),
            formatMoney(row.rate),
            escapeCsvValue(row.department),
            escapeCsvValue(row.jobTitle),
            params.payPeriod.periodStartDate,
            params.payPeriod.periodEndDate,
            formatMoney(row.amount),
          ].join(','),
        ),
      ];
    default:
      return [];
  }
}

function templateLabel(template: PayrollCsvTemplate) {
  switch (template) {
    case 'GENERIC':
      return 'Generic Payroll CSV';
    case 'QUICKBOOKS':
      return 'QuickBooks Payroll Template';
    case 'GUSTO':
      return 'Gusto Payroll Template';
    case 'ADP':
      return 'ADP Payroll Template';
    default:
      return 'Payroll CSV';
  }
}

function templateFileName(template: PayrollCsvTemplate) {
  switch (template) {
    case 'GENERIC':
      return 'payroll-generic';
    case 'QUICKBOOKS':
      return 'payroll-quickbooks-template';
    case 'GUSTO':
      return 'payroll-gusto-template';
    case 'ADP':
      return 'payroll-adp-template';
    default:
      return 'payroll-export';
  }
}

export async function exportPayrollTemplateCsv(params: ExportPayrollTemplateCsvParams) {
  const lines = buildTemplateCsvLines(params);
  const csvContent = lines.join('\n');
  return writeAndShareCsv({
    baseFileName: `${templateFileName(params.template)}-${params.payPeriod.periodStartDate}-${params.payPeriod.periodEndDate}`,
    csvContent,
    dialogTitle: templateLabel(params.template),
  });
}

export async function exportPayrollExceptionsCsv(
  params: ExportPayrollExceptionsCsvParams,
) {
  const lines = [
    'pay_period_start,pay_period_end,exception_type,employee_id,employee_name,shift_status,date,clock_in,clock_out,clock_out_source,admin_tag,last_edited_at,details',
    ...params.exceptions.rows.map((row) =>
      [
        params.payPeriod.periodStartDate,
        params.payPeriod.periodEndDate,
        row.exceptionType,
        String(row.employeeId),
        escapeCsvValue(row.employeeName),
        row.shiftStatus,
        row.date ?? '',
        row.clockInTimestamp ?? '',
        row.clockOutTimestamp ?? '',
        row.clockOutSource ?? '',
        row.adminTag ?? '',
        row.lastEditedAt ?? '',
        escapeCsvValue(row.details),
      ].join(','),
    ),
  ];

  return writeAndShareCsv({
    baseFileName: `payroll-exceptions-${params.payPeriod.periodStartDate}-${params.payPeriod.periodEndDate}`,
    csvContent: lines.join('\n'),
    dialogTitle: 'Payroll Exception Report',
  });
}
