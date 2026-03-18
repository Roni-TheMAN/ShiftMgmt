import { EMPLOYEE_PIN_LENGTH } from '../../constants/app';
import type { EmployeeRecord } from '../../types/database';
import { getDatabase } from '../db/database';
import { hashPin, verifyPin } from '../security/pbkdf2';
import { insertAuditLog } from './auditRepository';
import {
  getLatestEmployeePayRate,
  upsertEmployeePayRateRecord,
} from './employeePayRateRepository';

export type EmployeeProfileInput = {
  name: string;
  jobTitle: string;
  hourlyRate: number;
  rateEffectiveDate?: string;
  department: string;
  startDate: string;
  photoPath?: string | null;
  address?: string | null;
  email?: string | null;
  phoneNumber: string;
};

type NormalizedEmployeeProfile = {
  name: string;
  jobTitle: string;
  hourlyRate: number;
  rateEffectiveDate: string;
  department: string;
  startDate: string;
  photoPath: string | null;
  address: string | null;
  email: string | null;
  phoneNumber: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeRequiredText(value: string) {
  return value.trim();
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
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

function validateEmployeeProfile(profile: NormalizedEmployeeProfile) {
  if (!profile.name) {
    throw new Error('Employee name is required.');
  }
  if (profile.name.length > 120) {
    throw new Error('Employee name cannot exceed 120 characters.');
  }

  if (!profile.jobTitle) {
    throw new Error('Job title is required.');
  }
  if (profile.jobTitle.length > 80) {
    throw new Error('Job title cannot exceed 80 characters.');
  }

  if (!Number.isFinite(profile.hourlyRate) || profile.hourlyRate <= 0) {
    throw new Error('Hourly rate must be greater than 0.');
  }

  if (!profile.department) {
    throw new Error('Department is required.');
  }
  if (profile.department.length > 80) {
    throw new Error('Department cannot exceed 80 characters.');
  }

  if (!profile.startDate) {
    throw new Error('Start date is required.');
  }
  if (!isValidIsoDate(profile.startDate)) {
    throw new Error('Start date must be in YYYY-MM-DD format.');
  }

  if (!profile.rateEffectiveDate) {
    throw new Error('Rate effective date is required.');
  }
  if (!isValidIsoDate(profile.rateEffectiveDate)) {
    throw new Error('Rate effective date must be in YYYY-MM-DD format.');
  }

  if (!profile.phoneNumber) {
    throw new Error('Phone number is required.');
  }
  if (profile.phoneNumber.length > 30) {
    throw new Error('Phone number cannot exceed 30 characters.');
  }
  const phoneDigits = profile.phoneNumber.replace(/\D/g, '');
  if (phoneDigits.length < 7) {
    throw new Error('Phone number must include at least 7 digits.');
  }

  if (profile.photoPath && profile.photoPath.length > 500) {
    throw new Error('Picture path cannot exceed 500 characters.');
  }

  if (profile.address && profile.address.length > 240) {
    throw new Error('Address cannot exceed 240 characters.');
  }

  if (profile.email) {
    if (profile.email.length > 254) {
      throw new Error('Email cannot exceed 254 characters.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      throw new Error('Email must be a valid email address.');
    }
  }
}

function normalizeEmployeeProfile(profile: EmployeeProfileInput): NormalizedEmployeeProfile {
  const normalized: NormalizedEmployeeProfile = {
    address: normalizeOptionalText(profile.address),
    department: normalizeRequiredText(profile.department),
    email: normalizeOptionalText(profile.email)?.toLowerCase() ?? null,
    hourlyRate: profile.hourlyRate,
    jobTitle: normalizeRequiredText(profile.jobTitle),
    name: normalizeRequiredText(profile.name),
    phoneNumber: normalizeRequiredText(profile.phoneNumber),
    photoPath: normalizeOptionalText(profile.photoPath),
    rateEffectiveDate:
      normalizeRequiredText(profile.rateEffectiveDate ?? profile.startDate),
    startDate: normalizeRequiredText(profile.startDate),
  };

  validateEmployeeProfile(normalized);
  return normalized;
}

function validateEmployeePin(pin: string) {
  if (!new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`Employee PIN must be ${EMPLOYEE_PIN_LENGTH} digits.`);
  }
}

const EMPLOYEE_PIN_SPACE_SIZE = 10 ** EMPLOYEE_PIN_LENGTH;
const MAX_RANDOM_PIN_ATTEMPTS = EMPLOYEE_PIN_SPACE_SIZE * 2;

type EmployeePinRecord = Pick<EmployeeRecord, 'pin_hash'>;

function generateRandomPin() {
  return Math.floor(Math.random() * EMPLOYEE_PIN_SPACE_SIZE)
    .toString()
    .padStart(EMPLOYEE_PIN_LENGTH, '0');
}

async function listEmployeePinHashes(excludeEmployeeId?: number) {
  const db = await getDatabase();
  if (typeof excludeEmployeeId === 'number') {
    return db.getAllAsync<EmployeePinRecord>(
      'SELECT pin_hash FROM employees WHERE id <> ?',
      excludeEmployeeId,
    );
  }
  return db.getAllAsync<EmployeePinRecord>('SELECT pin_hash FROM employees');
}

async function isPinInHashes(pin: string, pinHashes: EmployeePinRecord[]) {
  for (const row of pinHashes) {
    const isMatch = await verifyPin(pin, row.pin_hash);
    if (isMatch) {
      return true;
    }
  }
  return false;
}

async function isEmployeePinInUse(pin: string, excludeEmployeeId?: number) {
  const pinHashes = await listEmployeePinHashes(excludeEmployeeId);
  return isPinInHashes(pin, pinHashes);
}

async function assertUniqueEmployeePin(pin: string, excludeEmployeeId?: number) {
  const inUse = await isEmployeePinInUse(pin, excludeEmployeeId);
  if (inUse) {
    throw new Error('PIN is already assigned to another employee.');
  }
}

export async function generateUniqueEmployeePin(excludeEmployeeId?: number) {
  const pinHashes = await listEmployeePinHashes(excludeEmployeeId);
  for (let attempt = 0; attempt < MAX_RANDOM_PIN_ATTEMPTS; attempt += 1) {
    const candidate = generateRandomPin();
    if (!(await isPinInHashes(candidate, pinHashes))) {
      return candidate;
    }
  }
  throw new Error('Unable to generate a unique employee PIN.');
}

export async function listEmployees() {
  const db = await getDatabase();
  return db.getAllAsync<EmployeeRecord>(
    'SELECT * FROM employees ORDER BY name COLLATE NOCASE ASC',
  );
}

export async function getEmployeeById(employeeId: number) {
  const db = await getDatabase();
  return db.getFirstAsync<EmployeeRecord>(
    'SELECT * FROM employees WHERE id = ?',
    employeeId,
  );
}

export async function createEmployee(profile: EmployeeProfileInput) {
  const normalized = normalizeEmployeeProfile(profile);
  const generatedPin = await generateUniqueEmployeePin();
  validateEmployeePin(generatedPin);
  const pinHash = await hashPin(generatedPin);
  const db = await getDatabase();
  const timestamp = nowIso();
  let createdEmployeeId = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO employees (
         name,
         job_title,
         hourly_rate,
         department,
         start_date,
         photo_path,
         address,
         email,
         phone_number,
         pin_hash,
         pin_code,
         active,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
      normalized.name,
      normalized.jobTitle,
      normalized.hourlyRate,
      normalized.department,
      normalized.startDate,
      normalized.photoPath,
      normalized.address,
      normalized.email,
      normalized.phoneNumber,
      pinHash,
      timestamp,
      timestamp,
    );
    createdEmployeeId = result.lastInsertRowId;

    await upsertEmployeePayRateRecord(db, {
      effectiveStartDate: normalized.rateEffectiveDate,
      employeeId: createdEmployeeId,
      hourlyRate: normalized.hourlyRate,
      timestamp,
    });

    await insertAuditLog(db, {
      action: 'EMPLOYEE_CREATE',
      details: {
        active: true,
        department: normalized.department,
        employeeName: normalized.name,
        hourlyRate: normalized.hourlyRate,
        jobTitle: normalized.jobTitle,
        rateEffectiveDate: normalized.rateEffectiveDate,
        startDate: normalized.startDate,
      },
      entityId: createdEmployeeId,
      entityType: 'EMPLOYEE',
      summary: `Created employee ${normalized.name}.`,
    });
  });

  return {
    employee: await getEmployeeById(createdEmployeeId),
    pin: generatedPin,
  };
}

