import { ADMIN_PIN_LENGTH, DEFAULT_ADMIN_PIN } from '../../constants/app';
import { getDatabase } from '../db/database';
import { hashPin, verifyPin } from '../security/pbkdf2';
import { createAuditLog } from './auditRepository';

const ADMIN_PIN_KEY = 'admin_pin_hash';
const PAY_PERIOD_LENGTH_KEY = 'settings_pay_period_length';
const PAY_PERIOD_START_DAY_KEY = 'settings_pay_period_start_day';
const PAY_PERIOD_START_DATE_KEY = 'settings_pay_period_start_date';
const FIRST_PAYROLL_RUN_DAYS_KEY = 'settings_first_payroll_run_days';
const OT1_WEEKLY_THRESHOLD_HOURS_KEY = 'settings_ot1_weekly_threshold_hours';
const OT1_MULTIPLIER_KEY = 'settings_ot1_multiplier';
const OT2_MULTIPLIER_KEY = 'settings_ot2_multiplier';
const OT2_HOLIDAY_DATES_KEY = 'settings_ot2_holiday_dates';
const AUTO_CLOCK_OUT_ENABLED_KEY = 'settings_auto_clock_out_enabled';
const AUTO_CLOCK_OUT_HOURS_KEY = 'settings_auto_clock_out_hours';
const PROPERTY_NAME_KEY = 'settings_property_name';
const PROPERTY_ADDRESS_KEY = 'settings_property_address';
const PROPERTY_DETAILS_KEY = 'settings_property_details';
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
  ot1WeeklyThresholdHours: number;
  ot1Multiplier: number;
  ot2Multiplier: number;
  ot2HolidayDates: string[];
  autoClockOutEnabled: boolean;
  autoClockOutHours: number;
};

export type PropertySettings = {
  propertyName: string;
  propertyAddress: string;
  propertyDetails: string;
};

const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  payPeriodLength: 'WEEKLY',
  payPeriodStartDay: 'MONDAY',
  payPeriodStartDate: isoDateLocal(new Date()),
  firstPayrollRunDays: null,
  ot1WeeklyThresholdHours: 40,
  ot1Multiplier: 1.5,
  ot2Multiplier: 2,
  ot2HolidayDates: [],
  autoClockOutEnabled: false,
  autoClockOutHours: 12,
};

const DEFAULT_PROPERTY_SETTINGS: PropertySettings = {
  propertyAddress: '',
  propertyDetails: '',
  propertyName: '',
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

function validateOt1WeeklyThresholdHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('OT1 weekly threshold must be greater than 0.');
  }
  if (value > 168) {
    throw new Error('OT1 weekly threshold cannot exceed 168 hours.');
  }
}

