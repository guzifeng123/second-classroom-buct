import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { ContentBlock } from "../types/content";
import type { DimensionKey } from "../types/evaluation";
import { createId } from "../utils/id";
import {
  filterNotes,
  mergeNoteMetadata,
  normalizeNote,
  normalizeNoteList,
  normalizeNoteSource,
  type NoteApiResponse,
  type NoteDetail,
  type NoteListApiResponse,
  type NoteSource,
  type NoteUsageContext,
  type NoteSummary
} from "../utils/noteNormalization";

const LOCAL_NOTES_KEY = "erkexitong-note-index";
export type { NoteDetail, NoteSummary } from "../utils/noteNormalization";

export interface NoteListResult {
  data: NoteSummary[];
  total: number;
  source: "local" | "remote";
  error?: string;
}

function mergeRemoteNoteMetadata(
  note: NoteDetail,
  raw: NoteApiResponse,
  existing?: NoteDetail
): NoteDetail {
  const merged = mergeNoteMetadata(note, existing);
  const hasTags = raw.tags !== undefined;
  const hasDimensionKeys = raw.dimensionKeys !== undefined || raw.dimension_keys !== undefined;
  const hasUsedCount = raw.usedCount !== undefined || raw.used_count !== undefined;

  return {
    ...merged,
    tags: hasTags ? note.tags : existing?.tags ?? note.tags,
    dimensionKeys: hasDimensionKeys ? note.dimensionKeys : existing?.dimensionKeys ?? note.dimensionKeys,
    usedCount: hasUsedCount ? note.usedCount : existing?.usedCount ?? note.usedCount
  };
}

async function readLocalNotes(): Promise<NoteDetail[]> {
  try {
    const result = await Taro.getStorage<NoteDetail[]>({ key: LOCAL_NOTES_KEY });
    return Array.isArray(result.data)
      ? result.data.map((note) => normalizeNote(note, normalizeNoteSource(note.source, "local")))
      : [];
  } catch {
    return [];
  }
}

async function writeLocalNotes(notes: NoteDetail[]): Promise<void> {
  await Taro.setStorage({
    key: LOCAL_NOTES_KEY,
    data: notes
  });
}

export async function rememberLocalNote(note: {
  id?: string | null;
  title: string;
  content: ContentBlock[];
  tags?: string[];
  dimensionKeys?: DimensionKey[];
  source?: NoteSource;
  usedCount?: number;
  recentUsedAt?: number;
  lastUsedDimensionKey?: DimensionKey;
  lastUsedSectionKey?: NoteUsageContext["sectionKey"];
  lastUsedItemId?: string;
  createdAt?: number;
  savedAt?: number;
}): Promise<NoteDetail> {
  const now = note.savedAt ?? Date.now();
  const normalized = normalizeNote({
    id: note.id || createId("note"),
    title: note.title,
    content: note.content,
    tags: note.tags,
    dimensionKeys: note.dimensionKeys,
    source: note.source,
    usedCount: note.usedCount,
    recentUsedAt: note.recentUsedAt,
    lastUsedDimensionKey: note.lastUsedDimensionKey,
    lastUsedSectionKey: note.lastUsedSectionKey,
    lastUsedItemId: note.lastUsedItemId,
    createdAt: note.createdAt ?? now,
    updatedAt: now
  }, note.source ?? "local");
  const notes = await readLocalNotes();
  const existing = notes.find((candidate) => candidate.id === normalized.id);
  const merged = mergeNoteMetadata(normalized, existing);
  const nextNote = {
    ...merged,
    tags: note.tags === undefined ? merged.tags : normalized.tags,
    dimensionKeys: note.dimensionKeys === undefined ? merged.dimensionKeys : normalized.dimensionKeys,
    source: note.source === undefined ? existing?.source ?? normalized.source : normalized.source
  };
  const nextNotes = [nextNote, ...notes.filter((candidate) => candidate.id !== normalized.id)].sort(
    (left, right) => right.updatedAt - left.updatedAt
  );

  await writeLocalNotes(nextNotes);
  return nextNote;
}

export async function markNoteUsed(noteId: string, context: NoteUsageContext): Promise<NoteDetail | undefined> {
  const notes = await readLocalNotes();
  const usedAt = context.usedAt ?? Date.now();
  let updatedNote: NoteDetail | undefined;
  const nextNotes = notes.map((note) => {
    if (note.id !== noteId) {
      return note;
    }

    updatedNote = {
      ...note,
      dimensionKeys: [...new Set([...note.dimensionKeys, context.dimensionKey])],
      usedCount: note.usedCount + 1,
      recentUsedAt: usedAt,
      lastUsedDimensionKey: context.dimensionKey,
      lastUsedSectionKey: context.sectionKey,
      lastUsedItemId: context.itemId
    };
    return updatedNote;
  });

  if (updatedNote) {
    await writeLocalNotes(nextNotes);
  }

  return updatedNote;
}

export async function fetchNotes(query = ""): Promise<NoteListResult> {
  if (hasApiBaseUrl) {
    try {
      const separator = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : "";
      const response = await request<NoteListApiResponse>({ url: `/notes${separator}` });
      const rawNotes = Array.isArray(response) ? response : response.data ?? [];
      const remoteNotes = normalizeNoteList(response, "remote");
      const localNotes = await readLocalNotes();
      const rawById = new Map(rawNotes.map((note) => [note.id, note]));
      const remoteWithLocalMetadata = remoteNotes.map((note) => {
        const existing = localNotes.find((candidate) => candidate.id === note.id);
        return mergeRemoteNoteMetadata(note, rawById.get(note.id) ?? note, existing);
      });
      const remoteIds = new Set(remoteWithLocalMetadata.map((note) => note.id));

      await writeLocalNotes([
        ...remoteWithLocalMetadata,
        ...localNotes.filter((note) => !remoteIds.has(note.id))
      ]);

      return {
        data: remoteWithLocalMetadata.map(({ content: _content, ...summary }) => summary),
        total: remoteWithLocalMetadata.length,
        source: "remote"
      };
    } catch (error) {
      const localNotes = filterNotes(await readLocalNotes(), query);

      return {
        data: localNotes.map(({ content: _content, ...summary }) => summary),
        total: localNotes.length,
        source: "local",
        error: getErrorMessage(error, "远端图文材料读取失败")
      };
    }
  }

  const localNotes = filterNotes(await readLocalNotes(), query);
  return {
    data: localNotes.map(({ content: _content, ...summary }) => summary),
    total: localNotes.length,
    source: "local"
  };
}

export async function fetchNoteDetail(noteId: string): Promise<NoteDetail> {
  if (hasApiBaseUrl) {
    try {
      const response = await request<NoteApiResponse>({
        url: `/notes/${encodeURIComponent(noteId)}`
      });
      const note = normalizeNote(response, "remote");
      const existing = (await readLocalNotes()).find((candidate) => candidate.id === noteId);
      const remoteWithLocalMetadata = mergeRemoteNoteMetadata(note, response, existing);

      return await rememberLocalNote({
        ...remoteWithLocalMetadata,
        savedAt: remoteWithLocalMetadata.updatedAt
      });
    } catch {
      // Fall through to local cache.
    }
  }

  const localNote = (await readLocalNotes()).find((candidate) => candidate.id === noteId);
  if (!localNote) {
    throw new Error("未找到图文材料");
  }

  return localNote;
}
