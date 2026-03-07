import { ADMIN_PIN_LENGTH, DEFAULT_ADMIN_PIN } from '../../constants/app';
import { getDatabase } from '../db/database';
import { hashPin, verifyPin } from '../security/pbkdf2';

const ADMIN_PIN_KEY = 'admin_pin_hash';
const PAY_PERIOD_LENGTH_KEY = 'settings_pay_period_length';
const PAY_PERIOD_START_DAY_KEY = 'settings_pay_period_start_day';
const PAY_PERIOD_START_DATE_KEY = 'settings_pay_period_start_date';
const FIRST_PAYROLL_RUN_DAYS_KEY = 'settings_first_payroll_run_days';
const AUTO_CLOCK_OUT_ENABLED_KEY = 'settings_auto_clock_out_enabled';
const AUTO_CLOCK_OUT_HOURS_KEY = 'settings_auto_clock_out_hours';
const LEGACY_PAY_PERIOD_LENGTH_KEY = 'data_analysis_pay_period_length';
const LEGACY_PAY_PERIOD_START_DAY_KEY = 'data_analysis_pay_period_start_day';

export const PAY_PERIOD_LENGTHS = [
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'YEARLY',
] as const;

export const PAY_PERIOD_START_DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export type PayPeriodLength = (typeof PAY_PERIOD_LENGTHS)[number];
export type PayPeriodStartDay = (typeof PAY_PERIOD_START_DAYS)[number];

export type PayrollSettings = {
  payPeriodLength: PayPeriodLength;
  payPeriodStartDay: PayPeriodStartDay;
  payPeriodStartDate: string;
  firstPayrollRunDays: number | null;
  autoClockOutEnabled: boolean;
  autoClockOutHours: number;
};

const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  payPeriodLength: 'WEEKLY',
  payPeriodStartDay: 'MONDAY',
  payPeriodStartDate: isoDateLocal(new Date()),
  firstPayrollRunDays: null,
  autoClockOutEnabled: false,
  autoClockOutHours: 12,
};

function nowIso() {
  return new Date().toISOString();
}

function isoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validateAdminPin(pin: string) {
  if (!new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`Admin PIN must be ${ADMIN_PIN_LENGTH} digits.`);
  }
}

async function getSettingValue(key: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

async function upsertSetting(key: string, value: string) {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    timestamp,
  );
}

async function deleteSetting(key: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM settings WHERE key = ?', key);
}

function validatePayPeriodLength(value: string): asserts value is PayPeriodLength {
  if (!PAY_PERIOD_LENGTHS.includes(value as PayPeriodLength)) {
    throw new Error('Invalid pay period length.');
  }
}

function validatePayPeriodStartDay(value: string): asserts value is PayPeriodStartDay {
  if (!PAY_PERIOD_START_DAYS.includes(value as PayPeriodStartDay)) {
    throw new Error('Invalid pay period start day.');
  }
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

function validatePayPeriodStartDate(value: string) {
  if (!isValidIsoDate(value)) {
    throw new Error('Pay period start date must be in YYYY-MM-DD format.');
  }
}

export function getNominalPayPeriodDays(payPeriodLength: PayPeriodLength) {
  switch (payPeriodLength) {
    case 'WEEKLY':
      return 7;
    case 'BIWEEKLY':
      return 14;
    case 'MONTHLY':
      return 31;
    case 'QUARTERLY':
      return 92;
    case 'SEMIANNUAL':
      return 184;
    case 'YEARLY':
      return 366;
    default:
      return 14;
  }
}

export function supportsFirstPayrollRunDays(payPeriodLength: PayPeriodLength) {
  return payPeriodLength === 'WEEKLY' || payPeriodLength === 'BIWEEKLY';
}

function validateFirstPayrollRunDays(
  value: number | null,
  payPeriodLength: PayPeriodLength,
) {
  if (value === null) {
    return;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('First payroll run days must be a positive whole number.');
  }

  const maxDays = getNominalPayPeriodDays(payPeriodLength);
  if (value > maxDays) {
    throw new Error(`First payroll run days cannot exceed ${maxDays} days.`);
  }
}

function validateAutoClockOutHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Auto clock-out hours must be greater than 0.');
  }
  if (value > 24) {
    throw new Error('Auto clock-out hours cannot exceed 24.');
  }
}

export async function ensureDefaultAdminPin() {
  const existing = await getSettingValue(ADMIN_PIN_KEY);
  if (existing) {
    return;
  }
  const hash = await hashPin(DEFAULT_ADMIN_PIN);
  await upsertSetting(ADMIN_PIN_KEY, hash);
}

export async function verifyAdminPin(pin: string) {
  validateAdminPin(pin);
  const storedHash = await getSettingValue(ADMIN_PIN_KEY);
  if (!storedHash) {
    return false;
  }
  return verifyPin(pin, storedHash);
}

export async function changeAdminPin(currentPin: string, nextPin: string) {
  validateAdminPin(currentPin);
  validateAdminPin(nextPin);

  const validCurrentPin = await verifyAdminPin(currentPin);
  if (!validCurrentPin) {
    return false;
  }

  const nextHash = await hashPin(nextPin);
  await upsertSetting(ADMIN_PIN_KEY, nextHash);
  return true;
}

