import type { ContentBlock } from "../types/content";
import type { NoteReference } from "../types/evaluation";

export const NOTE_SNAPSHOT_STORAGE_KEY = "erkexitong-note-snapshot-preview";
export const NOTE_SNAPSHOT_STORAGE_PREFIX = "erkexitong-note-snapshot-preview:";
export const NOTE_SNAPSHOT_INDEX_KEY = "erkexitong-note-snapshot-preview:index";
export const NOTE_SNAPSHOT_INDEX_LIMIT = 24;

export interface NoteSnapshotIndexEntry {
  storageKey: string;
  noteId: string;
  title: string;
  referencedAt: number;
  savedAt: number;
}

export interface NoteSnapshotModal {
  title: string;
  content: string;
}

export function getNoteSnapshotSummary(reference: NoteReference, maxLength = 320): string {
  const summary = reference.plainText.trim();

  if (!summary) {
    return "暂无摘要";
  }

  return summary.slice(0, maxLength);
}

export function buildNoteSnapshotModal(reference: NoteReference): NoteSnapshotModal {
  return {
    title: `《${reference.title}》快照`,
    content: `${getNoteSnapshotSummary(reference)}\n\n图片：${reference.imageCount} 张\n引用时间：${new Date(
      reference.referencedAt
    ).toLocaleString()}`
  };
}

export function getNoteSnapshotStorageKey(reference: NoteReference): string {
  return `${NOTE_SNAPSHOT_STORAGE_PREFIX}${encodeURIComponent(`${reference.noteId}-${reference.referencedAt}`)}`;
}

export function buildNoteSnapshotRoute(reference: NoteReference): string {
  return `/pages/note/snapshot/index?snapshotKey=${encodeURIComponent(getNoteSnapshotStorageKey(reference))}`;
}

export function buildNoteSnapshotIndexEntry(
  reference: NoteReference,
  savedAt = Date.now()
): NoteSnapshotIndexEntry {
  return {
    storageKey: getNoteSnapshotStorageKey(reference),
    noteId: reference.noteId,
    title: reference.title,
    referencedAt: reference.referencedAt,
    savedAt
  };
}

export function mergeNoteSnapshotIndex(
  entries: NoteSnapshotIndexEntry[],
  entry: NoteSnapshotIndexEntry,
  limit = NOTE_SNAPSHOT_INDEX_LIMIT
): NoteSnapshotIndexEntry[] {
  return [entry, ...entries.filter((candidate) => candidate.storageKey !== entry.storageKey)]
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(0, limit);
}

export function getNoteSnapshotContent(reference: NoteReference): ContentBlock[] {
  if (reference.contentSnapshot && reference.contentSnapshot.length > 0) {
    return reference.contentSnapshot;
  }

  const summary = reference.plainText.trim();
  if (!summary) {
    return [];
  }

  return [
    {
      type: "paragraph",
      text: summary
    }
  ];
}
