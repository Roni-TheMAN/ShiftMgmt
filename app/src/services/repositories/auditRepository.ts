import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db/database';
import type { AuditLogRecord } from '../../types/database';

export type AuditActorType = 'ADMIN' | 'SYSTEM';

export type AuditLogInput = {
  actorLabel?: string;
  actorType?: AuditActorType;
  action: string;
  entityId?: number | string | null;
  entityType: string;
  summary: string;
  details?: Record<string, unknown> | null;
};

const DEFAULT_ACTOR_LABEL = 'Authenticated Admin';

function nowIso() {
  return new Date().toISOString();
}

function normalizeSummary(value: string) {
  return value.trim().slice(0, 240);
}

function serializeDetails(details?: Record<string, unknown> | null) {
  if (!details) {
    return null;
  }

  const normalizedEntries = Object.entries(details).filter(([, value]) => value !== undefined);
  if (normalizedEntries.length === 0) {
    return null;
  }

  return JSON.stringify(Object.fromEntries(normalizedEntries));
}

export async function insertAuditLog(
  db: SQLiteDatabase,
  input: AuditLogInput,
) {
  const summary = normalizeSummary(input.summary);
  if (!summary) {
    throw new Error('Audit summary is required.');
  }

  await db.runAsync(
    `INSERT INTO audit_logs (
       actor_type,
       actor_label,
       action,
       entity_type,
       entity_id,
       summary,
       details_json,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.actorType ?? 'ADMIN',
    input.actorLabel?.trim() || DEFAULT_ACTOR_LABEL,
    input.action,
    input.entityType,
    input.entityId === null || input.entityId === undefined
      ? null
      : String(input.entityId),
    summary,
    serializeDetails(input.details),
    nowIso(),
  );
}

export async function createAuditLog(input: AuditLogInput) {
  const db = await getDatabase();
  await insertAuditLog(db, input);
}

export async function listAuditLogs(limit = 200) {
  const db = await getDatabase();
  return db.getAllAsync<AuditLogRecord>(
    `SELECT
       id,
       actor_type,
       actor_label,
       action,
       entity_type,
       entity_id,
       summary,
       details_json,
       created_at
     FROM audit_logs
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    limit,
  );
}
