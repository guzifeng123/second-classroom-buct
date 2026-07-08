import Taro from "@tarojs/taro";
import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import type { ContentBlock } from "../types/content";
import { createId } from "../utils/id";

const LOCAL_NOTES_KEY = "erkexitong-note-index";

export interface NoteSummary {
  id: string;
  title: string;
  plainText: string;
  blockCount: number;
  imageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteDetail extends NoteSummary {
  content: ContentBlock[];
}

interface NoteApiResponse {
  id: string;
  title: string;
  content?: ContentBlock[];
  plain_text?: string;
  plainText?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: number;
  updatedAt?: number;
}

type NoteListApiResponse = NoteApiResponse[] | { data?: NoteApiResponse[]; total?: number };

export interface NoteListResult {
  data: NoteSummary[];
  total: number;
  source: "local" | "remote";
  error?: string;
}

function getBlockText(block: ContentBlock): string {
  if (block.type === "heading" || block.type === "paragraph") {
    return block.text;
  }

  if (block.type === "image") {
    return block.alt ?? "";
  }

  return JSON.stringify(block.data);
}

function getPlainText(content: ContentBlock[]): string {
  return content.map(getBlockText).join(" ").trim();
}

function parseTime(value?: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function normalizeNote(raw: NoteApiResponse): NoteDetail {
  const content = raw.content ?? [];
  const plainText = raw.plainText ?? raw.plain_text ?? getPlainText(content);
  const updatedAt = parseTime(raw.updatedAt ?? raw.updated_at);

  return {
    id: raw.id,
    title: raw.title || "未命名图文材料",
    content,
    plainText,
    blockCount: content.length,
    imageCount: content.filter((block) => block.type === "image").length,
    createdAt: parseTime(raw.createdAt ?? raw.created_at ?? updatedAt),
    updatedAt
  };
}

function normalizeList(raw: NoteListApiResponse): NoteDetail[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map(normalizeNote);
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

function filterNotes(notes: NoteDetail[], query: string): NoteDetail[] {
  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return notes;
  }

  return notes.filter((note) => {
    const text = `${note.title} ${note.plainText}`.toLowerCase();
    return text.includes(keyword);
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
      const remoteNotes = normalizeList(await request<NoteListApiResponse>({ url: `/notes${separator}` }));

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
