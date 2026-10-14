import { evaluationConfig } from "../data/evaluationConfig";
import type { ContentBlock } from "../types/content";
import type { DimensionKey, SectionKey } from "../types/evaluation";
import type { NoteSource } from "../types/note";

export type { NoteSource } from "../types/note";

export const MAX_NOTE_TAGS = 6;
export const MAX_NOTE_TAG_LENGTH = 12;

export interface NoteUsageContext {
  dimensionKey: DimensionKey;
  sectionKey: SectionKey;
  itemId: string;
  usedAt?: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  plainText: string;
  blockCount: number;
  imageCount: number;
  tags: string[];
  dimensionKeys: DimensionKey[];
  source: NoteSource;
  usedCount: number;
  recentUsedAt?: number;
  lastUsedDimensionKey?: DimensionKey;
  lastUsedSectionKey?: SectionKey;
  lastUsedItemId?: string;
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
  tags?: string[] | string;
  dimension_keys?: DimensionKey[];
  dimensionKeys?: DimensionKey[];
  source?: NoteSource | string;
  used_count?: number;
  usedCount?: number;
  recent_used_at?: string | number;
  recentUsedAt?: number;
  last_used_dimension_key?: DimensionKey;
  lastUsedDimensionKey?: DimensionKey;
  last_used_section_key?: SectionKey;
  lastUsedSectionKey?: SectionKey;
  last_used_item_id?: string;
  lastUsedItemId?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type NoteListApiResponse = NoteApiResponse[] | { data?: NoteApiResponse[]; total?: number };

const DIMENSION_KEYS = new Set<DimensionKey>(evaluationConfig.map((dimension) => dimension.key));
const DIMENSION_TITLE_BY_KEY = new Map(
  evaluationConfig.map((dimension) => [dimension.key, dimension.title] as const)
);

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

export function parseOptionalNoteTime(value?: string | number): number | undefined {
  return value === undefined ? undefined : parseNoteTime(value);
}

export function normalizeNoteTags(value?: string[] | string): string[] {
  const candidates = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[，,;；\s]+/) : [];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const tag = candidate.trim().slice(0, MAX_NOTE_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }

    normalized.push(tag);
    seen.add(key);
    if (normalized.length >= MAX_NOTE_TAGS) {
      break;
    }
  }

  return normalized;
}

export function normalizeNoteDimensionKeys(value?: DimensionKey[]): DimensionKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((key): key is DimensionKey => DIMENSION_KEYS.has(key)))];
}

export function normalizeNoteSource(value?: string, fallback: NoteSource = "local"): NoteSource {
  return value === "local" || value === "remote" || value === "transfer" ? value : fallback;
}

export function normalizeNote(raw: NoteApiResponse, fallbackSource: NoteSource = "local"): NoteDetail {
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
    tags: normalizeNoteTags(raw.tags),
    dimensionKeys: normalizeNoteDimensionKeys(raw.dimensionKeys ?? raw.dimension_keys),
    source: normalizeNoteSource(raw.source, fallbackSource),
    usedCount: Math.max(0, raw.usedCount ?? raw.used_count ?? 0),
    recentUsedAt: raw.recentUsedAt ?? parseOptionalNoteTime(raw.recent_used_at),
    lastUsedDimensionKey: raw.lastUsedDimensionKey ?? raw.last_used_dimension_key,
    lastUsedSectionKey: raw.lastUsedSectionKey ?? raw.last_used_section_key,
    lastUsedItemId: raw.lastUsedItemId ?? raw.last_used_item_id,
    createdAt: parseNoteTime(raw.createdAt ?? raw.created_at ?? updatedAt),
    updatedAt
  };
}

export function normalizeNoteList(
  raw: NoteListApiResponse,
  fallbackSource: NoteSource = "local"
): NoteDetail[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map((note) => normalizeNote(note, fallbackSource));
}

export function mergeNoteMetadata(note: NoteDetail, existing?: NoteDetail): NoteDetail {
  if (!existing) {
    return note;
  }

  return {
    ...note,
    tags: note.tags.length > 0 ? note.tags : existing.tags,
    dimensionKeys: note.dimensionKeys.length > 0 ? note.dimensionKeys : existing.dimensionKeys,
    usedCount: note.usedCount || existing.usedCount,
    recentUsedAt: note.recentUsedAt ?? existing.recentUsedAt,
    lastUsedDimensionKey: note.lastUsedDimensionKey ?? existing.lastUsedDimensionKey,
    lastUsedSectionKey: note.lastUsedSectionKey ?? existing.lastUsedSectionKey,
    lastUsedItemId: note.lastUsedItemId ?? existing.lastUsedItemId,
    createdAt: existing.createdAt || note.createdAt
  };
}

export function filterNotes(notes: NoteDetail[], query: string): NoteDetail[] {
  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return notes;
  }

  return notes.filter((note) => {
    const dimensionTitles = note.dimensionKeys.map((key) => DIMENSION_TITLE_BY_KEY.get(key) ?? key);
    const text = `${note.title} ${note.plainText} ${note.tags.join(" ")} ${dimensionTitles.join(" ")}`.toLowerCase();
    return text.includes(keyword);
  });
}
