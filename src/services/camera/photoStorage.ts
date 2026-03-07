import * as FileSystem from 'expo-file-system/legacy';
import { PHOTO_DIRECTORY_NAME } from '../../constants/app';
import type { ClockEventType } from '../../types/database';

function getPhotoDirectoryUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Document directory is unavailable on this device.');
  }
  return `${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}`;
}

export async function ensurePhotoDirectory() {
  const directoryUri = getPhotoDirectoryUri();
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }
  return directoryUri;
}

export async function saveCapturedPhoto(params: {
  sourceUri: string;
  employeeId: number;
  eventType: ClockEventType;
}) {
  const directoryUri = await ensurePhotoDirectory();
  const fileName = `${params.employeeId}_${params.eventType}_${Date.now()}.jpg`;
  const destinationUri = `${directoryUri}/${fileName}`;
  await FileSystem.copyAsync({
    from: params.sourceUri,
    to: destinationUri,
  });
  return destinationUri;
}

export async function deleteAllSavedPhotos() {
  const directoryUri = getPhotoDirectoryUri();
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (!info.exists || !info.isDirectory) {
    return;
  }

  const entries = await FileSystem.readDirectoryAsync(directoryUri);
  await Promise.all(
    entries.map(async (entry) => {
      await FileSystem.deleteAsync(`${directoryUri}/${entry}`, {
        idempotent: true,
      });
    }),
  );
}