function validateOvertimeMultiplier(label: 'OT1' | 'OT2', value: number) {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${label} multiplier must be at least 1.0.`);
  }
  if (value > 5) {
    throw new Error(`${label} multiplier cannot exceed 5.0.`);
  }
}

function normalizeHolidayDates(dates: string[]) {
  const normalized = Array.from(
    new Set(
      dates
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  for (const date of normalized) {
    if (!isValidIsoDate(date)) {
      throw new Error('Holiday dates must use YYYY-MM-DD format.');
    }
  }

  if (normalized.length > 366) {
    throw new Error('Holiday dates cannot exceed 366 entries.');
  }

  return normalized;
}

function normalizePropertyText(value: string) {
  return value.trim();
}

function validatePropertySettings(settings: PropertySettings) {
  if (settings.propertyName.length > 120) {
    throw new Error('Property name cannot exceed 120 characters.');
  }
  if (settings.propertyAddress.length > 240) {
    throw new Error('Property address cannot exceed 240 characters.');
  }
  if (settings.propertyDetails.length > 500) {
    throw new Error('Additional property details cannot exceed 500 characters.');
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
  await createAuditLog({
    action: 'ADMIN_PIN_CHANGE',
    details: {
      changedAt: nowIso(),
    },
    entityType: 'SECURITY',
    summary: 'Changed the admin PIN.',
  });
  return true;
}

export async function resetAdminPinToDefault() {
  const defaultHash = await hashPin(DEFAULT_ADMIN_PIN);
  await upsertSetting(ADMIN_PIN_KEY, defaultHash);
  await createAuditLog({
    action: 'ADMIN_PIN_RESET',
    details: {
      resetToDefault: true,
    },
    entityType: 'SECURITY',
    summary: 'Reset the admin PIN to the default value.',
  });
}

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const [
    storedPayPeriodLength,
    legacyPayPeriodLength,
    storedPayPeriodStartDay,
    legacyPayPeriodStartDay,
    storedPayPeriodStartDate,
    storedFirstPayrollRunDays,
    storedOt1WeeklyThresholdHours,
    storedOt1Multiplier,
    storedOt2Multiplier,
    storedOt2HolidayDates,
    storedAutoClockOutEnabled,
    storedAutoClockOutHours,
  ] = await Promise.all([
    getSettingValue(PAY_PERIOD_LENGTH_KEY),
    getSettingValue(LEGACY_PAY_PERIOD_LENGTH_KEY),
    getSettingValue(PAY_PERIOD_START_DAY_KEY),
    getSettingValue(LEGACY_PAY_PERIOD_START_DAY_KEY),
    getSettingValue(PAY_PERIOD_START_DATE_KEY),
    getSettingValue(FIRST_PAYROLL_RUN_DAYS_KEY),
    getSettingValue(OT1_WEEKLY_THRESHOLD_HOURS_KEY),
    getSettingValue(OT1_MULTIPLIER_KEY),
    getSettingValue(OT2_MULTIPLIER_KEY),
    getSettingValue(OT2_HOLIDAY_DATES_KEY),
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

  const ot1WeeklyThresholdRaw = Number.parseFloat(storedOt1WeeklyThresholdHours ?? '');
  const parsedOt1WeeklyThreshold =
    Number.isFinite(ot1WeeklyThresholdRaw) && ot1WeeklyThresholdRaw > 0
      ? ot1WeeklyThresholdRaw
      : DEFAULT_PAYROLL_SETTINGS.ot1WeeklyThresholdHours;
  let ot1WeeklyThresholdHours = parsedOt1WeeklyThreshold;
  try {
    validateOt1WeeklyThresholdHours(ot1WeeklyThresholdHours);
  } catch {
    ot1WeeklyThresholdHours = DEFAULT_PAYROLL_SETTINGS.ot1WeeklyThresholdHours;
  }

  const ot1MultiplierRaw = Number.parseFloat(storedOt1Multiplier ?? '');
  const parsedOt1Multiplier =
    Number.isFinite(ot1MultiplierRaw) && ot1MultiplierRaw >= 1
      ? ot1MultiplierRaw
      : DEFAULT_PAYROLL_SETTINGS.ot1Multiplier;
  let ot1Multiplier = parsedOt1Multiplier;
  try {
    validateOvertimeMultiplier('OT1', ot1Multiplier);
  } catch {
    ot1Multiplier = DEFAULT_PAYROLL_SETTINGS.ot1Multiplier;
  }

  const ot2MultiplierRaw = Number.parseFloat(storedOt2Multiplier ?? '');
  const parsedOt2Multiplier =
    Number.isFinite(ot2MultiplierRaw) && ot2MultiplierRaw >= 1
      ? ot2MultiplierRaw
      : DEFAULT_PAYROLL_SETTINGS.ot2Multiplier;
  let ot2Multiplier = parsedOt2Multiplier;
  try {
    validateOvertimeMultiplier('OT2', ot2Multiplier);
  } catch {
    ot2Multiplier = DEFAULT_PAYROLL_SETTINGS.ot2Multiplier;
  }

  let ot2HolidayDates = DEFAULT_PAYROLL_SETTINGS.ot2HolidayDates;
  if (storedOt2HolidayDates) {
    try {
      const parsed = JSON.parse(storedOt2HolidayDates);
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
        ot2HolidayDates = normalizeHolidayDates(parsed);
      }
    } catch {
      ot2HolidayDates = DEFAULT_PAYROLL_SETTINGS.ot2HolidayDates;
    }
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
    ot1Multiplier,
    ot1WeeklyThresholdHours,
    ot2HolidayDates,
    ot2Multiplier,
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
  validateOt1WeeklyThresholdHours(settings.ot1WeeklyThresholdHours);
  validateOvertimeMultiplier('OT1', settings.ot1Multiplier);
  validateOvertimeMultiplier('OT2', settings.ot2Multiplier);
  const normalizedHolidayDates = normalizeHolidayDates(settings.ot2HolidayDates);
  validateAutoClockOutHours(settings.autoClockOutHours);
  const normalizedFirstPayrollRunDays = supportsFirstPayrollRunDays(
    settings.payPeriodLength,
  )
    ? settings.firstPayrollRunDays
    : null;
  validateFirstPayrollRunDays(normalizedFirstPayrollRunDays, settings.payPeriodLength);
  const currentSettings = await getPayrollSettings();

  await Promise.all([
    upsertSetting(PAY_PERIOD_LENGTH_KEY, settings.payPeriodLength),
    upsertSetting(PAY_PERIOD_START_DAY_KEY, settings.payPeriodStartDay),
    upsertSetting(PAY_PERIOD_START_DATE_KEY, settings.payPeriodStartDate),
    upsertSetting(
      AUTO_CLOCK_OUT_ENABLED_KEY,
      settings.autoClockOutEnabled ? '1' : '0',
    ),
    upsertSetting(
      OT1_WEEKLY_THRESHOLD_HOURS_KEY,
      String(settings.ot1WeeklyThresholdHours),
    ),
    upsertSetting(OT1_MULTIPLIER_KEY, String(settings.ot1Multiplier)),
    upsertSetting(OT2_MULTIPLIER_KEY, String(settings.ot2Multiplier)),
    upsertSetting(OT2_HOLIDAY_DATES_KEY, JSON.stringify(normalizedHolidayDates)),
    upsertSetting(AUTO_CLOCK_OUT_HOURS_KEY, String(settings.autoClockOutHours)),
    normalizedFirstPayrollRunDays === null
      ? deleteSetting(FIRST_PAYROLL_RUN_DAYS_KEY)
      : upsertSetting(
          FIRST_PAYROLL_RUN_DAYS_KEY,
          String(normalizedFirstPayrollRunDays),
        ),
  ]);

  const hasChanges =
    currentSettings.autoClockOutEnabled !== settings.autoClockOutEnabled ||
    currentSettings.autoClockOutHours !== settings.autoClockOutHours ||
    currentSettings.firstPayrollRunDays !== normalizedFirstPayrollRunDays ||
    currentSettings.ot1Multiplier !== settings.ot1Multiplier ||
    currentSettings.ot1WeeklyThresholdHours !== settings.ot1WeeklyThresholdHours ||
    currentSettings.ot2Multiplier !== settings.ot2Multiplier ||
    JSON.stringify(currentSettings.ot2HolidayDates) !== JSON.stringify(normalizedHolidayDates) ||
    currentSettings.payPeriodLength !== settings.payPeriodLength ||
    currentSettings.payPeriodStartDate !== settings.payPeriodStartDate ||
    currentSettings.payPeriodStartDay !== settings.payPeriodStartDay;

  if (hasChanges) {
    await createAuditLog({
      action: 'PAYROLL_SETTINGS_UPDATE',
      details: {
        autoClockOutEnabled: settings.autoClockOutEnabled,
        autoClockOutHours: settings.autoClockOutHours,
        firstPayrollRunDays: normalizedFirstPayrollRunDays,
        ot1Multiplier: settings.ot1Multiplier,
        ot1WeeklyThresholdHours: settings.ot1WeeklyThresholdHours,
        ot2HolidayDates: normalizedHolidayDates,
        ot2Multiplier: settings.ot2Multiplier,
        payPeriodLength: settings.payPeriodLength,
        payPeriodStartDate: settings.payPeriodStartDate,
        payPeriodStartDay: settings.payPeriodStartDay,
      },
      entityType: 'PAYROLL_SETTINGS',
      summary: 'Updated payroll settings.',
    });
  }
}

export async function getPropertySettings(): Promise<PropertySettings> {
  const [storedName, storedAddress, storedDetails] = await Promise.all([
    getSettingValue(PROPERTY_NAME_KEY),
    getSettingValue(PROPERTY_ADDRESS_KEY),
    getSettingValue(PROPERTY_DETAILS_KEY),
  ]);

  return {
    propertyAddress: storedAddress ?? DEFAULT_PROPERTY_SETTINGS.propertyAddress,
    propertyDetails: storedDetails ?? DEFAULT_PROPERTY_SETTINGS.propertyDetails,
    propertyName: storedName ?? DEFAULT_PROPERTY_SETTINGS.propertyName,
  };
}

export async function savePropertySettings(settings: PropertySettings) {
  const normalized: PropertySettings = {
    propertyAddress: normalizePropertyText(settings.propertyAddress),
    propertyDetails: normalizePropertyText(settings.propertyDetails),
    propertyName: normalizePropertyText(settings.propertyName),
  };
  validatePropertySettings(normalized);
  const currentSettings = await getPropertySettings();

  await Promise.all([
    upsertSetting(PROPERTY_NAME_KEY, normalized.propertyName),
    upsertSetting(PROPERTY_ADDRESS_KEY, normalized.propertyAddress),
    upsertSetting(PROPERTY_DETAILS_KEY, normalized.propertyDetails),
  ]);

  const hasChanges =
    currentSettings.propertyAddress !== normalized.propertyAddress ||
    currentSettings.propertyDetails !== normalized.propertyDetails ||
    currentSettings.propertyName !== normalized.propertyName;

  if (hasChanges) {
    await createAuditLog({
      action: 'PROPERTY_SETTINGS_UPDATE',
      details: normalized,
      entityType: 'PROPERTY_SETTINGS',
      summary: 'Updated property profile settings.',
    });
  }
}