export async function updateEmployee(
  employeeId: number,
  profile: EmployeeProfileInput,
  nextPin?: string,
) {
  const normalized = normalizeEmployeeProfile(profile);
  const db = await getDatabase();
  const timestamp = nowIso();
  const currentEmployee = await getEmployeeById(employeeId);
  if (!currentEmployee) {
    throw new Error('Employee not found.');
  }
  const hourlyRateChanged = currentEmployee.hourly_rate !== normalized.hourlyRate;

  if (nextPin && nextPin.trim().length > 0) {
    const normalizedPin = nextPin.trim();
    validateEmployeePin(normalizedPin);
    await assertUniqueEmployeePin(normalizedPin, employeeId);
    const pinHash = await hashPin(normalizedPin);
    await db.withTransactionAsync(async () => {
      if (hourlyRateChanged) {
        const latestRate = await getLatestEmployeePayRate(employeeId, db);
        await upsertEmployeePayRateRecord(db, {
          effectiveStartDate:
            normalized.rateEffectiveDate ||
            latestRate?.effective_start_date ||
            normalized.startDate,
          employeeId,
          hourlyRate: normalized.hourlyRate,
          timestamp,
        });
      }

      await db.runAsync(
        `UPDATE employees
         SET name = ?,
             job_title = ?,
             hourly_rate = ?,
             department = ?,
             start_date = ?,
             photo_path = ?,
             address = ?,
             email = ?,
             phone_number = ?,
             pin_hash = ?,
             pin_code = NULL,
             updated_at = ?
         WHERE id = ?`,
        normalized.name,
        normalized.jobTitle,
        normalized.hourlyRate,
        normalized.department,
        normalized.startDate,
        normalized.photoPath,
        normalized.address,
        normalized.email,
        normalized.phoneNumber,
        pinHash,
        timestamp,
        employeeId,
      );

      await insertAuditLog(db, {
        action: 'EMPLOYEE_UPDATE',
        details: {
          department: normalized.department,
          employeeName: normalized.name,
          hourlyRateChanged,
          hourlyRate: normalized.hourlyRate,
          jobTitle: normalized.jobTitle,
          previousHourlyRate: currentEmployee.hourly_rate,
          rateEffectiveDate: hourlyRateChanged ? normalized.rateEffectiveDate : null,
          startDate: normalized.startDate,
          updatedPin: true,
        },
        entityId: employeeId,
        entityType: 'EMPLOYEE',
        summary: `Updated employee ${currentEmployee.name} profile and PIN.`,
      });
    });
  } else {
    await db.withTransactionAsync(async () => {
      if (hourlyRateChanged) {
        const latestRate = await getLatestEmployeePayRate(employeeId, db);
        await upsertEmployeePayRateRecord(db, {
          effectiveStartDate:
            normalized.rateEffectiveDate ||
            latestRate?.effective_start_date ||
            normalized.startDate,
          employeeId,
          hourlyRate: normalized.hourlyRate,
          timestamp,
        });
      }

      await db.runAsync(
        `UPDATE employees
         SET name = ?,
             job_title = ?,
             hourly_rate = ?,
             department = ?,
             start_date = ?,
             photo_path = ?,
             address = ?,
             email = ?,
             phone_number = ?,
             updated_at = ?
         WHERE id = ?`,
        normalized.name,
        normalized.jobTitle,
        normalized.hourlyRate,
        normalized.department,
        normalized.startDate,
        normalized.photoPath,
        normalized.address,
        normalized.email,
        normalized.phoneNumber,
        timestamp,
        employeeId,
      );

      await insertAuditLog(db, {
        action: 'EMPLOYEE_UPDATE',
        details: {
          department: normalized.department,
          employeeName: normalized.name,
          hourlyRateChanged,
          hourlyRate: normalized.hourlyRate,
          jobTitle: normalized.jobTitle,
          previousHourlyRate: currentEmployee.hourly_rate,
          rateEffectiveDate: hourlyRateChanged ? normalized.rateEffectiveDate : null,
          startDate: normalized.startDate,
          updatedPin: false,
        },
        entityId: employeeId,
        entityType: 'EMPLOYEE',
        summary: `Updated employee ${currentEmployee.name} profile.`,
      });
    });
  }

  return getEmployeeById(employeeId);
}

