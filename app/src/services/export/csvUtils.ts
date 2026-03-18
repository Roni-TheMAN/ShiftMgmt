import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export function escapeCsvValue(value: string) {
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

export async function writeAndShareCsv(params: {
  baseFileName: string;
  csvContent: string;
  dialogTitle: string;
}) {
  const fileUri = `${ensureWriteDirectory()}${params.baseFileName}-${Date.now()}.csv`;

  await FileSystem.writeAsStringAsync(fileUri, params.csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      UTI: 'public.comma-separated-values-text',
      dialogTitle: params.dialogTitle,
      mimeType: 'text/csv',
    });
  }

  return fileUri;
}
