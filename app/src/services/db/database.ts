import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DB_NAME } from '../../constants/app';
import { runMigrations } from './migrations';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function initializeDatabase() {
  const db = await openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db);
  return db;
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase();
  }
  return databasePromise;
}