export async function resetEmployeePin(employeeId: number, pin?: string) {
  const nextPin = pin?.trim().length ? pin.trim() : await generateUniqueEmployeePin();
  validateEmployeePin(nextPin);
  await assertUniqueEmployeePin(nextPin, employeeId);
  const db = await getDatabase();
  const employee = await getEmployeeById(employeeId);
  if (!employee) {
    throw new Error('Employee not found.');
  }
  const pinHash = await hashPin(nextPin);
  const timestamp = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE employees
       SET pin_hash = ?, pin_code = NULL, updated_at = ?
       WHERE id = ?`,
      pinHash,
      timestamp,
      employeeId,
    );

    await insertAuditLog(db, {
      action: 'EMPLOYEE_PIN_RESET',
      details: {
        employeeName: employee.name,
        mode: pin?.trim().length ? 'MANUAL' : 'RANDOM',
      },
      entityId: employeeId,
      entityType: 'EMPLOYEE',
      summary: `Reset PIN for ${employee.name}.`,
    });
  });
  return { pin: nextPin };
}

export async function setEmployeeActive(employeeId: number, active: boolean) {
  const db = await getDatabase();
  const employee = await getEmployeeById(employeeId);
  if (!employee) {
    throw new Error('Employee not found.');
  }
  const timestamp = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE employees
       SET active = ?, updated_at = ?
       WHERE id = ?`,
      active ? 1 : 0,
      timestamp,
      employeeId,
    );

    await insertAuditLog(db, {
      action: active ? 'EMPLOYEE_ACTIVATE' : 'EMPLOYEE_DEACTIVATE',
      details: {
        employeeName: employee.name,
        nextActiveState: active,
      },
      entityId: employeeId,
      entityType: 'EMPLOYEE',
      summary: `${active ? 'Activated' : 'Deactivated'} employee ${employee.name}.`,
    });
  });
}

export async function findActiveEmployeeByPin(pin: string) {
  validateEmployeePin(pin);
  const db = await getDatabase();
  const activeEmployees = await db.getAllAsync<EmployeeRecord>(
    'SELECT * FROM employees WHERE active = 1 ORDER BY id ASC',
  );

  for (const employee of activeEmployees) {
    const valid = await verifyPin(pin, employee.pin_hash);
    if (valid) {
      return employee;
    }
  }
  return null;
}

export async function countEmployees() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; active_count: number }>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_count
     FROM employees`,
  );

  return {
    active: row?.active_count ?? 0,
    total: row?.total ?? 0,
  };
}

export async function deleteAllEmployees() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM employees');
}
