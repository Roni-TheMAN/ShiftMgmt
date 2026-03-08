import { getDatabase } from '../db/database';

export async function deleteAllOperationalData() {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM clock_events');
    await db.runAsync('DELETE FROM employees');
    await db.runAsync(
      "DELETE FROM sqlite_sequence WHERE name IN ('clock_events','employees')",
    );
  });
}
