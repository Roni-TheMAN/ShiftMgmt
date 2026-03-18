import type { SQLiteDatabase } from 'expo-sqlite';
import type { EmployeePayRateRecord } from '../../types/database';
import { getDatabase } from '../db/database';

type UpsertEmployeePayRateParams = {
  employeeId: number;
  hourlyRate: number;
  effectiveStartDate: string;
  timestamp?: string;
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

function validateEmployeePayRateInput(params: UpsertEmployeePayRateParams) {
  if (!Number.isInteger(params.employeeId) || params.employeeId <= 0) {
    throw new Error('Employee pay rate history requires a valid employee ID.');
  }
  if (!Number.isFinite(params.hourlyRate) || params.hourlyRate <= 0) {
    throw new Error('Employee pay rate history requires a valid hourly rate.');
  }
  if (!isValidIsoDate(params.effectiveStartDate)) {
    throw new Error('Rate effective date must be in YYYY-MM-DD format.');
  }
}

export function createEmployeePayRateResolver(
  payRateRows: EmployeePayRateRecord[],
  fallbackRates: Map<number, number> = new Map<number, number>(),
) {
  const rowsByEmployee = new Map<number, EmployeePayRateRecord[]>();

  for (const row of payRateRows) {
    const bucket = rowsByEmployee.get(row.employee_id) ?? [];
    bucket.push(row);
    rowsByEmployee.set(row.employee_id, bucket);
  }

  for (const bucket of rowsByEmployee.values()) {
    bucket.sort(
      (a, b) =>
        a.effective_start_date.localeCompare(b.effective_start_date) ||
        a.id - b.id,
    );
  }

  return (employeeId: number, dayKey: string) => {
    const bucket = rowsByEmployee.get(employeeId) ?? [];
    let resolvedRate: number | null = null;

    for (const row of bucket) {
      if (row.effective_start_date <= dayKey) {
        resolvedRate = row.hourly_rate;
        continue;
      }
      break;
    }

    if (resolvedRate !== null) {
      return resolvedRate;
    }

    return fallbackRates.get(employeeId) ?? 0;
  };
}

export async function listEmployeePayRates(employeeId: number) {
  const db = await getDatabase();
  return db.getAllAsync<EmployeePayRateRecord>(
    `SELECT
       id,
       employee_id,
       hourly_rate,
       effective_start_date,
       created_at,
       updated_at
     FROM employee_pay_rates
     WHERE employee_id = ?
     ORDER BY effective_start_date DESC, id DESC`,
    employeeId,
  );
}

export async function listEmployeePayRatesForEmployees(employeeIds: number[]) {
  const normalizedIds = Array.from(
    new Set(
      employeeIds.filter((employeeId) => Number.isInteger(employeeId) && employeeId > 0),
    ),
  );
  if (normalizedIds.length === 0) {
    return [] as EmployeePayRateRecord[];
  }

  const db = await getDatabase();
  const placeholders = normalizedIds.map(() => '?').join(', ');
  return db.getAllAsync<EmployeePayRateRecord>(
    `SELECT
       id,
       employee_id,
       hourly_rate,
       effective_start_date,
       created_at,
       updated_at
     FROM employee_pay_rates
     WHERE employee_id IN (${placeholders})
     ORDER BY employee_id ASC, effective_start_date ASC, id ASC`,
    ...normalizedIds,
  );
}

export async function getLatestEmployeePayRate(
  employeeId: number,
  db?: SQLiteDatabase,
) {
  const targetDb = db ?? (await getDatabase());
  return targetDb.getFirstAsync<EmployeePayRateRecord>(
    `SELECT
       id,
       employee_id,
       hourly_rate,
       effective_start_date,
       created_at,
       updated_at
     FROM employee_pay_rates
     WHERE employee_id = ?
     ORDER BY effective_start_date DESC, id DESC
     LIMIT 1`,
    employeeId,
  );
}

export async function upsertEmployeePayRateRecord(
  db: SQLiteDatabase,
  params: UpsertEmployeePayRateParams,
) {
  validateEmployeePayRateInput(params);

  const timestamp = params.timestamp ?? nowIso();
  const todayIso = timestamp.slice(0, 10);
  if (params.effectiveStartDate > todayIso) {
    throw new Error('Rate effective date cannot be in the future.');
  }

  const latestRate = await getLatestEmployeePayRate(params.employeeId, db);
  if (latestRate && params.effectiveStartDate < latestRate.effective_start_date) {
    throw new Error(
      `Rate effective date cannot be earlier than ${latestRate.effective_start_date}.`,
    );
  }

  await db.runAsync(
    `INSERT INTO employee_pay_rates (
       employee_id,
       hourly_rate,
       effective_start_date,
       created_at,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(employee_id, effective_start_date)
     DO UPDATE SET
       hourly_rate = excluded.hourly_rate,
       updated_at = excluded.updated_at`,
    params.employeeId,
    params.hourlyRate,
    params.effectiveStartDate,
    timestamp,
    timestamp,
  );

  const storedRecord = await db.getFirstAsync<EmployeePayRateRecord>(
    `SELECT
       id,
       employee_id,
       hourly_rate,
       effective_start_date,
       created_at,
       updated_at
     FROM employee_pay_rates
     WHERE employee_id = ?
       AND effective_start_date = ?
     ORDER BY id DESC
     LIMIT 1`,
    params.employeeId,
    params.effectiveStartDate,
  );

  if (!storedRecord) {
    throw new Error('Failed to save employee pay rate history.');
  }

  return storedRecord;
}
