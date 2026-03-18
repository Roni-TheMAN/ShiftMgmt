import type { PayrollPeriodApprovalRecord } from '../../types/database';
import { getDatabase } from '../db/database';
import { createAuditLog } from './auditRepository';

type ApprovePayrollPeriodInput = {
  periodStartDate: string;
  periodEndDate: string;
  note?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function normalizeNote(value?: string | null) {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized.slice(0, 500) : null;
}

function validatePayrollPeriodBounds(periodStartDate: string, periodEndDate: string) {
  if (!isValidIsoDate(periodStartDate) || !isValidIsoDate(periodEndDate)) {
    throw new Error('Payroll period dates must use YYYY-MM-DD format.');
  }
  if (periodEndDate < periodStartDate) {
    throw new Error('Payroll period end date cannot be earlier than the start date.');
  }
}

export async function getPayrollPeriodApproval(periodStartDate: string) {
  if (!isValidIsoDate(periodStartDate)) {
    throw new Error('Payroll period start date must use YYYY-MM-DD format.');
  }

  const db = await getDatabase();
  return db.getFirstAsync<PayrollPeriodApprovalRecord>(
    `SELECT
       period_start_date,
       period_end_date,
       note,
       approved_at,
       updated_at
     FROM payroll_period_approvals
     WHERE period_start_date = ?`,
    periodStartDate,
  );
}

export async function approvePayrollPeriod(input: ApprovePayrollPeriodInput) {
  validatePayrollPeriodBounds(input.periodStartDate, input.periodEndDate);
  const note = normalizeNote(input.note);
  const timestamp = nowIso();
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO payroll_period_approvals (
         period_start_date,
         period_end_date,
         note,
         approved_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(period_start_date)
       DO UPDATE SET
         period_end_date = excluded.period_end_date,
         note = excluded.note,
         approved_at = excluded.approved_at,
         updated_at = excluded.updated_at`,
      input.periodStartDate,
      input.periodEndDate,
      note,
      timestamp,
      timestamp,
    );
  });

  await createAuditLog({
    action: 'PAYROLL_PERIOD_APPROVE',
    details: {
      note,
      periodEndDate: input.periodEndDate,
      periodStartDate: input.periodStartDate,
    },
    entityId: input.periodStartDate,
    entityType: 'PAYROLL_PERIOD',
    summary: `Approved payroll period ${input.periodStartDate} to ${input.periodEndDate}.`,
  });

  return getPayrollPeriodApproval(input.periodStartDate);
}

export async function reopenPayrollPeriod(params: {
  periodStartDate: string;
  periodEndDate: string;
}) {
  validatePayrollPeriodBounds(params.periodStartDate, params.periodEndDate);
  const db = await getDatabase();
  const existingApproval = await getPayrollPeriodApproval(params.periodStartDate);
  if (!existingApproval) {
    return null;
  }

  await db.runAsync(
    'DELETE FROM payroll_period_approvals WHERE period_start_date = ?',
    params.periodStartDate,
  );

  await createAuditLog({
    action: 'PAYROLL_PERIOD_REOPEN',
    details: {
      approvedAt: existingApproval.approved_at,
      periodEndDate: params.periodEndDate,
      periodStartDate: params.periodStartDate,
    },
    entityId: params.periodStartDate,
    entityType: 'PAYROLL_PERIOD',
    summary: `Reopened payroll period ${params.periodStartDate} to ${params.periodEndDate}.`,
  });

  return null;
}
