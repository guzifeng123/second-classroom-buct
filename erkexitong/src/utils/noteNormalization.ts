import type { ContentBlock } from "../types/content";

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

export interface NoteApiResponse {
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

export type NoteListApiResponse = NoteApiResponse[] | { data?: NoteApiResponse[]; total?: number };

export function getNoteBlockText(block: ContentBlock): string {
  if (block.type === "heading" || block.type === "paragraph") {
    return block.text;
  }

  if (block.type === "image") {
    return block.alt ?? "";
  }

  return JSON.stringify(block.data);
}

export function getNotePlainText(content: ContentBlock[]): string {
  return content.map(getNoteBlockText).join(" ").trim();
}

export function parseNoteTime(value?: string | number): number {
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

export function normalizeNote(raw: NoteApiResponse): NoteDetail {
  const content = raw.content ?? [];
  const plainText = raw.plainText ?? raw.plain_text ?? getNotePlainText(content);
  const updatedAt = parseNoteTime(raw.updatedAt ?? raw.updated_at);

  return {
    id: raw.id,
    title: raw.title || "未命名图文材料",
    content,
    plainText,
    blockCount: content.length,
    imageCount: content.filter((block) => block.type === "image").length,
    createdAt: parseNoteTime(raw.createdAt ?? raw.created_at ?? updatedAt),
    updatedAt
  };
}

export function normalizeNoteList(raw: NoteListApiResponse): NoteDetail[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map(normalizeNote);
}

export function filterNotes(notes: NoteDetail[], query: string): NoteDetail[] {
  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return notes;
  }

  return notes.filter((note) => {
    const text = `${note.title} ${note.plainText}`.toLowerCase();
    return text.includes(keyword);
  });
}
