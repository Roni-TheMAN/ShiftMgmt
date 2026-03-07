import { EMPLOYEE_PIN_LENGTH } from '../../constants/app';
import type { EmployeeRecord } from '../../types/database';
import { getDatabase } from '../db/database';
import { hashPin, verifyPin } from '../security/pbkdf2';

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(name: string) {
  return name.trim();
}

function validateEmployeePin(pin: string) {
  if (!new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`Employee PIN must be ${EMPLOYEE_PIN_LENGTH} digits.`);
  }
}

const EMPLOYEE_PIN_SPACE_SIZE = 10 ** EMPLOYEE_PIN_LENGTH;
const MAX_RANDOM_PIN_ATTEMPTS = EMPLOYEE_PIN_SPACE_SIZE * 2;

type EmployeePinRecord = Pick<EmployeeRecord, 'pin_hash' | 'pin_code'>;

function generateRandomPin() {
  return Math.floor(Math.random() * EMPLOYEE_PIN_SPACE_SIZE)
    .toString()
    .padStart(EMPLOYEE_PIN_LENGTH, '0');
}

async function listEmployeePinHashes(excludeEmployeeId?: number) {
  const db = await getDatabase();
  if (typeof excludeEmployeeId === 'number') {
    return db.getAllAsync<EmployeePinRecord>(
      'SELECT pin_hash, pin_code FROM employees WHERE id <> ?',
      excludeEmployeeId,
    );
  }
  return db.getAllAsync<EmployeePinRecord>('SELECT pin_hash, pin_code FROM employees');
}

async function isPinInHashes(pin: string, pinHashes: EmployeePinRecord[]) {
  for (const row of pinHashes) {
    if (row.pin_code && row.pin_code === pin) {
      return true;
    }
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

export async function createEmployee(name: string) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error('Employee name is required.');
  }

  const generatedPin = await generateUniqueEmployeePin();
  validateEmployeePin(generatedPin);

  const db = await getDatabase();
  const timestamp = nowIso();
  const pinHash = await hashPin(generatedPin);
  const result = await db.runAsync(
    `INSERT INTO employees (name, pin_hash, pin_code, active, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    normalizedName,
    pinHash,
    generatedPin,
    timestamp,
    timestamp,
  );

  return {
    employee: await getEmployeeById(result.lastInsertRowId),
    pin: generatedPin,
  };
}

export async function updateEmployee(
  employeeId: number,
  name: string,
  nextPin?: string,
) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error('Employee name is required.');
  }

  const db = await getDatabase();
  const timestamp = nowIso();

  if (nextPin && nextPin.trim().length > 0) {
    const normalizedPin = nextPin.trim();
    validateEmployeePin(normalizedPin);
    await assertUniqueEmployeePin(normalizedPin, employeeId);
    const pinHash = await hashPin(normalizedPin);
    await db.runAsync(
      `UPDATE employees
       SET name = ?, pin_hash = ?, pin_code = ?, updated_at = ?
       WHERE id = ?`,
      normalizedName,
      pinHash,
      normalizedPin,
      timestamp,
      employeeId,
    );
  } else {
    await db.runAsync(
      `UPDATE employees
       SET name = ?, updated_at = ?
       WHERE id = ?`,
      normalizedName,
      timestamp,
      employeeId,
    );
  }

  return getEmployeeById(employeeId);
}

export async function resetEmployeePin(employeeId: number, pin?: string) {
  const nextPin = pin?.trim().length ? pin.trim() : await generateUniqueEmployeePin();
  validateEmployeePin(nextPin);
  await assertUniqueEmployeePin(nextPin, employeeId);
  const db = await getDatabase();
  const pinHash = await hashPin(nextPin);
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE employees
     SET pin_hash = ?, pin_code = ?, updated_at = ?
     WHERE id = ?`,
    pinHash,
    nextPin,
    timestamp,
    employeeId,
  );
  return { pin: nextPin };
}

export async function setEmployeeActive(employeeId: number, active: boolean) {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE employees
     SET active = ?, updated_at = ?
     WHERE id = ?`,
    active ? 1 : 0,
    timestamp,
    employeeId,
  );
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
