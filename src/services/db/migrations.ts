import type { SQLiteDatabase } from 'expo-sqlite';

type Migration = {
  version: number;
  statements: string[];
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS clock_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('IN','OUT')),
        timestamp TEXT NOT NULL,
        photo_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(employee_id) REFERENCES employees(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_clock_events_employee_timestamp
        ON clock_events(employee_id, timestamp)`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      `ALTER TABLE employees ADD COLUMN pin_code TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_pin_code_unique
        ON employees(pin_code)
        WHERE pin_code IS NOT NULL`,
    ],
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE clock_events ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL'`,
    ],
  },
  {
    version: 4,
    statements: [
      `ALTER TABLE clock_events ADD COLUMN admin_tag TEXT NOT NULL DEFAULT 'NONE'`,
      `ALTER TABLE clock_events ADD COLUMN last_edited_at TEXT`,
    ],
  },
];

export async function runMigrations(db: SQLiteDatabase) {
  const versionResult =
    (await db.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version',
    )) ?? null;
  const currentVersion = versionResult?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
