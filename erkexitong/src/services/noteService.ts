import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { ContentBlock } from "../types/content";
import { createId } from "../utils/id";
import {
  filterNotes,
  normalizeNote,
  normalizeNoteList,
  type NoteApiResponse,
  type NoteDetail,
  type NoteListApiResponse,
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

async function readLocalNotes(): Promise<NoteDetail[]> {
  try {
    const result = await Taro.getStorage<NoteDetail[]>({ key: LOCAL_NOTES_KEY });
    return Array.isArray(result.data) ? result.data : [];
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
  savedAt?: number;
}): Promise<NoteDetail> {
  const now = note.savedAt ?? Date.now();
  const normalized = normalizeNote({
    id: note.id || createId("note"),
    title: note.title,
    content: note.content,
    createdAt: now,
    updatedAt: now
  });
  const notes = await readLocalNotes();
  const existing = notes.find((candidate) => candidate.id === normalized.id);
  const nextNote = {
    ...normalized,
    createdAt: existing?.createdAt ?? normalized.createdAt
  };
  const nextNotes = [nextNote, ...notes.filter((candidate) => candidate.id !== normalized.id)].sort(
    (left, right) => right.updatedAt - left.updatedAt
  );

  await writeLocalNotes(nextNotes);
  return nextNote;
}

export async function fetchNotes(query = ""): Promise<NoteListResult> {
  if (hasApiBaseUrl) {
    try {
      const separator = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : "";
      const remoteNotes = normalizeNoteList(await request<NoteListApiResponse>({ url: `/notes${separator}` }));

      await writeLocalNotes(remoteNotes);

      return {
        data: remoteNotes.map(({ content: _content, ...summary }) => summary),
        total: remoteNotes.length,
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
      const note = normalizeNote(
        await request<NoteApiResponse>({
          url: `/notes/${encodeURIComponent(noteId)}`
        })
      );

      await rememberLocalNote(note);
      return note;
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
