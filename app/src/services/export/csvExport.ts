import { listAllClockEventsWithEmployee } from '../repositories/clockEventRepository';
import { escapeCsvValue, writeAndShareCsv } from './csvUtils';

export async function exportClockEventsCsv() {
  const rows = await listAllClockEventsWithEmployee();
  const lines = [
    'id,employee_id,employee_name,type,source,admin_tag,last_edited_at,timestamp,photo_path,created_at',
  ];

  for (const row of rows) {
    lines.push(
      [
        String(row.id),
        String(row.employee_id),
        escapeCsvValue(row.employee_name ?? ''),
        row.type,
        row.source,
        row.admin_tag,
        row.last_edited_at ?? '',
        row.timestamp,
        escapeCsvValue(row.photo_path),
        row.created_at,
      ].join(','),
    );
  }

  const csvContent = lines.join('\n');
  return writeAndShareCsv({
    baseFileName: 'clock-events',
    csvContent,
    dialogTitle: 'Export Clock Events',
  });
}
