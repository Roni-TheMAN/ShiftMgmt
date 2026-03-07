import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  ClockEventAdminTag,
  ClockEventSource,
  ClockEventType,
  ClockEventWithEmployee,
} from '../../types/database';
import { ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH } from '../../constants/app';
import { getDatabase } from '../db/database';

function nowIso() {
  return new Date().toISOString();
}

type EmployeeLatestEventTypeRow = {
  type: ClockEventType;
};

type EmployeeEventRow = {
  id: number;
  type: ClockEventType;
  timestamp: string;
};

async function getLatestEmployeeEventType(
  db: SQLiteDatabase,
  employeeId: number,
) {
  const latest = await db.getFirstAsync<EmployeeLatestEventTypeRow>(
    `SELECT type
     FROM clock_events
     WHERE employee_id = ?
     ORDER BY timestamp DESC, id DESC
     LIMIT 1`,
    employeeId,
  );
  return latest?.type ?? null;
}

async function listEmployeeEventRows(
  db: SQLiteDatabase,
  employeeId: number,
) {
  return db.getAllAsync<EmployeeEventRow>(
    `SELECT id, type, timestamp
     FROM clock_events
     WHERE employee_id = ?
     ORDER BY timestamp ASC, id ASC`,
    employeeId,
  );
}

function validateEmployeeShiftSequence(rows: EmployeeEventRow[]) {
  if (rows.length === 0) {
    return;
  }

  if (rows[0].type !== 'IN') {
    throw new Error('Invalid shift sequence: first event must be CLOCK IN.');
  }

  for (let i = 1; i < rows.length; i += 1) {
    const previous = rows[i - 1];
    const current = rows[i];
    if (current.type === previous.type) {
      throw new Error('Invalid shift sequence: duplicate consecutive event type.');
    }

    if (previous.type === 'IN' && current.type === 'OUT') {
      const inTs = new Date(previous.timestamp).getTime();
      const outTs = new Date(current.timestamp).getTime();
      if (!Number.isFinite(inTs) || !Number.isFinite(outTs) || outTs <= inTs) {
        throw new Error('Clock-out timestamp must be after clock-in timestamp.');
      }
    }
  }
}

async function assertEmployeeShiftSequence(db: SQLiteDatabase, employeeId: number) {
  const rows = await listEmployeeEventRows(db, employeeId);
  validateEmployeeShiftSequence(rows);
}

type EventByIdRow = {
  id: number;
  employee_id: number;
  type: ClockEventType;
  source: ClockEventSource;
  timestamp: string;
  admin_tag: ClockEventAdminTag;
  last_edited_at: string | null;
};

async function getEventById(
  db: SQLiteDatabase,
  eventId: number,
) {
  return db.getFirstAsync<EventByIdRow>(
    `SELECT id, employee_id, type, source, timestamp, admin_tag, last_edited_at
     FROM clock_events
     WHERE id = ?`,
    eventId,
  );
}

function ensureValidTimestamp(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    throw new Error('Invalid timestamp format.');
  }
}

function ensureClockOutAfterClockIn(clockInTimestamp: string, clockOutTimestamp: string) {
  const clockIn = new Date(clockInTimestamp).getTime();
  const clockOut = new Date(clockOutTimestamp).getTime();
  if (clockOut <= clockIn) {
    throw new Error('Clock-out must be after clock-in.');
  }
}

export function getClockTransitionError(
  lastEventType: ClockEventType | null,
  nextEventType: ClockEventType,
) {
  if (nextEventType === 'IN' && lastEventType === 'IN') {
    return 'Employee is already clocked in.';
  }
  if (nextEventType === 'OUT' && lastEventType !== 'IN') {
    return 'Employee is not clocked in.';
  }
  return null;
}

export async function getLatestClockEventTypeForEmployee(employeeId: number) {
  const db = await getDatabase();
  return getLatestEmployeeEventType(db, employeeId);
}

