import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { listAllClockEventsWithEmployee } from '../repositories/clockEventRepository';

function escapeCsvValue(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function ensureWriteDirectory() {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No writable directory is available.');
  }
  return directory;
}

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
  const fileUri = `${ensureWriteDirectory()}clock-events-${Date.now()}.csv`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export Clock Events',
      mimeType: 'text/csv',
    });
  }

  return fileUri;
}
