import { AUTO_CLOCK_OUT_MARKER_PHOTO_PATH } from '../../constants/app';
import {
  createClockEvent,
  listOpenClockInCandidates,
} from '../repositories/clockEventRepository';
import { getPayrollSettings } from '../repositories/settingsRepository';

const MS_PER_HOUR = 60 * 60 * 1000;

export async function runAutoClockOutSweep() {
  const settings = await getPayrollSettings();
  if (!settings.autoClockOutEnabled) {
    return {
      autoClockOutCount: 0,
      checkedOpenShiftCount: 0,
      errors: [] as string[],
    };
  }

  const thresholdMs = settings.autoClockOutHours * MS_PER_HOUR;
  const now = Date.now();
  const candidates = await listOpenClockInCandidates();
  const errors: string[] = [];
  let autoClockOutCount = 0;

  for (const candidate of candidates) {
    const clockInTime = new Date(candidate.last_in_timestamp);
    if (Number.isNaN(clockInTime.getTime())) {
      errors.push(`Invalid IN timestamp for ${candidate.employee_name}.`);
      continue;
    }

    if (now - clockInTime.getTime() < thresholdMs) {
      continue;
    }

    const autoClockOutTimestamp = new Date(
      clockInTime.getTime() + thresholdMs,
    ).toISOString();

    try {
      await createClockEvent({
        employeeId: candidate.employee_id,
        photoPath: AUTO_CLOCK_OUT_MARKER_PHOTO_PATH,
        source: 'AUTO',
        timestamp: autoClockOutTimestamp,
        type: 'OUT',
      });
      autoClockOutCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Employee is not clocked in.')) {
        continue;
      }
      errors.push(`${candidate.employee_name}: ${message}`);
    }
  }

  return {
    autoClockOutCount,
    checkedOpenShiftCount: candidates.length,
    errors,
  };
}