export async function createClockEvent(params: {
  employeeId: number;
  type: ClockEventType;
  timestamp: string;
  photoPath: string;
  source?: ClockEventSource;
  adminTag?: ClockEventAdminTag;
  lastEditedAt?: string | null;
}) {
  ensureValidTimestamp(params.timestamp);
  const db = await getDatabase();
  const source = params.source ?? 'MANUAL';
  const adminTag = params.adminTag ?? 'NONE';
  const lastEditedAt = params.lastEditedAt ?? null;
  await db.withTransactionAsync(async () => {
    const lastEventType = await getLatestEmployeeEventType(db, params.employeeId);
    const transitionError = getClockTransitionError(lastEventType, params.type);
    if (transitionError) {
      throw new Error(transitionError);
    }

    await db.runAsync(
      `INSERT INTO clock_events (
         employee_id,
         type,
         source,
         admin_tag,
         last_edited_at,
         timestamp,
         photo_path,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params.employeeId,
      params.type,
      source,
      adminTag,
      lastEditedAt,
      params.timestamp,
      params.photoPath,
      nowIso(),
    );
  });
}

export async function listClockEventsWithEmployee(limit = 300) {
  const db = await getDatabase();
  return db.getAllAsync<ClockEventWithEmployee>(
    `SELECT
       clock_events.id,
       clock_events.employee_id,
       clock_events.type,
       clock_events.source,
       clock_events.admin_tag,
       clock_events.last_edited_at,
       clock_events.timestamp,
       clock_events.photo_path,
       clock_events.created_at,
       employees.name AS employee_name
     FROM clock_events
     INNER JOIN employees ON employees.id = clock_events.employee_id
     ORDER BY clock_events.timestamp DESC
     LIMIT ?`,
    limit,
  );
}

export async function listAllClockEventsWithEmployee() {
  const db = await getDatabase();
  return db.getAllAsync<ClockEventWithEmployee>(
    `SELECT
       clock_events.id,
       clock_events.employee_id,
       clock_events.type,
       clock_events.source,
       clock_events.admin_tag,
       clock_events.last_edited_at,
       clock_events.timestamp,
       clock_events.photo_path,
       clock_events.created_at,
       employees.name AS employee_name
     FROM clock_events
     INNER JOIN employees ON employees.id = clock_events.employee_id
     ORDER BY clock_events.timestamp DESC`,
  );
}

export async function listClockEventsWithEmployeeInRange(
  startTimestampInclusive: string,
  endTimestampExclusive: string,
) {
  const db = await getDatabase();
  return db.getAllAsync<ClockEventWithEmployee>(
    `SELECT
       clock_events.id,
       clock_events.employee_id,
       clock_events.type,
       clock_events.source,
       clock_events.admin_tag,
       clock_events.last_edited_at,
       clock_events.timestamp,
       clock_events.photo_path,
       clock_events.created_at,
       employees.name AS employee_name
     FROM clock_events
     INNER JOIN employees ON employees.id = clock_events.employee_id
     WHERE clock_events.timestamp >= ?
       AND clock_events.timestamp < ?
     ORDER BY clock_events.employee_id ASC, clock_events.timestamp ASC`,
    startTimestampInclusive,
    endTimestampExclusive,
  );
}

export async function findFirstClockOutAfterTimestamp(params: {
  employeeId: number;
  afterTimestampExclusive: string;
}) {
  const db = await getDatabase();
  return db.getFirstAsync<ClockEventWithEmployee>(
    `SELECT
       clock_events.id,
       clock_events.employee_id,
       clock_events.type,
       clock_events.source,
       clock_events.admin_tag,
       clock_events.last_edited_at,
       clock_events.timestamp,
       clock_events.photo_path,
       clock_events.created_at,
       employees.name AS employee_name
     FROM clock_events
     INNER JOIN employees ON employees.id = clock_events.employee_id
     WHERE clock_events.employee_id = ?
       AND clock_events.type = 'OUT'
       AND clock_events.timestamp > ?
     ORDER BY clock_events.timestamp ASC, clock_events.id ASC
     LIMIT 1`,
    params.employeeId,
    params.afterTimestampExclusive,
  );
}

type OpenClockInCandidate = {
  employee_id: number;
  employee_name: string;
  last_in_timestamp: string;
};

export async function listOpenClockInCandidates() {
  const db = await getDatabase();
  return db.getAllAsync<OpenClockInCandidate>(
    `SELECT
       employees.id AS employee_id,
       employees.name AS employee_name,
       latest_event.timestamp AS last_in_timestamp
     FROM employees
     INNER JOIN clock_events AS latest_event
       ON latest_event.id = (
         SELECT clock_events.id
         FROM clock_events
         WHERE clock_events.employee_id = employees.id
         ORDER BY clock_events.id DESC
         LIMIT 1
       )
     WHERE latest_event.type = 'IN'`,
  );
}

export async function upsertAdminShift(params: {
  employeeId: number;
  clockInTimestamp: string;
  clockOutTimestamp?: string | null;
  clockInEventId?: number | null;
  clockOutEventId?: number | null;
}) {
  ensureValidTimestamp(params.clockInTimestamp);
  if (params.clockOutTimestamp) {
    ensureValidTimestamp(params.clockOutTimestamp);
    ensureClockOutAfterClockIn(params.clockInTimestamp, params.clockOutTimestamp);
  }

  const db = await getDatabase();
  const editTimestamp = nowIso();
  await db.withTransactionAsync(async () => {
    let effectiveClockInEventId = params.clockInEventId ?? null;
    let effectiveClockOutEventId = params.clockOutEventId ?? null;

    if (effectiveClockInEventId) {
      const existingInEvent = await getEventById(db, effectiveClockInEventId);
      if (!existingInEvent || existingInEvent.employee_id !== params.employeeId) {
        throw new Error('Clock-in event was not found for this employee.');
      }
      if (existingInEvent.type !== 'IN') {
        throw new Error('Selected clock-in event is invalid.');
      }
      if (existingInEvent.timestamp !== params.clockInTimestamp) {
        await db.runAsync(
          `UPDATE clock_events
           SET timestamp = ?, source = ?, photo_path = ?, admin_tag = ?, last_edited_at = ?
           WHERE id = ?`,
          params.clockInTimestamp,
          'MANUAL',
          ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH,
          'EDITED',
          editTimestamp,
          effectiveClockInEventId,
        );
      }
    } else {
      const insertInResult = await db.runAsync(
        `INSERT INTO clock_events (
           employee_id,
           type,
           source,
           admin_tag,
           last_edited_at,
           timestamp,
           photo_path,
           created_at
         )
         VALUES (?, 'IN', 'MANUAL', 'CREATED', ?, ?, ?, ?)`,
        params.employeeId,
        editTimestamp,
        params.clockInTimestamp,
        ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH,
        editTimestamp,
      );
      effectiveClockInEventId = insertInResult.lastInsertRowId;
    }

    if (params.clockOutTimestamp) {
      if (effectiveClockOutEventId) {
        const existingOutEvent = await getEventById(db, effectiveClockOutEventId);
        if (!existingOutEvent || existingOutEvent.employee_id !== params.employeeId) {
          throw new Error('Clock-out event was not found for this employee.');
        }
        if (existingOutEvent.type !== 'OUT') {
          throw new Error('Selected clock-out event is invalid.');
        }
        if (existingOutEvent.timestamp !== params.clockOutTimestamp) {
          await db.runAsync(
            `UPDATE clock_events
             SET timestamp = ?, source = ?, photo_path = ?, admin_tag = ?, last_edited_at = ?
             WHERE id = ?`,
            params.clockOutTimestamp,
            'MANUAL',
            ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH,
            'EDITED',
            editTimestamp,
            effectiveClockOutEventId,
          );
        }
      } else {
        const insertOutResult = await db.runAsync(
          `INSERT INTO clock_events (
             employee_id,
             type,
             source,
             admin_tag,
             last_edited_at,
             timestamp,
             photo_path,
             created_at
           )
           VALUES (?, 'OUT', 'MANUAL', 'CREATED', ?, ?, ?, ?)`,
          params.employeeId,
          editTimestamp,
          params.clockOutTimestamp,
          ADMIN_MANUAL_EVENT_MARKER_PHOTO_PATH,
          editTimestamp,
        );
        effectiveClockOutEventId = insertOutResult.lastInsertRowId;
      }
    }

    await assertEmployeeShiftSequence(db, params.employeeId);
  });
}

export async function deleteAdminShift(params: {
  employeeId: number;
  clockInEventId?: number | null;
  clockOutEventId?: number | null;
}) {
  if (!params.clockInEventId && !params.clockOutEventId) {
    throw new Error('No shift events were selected for deletion.');
  }

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (params.clockInEventId) {
      const inEvent = await getEventById(db, params.clockInEventId);
      if (!inEvent || inEvent.employee_id !== params.employeeId || inEvent.type !== 'IN') {
        throw new Error('Clock-in event could not be deleted.');
      }
      await db.runAsync('DELETE FROM clock_events WHERE id = ?', params.clockInEventId);
    }

    if (params.clockOutEventId) {
      const outEvent = await getEventById(db, params.clockOutEventId);
      if (!outEvent || outEvent.employee_id !== params.employeeId || outEvent.type !== 'OUT') {
        throw new Error('Clock-out event could not be deleted.');
      }
      await db.runAsync('DELETE FROM clock_events WHERE id = ?', params.clockOutEventId);
    }

    await assertEmployeeShiftSequence(db, params.employeeId);
  });
}

export async function countClockEvents() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM clock_events',
  );
  return row?.total ?? 0;
}

export async function deleteAllClockEvents() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM clock_events');
}