export async function resetAdminPinToDefault() {
  const defaultHash = await hashPin(DEFAULT_ADMIN_PIN);
  await upsertSetting(ADMIN_PIN_KEY, defaultHash);
}

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const [
    storedPayPeriodLength,
    legacyPayPeriodLength,
    storedPayPeriodStartDay,
    legacyPayPeriodStartDay,
    storedPayPeriodStartDate,
    storedFirstPayrollRunDays,
    storedAutoClockOutEnabled,
    storedAutoClockOutHours,
  ] = await Promise.all([
    getSettingValue(PAY_PERIOD_LENGTH_KEY),
    getSettingValue(LEGACY_PAY_PERIOD_LENGTH_KEY),
    getSettingValue(PAY_PERIOD_START_DAY_KEY),
    getSettingValue(LEGACY_PAY_PERIOD_START_DAY_KEY),
    getSettingValue(PAY_PERIOD_START_DATE_KEY),
    getSettingValue(FIRST_PAYROLL_RUN_DAYS_KEY),
    getSettingValue(AUTO_CLOCK_OUT_ENABLED_KEY),
    getSettingValue(AUTO_CLOCK_OUT_HOURS_KEY),
  ]);

  const payPeriodLengthCandidate = storedPayPeriodLength ?? legacyPayPeriodLength;
  const payPeriodLength = PAY_PERIOD_LENGTHS.includes(
    payPeriodLengthCandidate as PayPeriodLength,
  )
    ? (payPeriodLengthCandidate as PayPeriodLength)
    : DEFAULT_PAYROLL_SETTINGS.payPeriodLength;

  const payPeriodStartDayCandidate = storedPayPeriodStartDay ?? legacyPayPeriodStartDay;
  const payPeriodStartDay = PAY_PERIOD_START_DAYS.includes(
    payPeriodStartDayCandidate as PayPeriodStartDay,
  )
    ? (payPeriodStartDayCandidate as PayPeriodStartDay)
    : DEFAULT_PAYROLL_SETTINGS.payPeriodStartDay;

  const payPeriodStartDate = isValidIsoDate(storedPayPeriodStartDate ?? '')
    ? (storedPayPeriodStartDate as string)
    : DEFAULT_PAYROLL_SETTINGS.payPeriodStartDate;

  const firstPayrollRunDaysRaw = Number.parseInt(storedFirstPayrollRunDays ?? '', 10);
  const parsedFirstPayrollRunDays =
    Number.isInteger(firstPayrollRunDaysRaw) && firstPayrollRunDaysRaw > 0
      ? firstPayrollRunDaysRaw
      : DEFAULT_PAYROLL_SETTINGS.firstPayrollRunDays;
  let firstPayrollRunDays = parsedFirstPayrollRunDays;
  try {
    validateFirstPayrollRunDays(firstPayrollRunDays, payPeriodLength);
    if (!supportsFirstPayrollRunDays(payPeriodLength)) {
      firstPayrollRunDays = null;
    }
  } catch {
    firstPayrollRunDays = null;
  }

  const autoClockOutEnabled =
    storedAutoClockOutEnabled === '1'
      ? true
      : storedAutoClockOutEnabled === '0'
        ? false
        : DEFAULT_PAYROLL_SETTINGS.autoClockOutEnabled;

  const autoClockOutHoursRaw = Number.parseFloat(storedAutoClockOutHours ?? '');
  const parsedAutoClockOutHours =
    Number.isFinite(autoClockOutHoursRaw) && autoClockOutHoursRaw > 0
      ? autoClockOutHoursRaw
      : DEFAULT_PAYROLL_SETTINGS.autoClockOutHours;
  let autoClockOutHours = parsedAutoClockOutHours;
  try {
    validateAutoClockOutHours(autoClockOutHours);
  } catch {
    autoClockOutHours = DEFAULT_PAYROLL_SETTINGS.autoClockOutHours;
  }

  return {
    autoClockOutEnabled,
    autoClockOutHours,
    payPeriodLength,
    payPeriodStartDay,
    payPeriodStartDate,
    firstPayrollRunDays,
  };
}

export async function savePayrollSettings(settings: PayrollSettings) {
  validatePayPeriodLength(settings.payPeriodLength);
  validatePayPeriodStartDay(settings.payPeriodStartDay);
  validatePayPeriodStartDate(settings.payPeriodStartDate);
  validateAutoClockOutHours(settings.autoClockOutHours);
  const normalizedFirstPayrollRunDays = supportsFirstPayrollRunDays(
    settings.payPeriodLength,
  )
    ? settings.firstPayrollRunDays
    : null;
  validateFirstPayrollRunDays(normalizedFirstPayrollRunDays, settings.payPeriodLength);

  await Promise.all([
    upsertSetting(PAY_PERIOD_LENGTH_KEY, settings.payPeriodLength),
    upsertSetting(PAY_PERIOD_START_DAY_KEY, settings.payPeriodStartDay),
    upsertSetting(PAY_PERIOD_START_DATE_KEY, settings.payPeriodStartDate),
    upsertSetting(
      AUTO_CLOCK_OUT_ENABLED_KEY,
      settings.autoClockOutEnabled ? '1' : '0',
    ),
    upsertSetting(AUTO_CLOCK_OUT_HOURS_KEY, String(settings.autoClockOutHours)),
    normalizedFirstPayrollRunDays === null
      ? deleteSetting(FIRST_PAYROLL_RUN_DAYS_KEY)
      : upsertSetting(
          FIRST_PAYROLL_RUN_DAYS_KEY,
          String(normalizedFirstPayrollRunDays),
        ),
  ]);
}
