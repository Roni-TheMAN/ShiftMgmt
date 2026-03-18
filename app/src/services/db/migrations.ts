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
  {
    version: 5,
    statements: [
      `ALTER TABLE employees ADD COLUMN job_title TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE employees ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE employees ADD COLUMN department TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE employees ADD COLUMN start_date TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE employees ADD COLUMN photo_path TEXT`,
      `ALTER TABLE employees ADD COLUMN address TEXT`,
      `ALTER TABLE employees ADD COLUMN email TEXT`,
      `ALTER TABLE employees ADD COLUMN phone_number TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 6,
    statements: [
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_type TEXT NOT NULL,
        actor_label TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        summary TEXT NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
        ON audit_logs(created_at DESC, id DESC)`,
      `UPDATE employees
       SET pin_code = NULL
       WHERE pin_code IS NOT NULL`,
    ],
  },
  {
    version: 7,
    statements: [
      `CREATE TABLE IF NOT EXISTS employee_pay_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        hourly_rate REAL NOT NULL,
        effective_start_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(employee_id) REFERENCES employees(id)
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_pay_rates_employee_effective_unique
        ON employee_pay_rates(employee_id, effective_start_date)`,
      `CREATE INDEX IF NOT EXISTS idx_employee_pay_rates_employee_effective
        ON employee_pay_rates(employee_id, effective_start_date DESC, id DESC)`,
      `INSERT INTO employee_pay_rates (
         employee_id,
         hourly_rate,
         effective_start_date,
         created_at,
         updated_at
       )
       SELECT
         employees.id,
         employees.hourly_rate,
         CASE
           WHEN employees.start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
             THEN employees.start_date
           WHEN LENGTH(employees.created_at) >= 10
             THEN SUBSTR(employees.created_at, 1, 10)
           ELSE STRFTIME('%Y-%m-%d', 'now')
         END,
         COALESCE(NULLIF(employees.created_at, ''), STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
         COALESCE(
           NULLIF(employees.updated_at, ''),
           NULLIF(employees.created_at, ''),
           STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
         )
       FROM employees
       WHERE NOT EXISTS (
         SELECT 1
         FROM employee_pay_rates
         WHERE employee_pay_rates.employee_id = employees.id
       )`,
      `CREATE TABLE IF NOT EXISTS payroll_period_approvals (
        period_start_date TEXT PRIMARY KEY NOT NULL,
        period_end_date TEXT NOT NULL,
        note TEXT,
        approved_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_period_approvals_updated_at
        ON payroll_period_approvals(updated_at DESC, period_start_date DESC)`,
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
