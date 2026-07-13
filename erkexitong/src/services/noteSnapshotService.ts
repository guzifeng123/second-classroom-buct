import Taro from "@tarojs/taro";
import type { NoteReference } from "../types/evaluation";
import {
  buildNoteSnapshotIndexEntry,
  buildNoteSnapshotRoute,
  mergeNoteSnapshotIndex,
  NOTE_SNAPSHOT_INDEX_KEY,
  NOTE_SNAPSHOT_STORAGE_KEY
} from "../utils/noteSnapshot";
import type { NoteSnapshotIndexEntry } from "../utils/noteSnapshot";

async function readSnapshotIndex(): Promise<NoteSnapshotIndexEntry[]> {
  try {
    const result = await Taro.getStorage<NoteSnapshotIndexEntry[]>({ key: NOTE_SNAPSHOT_INDEX_KEY });
    return Array.isArray(result.data) ? result.data : [];
  } catch {
    return [];
  }
}

async function removeOldSnapshots(previousEntries: NoteSnapshotIndexEntry[], nextEntries: NoteSnapshotIndexEntry[]) {
  const nextKeys = new Set(nextEntries.map((entry) => entry.storageKey));
  const oldKeys = previousEntries
    .map((entry) => entry.storageKey)
    .filter((storageKey) => !nextKeys.has(storageKey));

  await Promise.all(
    oldKeys.map((key) =>
      Taro.removeStorage({ key }).catch(() => {
        // Best-effort cleanup; stale cache should not block opening the current snapshot.
      })
    )
  );
}

export async function persistNoteSnapshotPreview(reference: NoteReference): Promise<string> {
  const entry = buildNoteSnapshotIndexEntry(reference);
  const previousEntries = await readSnapshotIndex();
  const nextEntries = mergeNoteSnapshotIndex(previousEntries, entry);

  await Taro.setStorage({
    key: entry.storageKey,
    data: reference
  });
  await Taro.setStorage({
    key: NOTE_SNAPSHOT_STORAGE_KEY,
    data: reference
  });
  await Taro.setStorage({
    key: NOTE_SNAPSHOT_INDEX_KEY,
    data: nextEntries
  });
  await removeOldSnapshots(previousEntries, nextEntries);

  return buildNoteSnapshotRoute(reference);
}
