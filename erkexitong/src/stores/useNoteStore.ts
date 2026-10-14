import Taro from "@tarojs/taro";
import { create } from "zustand";
import { hasApiBaseUrl, request } from "../services/api";
import { fetchNoteDetail, rememberLocalNote } from "../services/noteService";
import type { ContentBlock } from "../types/content";
import type { DimensionKey } from "../types/evaluation";
import type { NoteTransferPayload } from "../types/transfer";
import {
  normalizeNote,
  normalizeNoteDimensionKeys,
  normalizeNoteSource,
  normalizeNoteTags,
  type NoteApiResponse,
  type NoteDetail,
  type NoteSource
} from "../utils/noteNormalization";

const NOTE_DRAFT_KEY = "erkexitong-note-draft";

interface NoteSaveRequest {
  title: string;
  content: ContentBlock[];
  tags: string[];
  dimension_keys: DimensionKey[];
}

interface NoteDraftSnapshot {
  noteId: string | null;
  title: string;
  content: ContentBlock[];
  tags: string[];
  dimensionKeys: DimensionKey[];
  source: NoteSource;
  savedAt: number;
}

interface NoteState {
  noteId: string | null;
  title: string;
  content: ContentBlock[];
  tags: string[];
  dimensionKeys: DimensionKey[];
  source: NoteSource;
  isDirty: boolean;
  hydrated: boolean;
  savedAt: number | null;
  setNoteId: (id: string | null) => void;
  setTitle: (title: string) => void;
  setContent: (content: ContentBlock[]) => void;
  setTags: (tags: string[]) => void;
  toggleDimension: (dimensionKey: DimensionKey) => void;
  addBlock: (block: ContentBlock) => void;
  updateBlock: (index: number, block: ContentBlock) => void;
  removeBlock: (index: number) => void;
  applyIncomingContent: (payload: NoteTransferPayload) => void;
  hydrateFromStorage: () => Promise<void>;
  loadNote: (noteId: string) => Promise<void>;
  saveNote: () => Promise<void>;
  reset: () => void;
}

type SnapshotState = Pick<NoteState, "noteId" | "title" | "content" | "tags" | "dimensionKeys" | "source">;

function makeSnapshot(state: SnapshotState, savedAt = Date.now()): NoteDraftSnapshot {
  return {
    noteId: state.noteId,
    title: state.title,
    content: state.content,
    tags: normalizeNoteTags(state.tags),
    dimensionKeys: normalizeNoteDimensionKeys(state.dimensionKeys),
    source: normalizeNoteSource(state.source),
    savedAt
  };
}

async function persistLocalDraft(snapshot: NoteDraftSnapshot): Promise<void> {
  await Taro.setStorage({
    key: NOTE_DRAFT_KEY,
    data: snapshot
  });
}

function applyNote(note: NoteDetail): Partial<NoteState> {
  return {
    noteId: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    dimensionKeys: note.dimensionKeys,
    source: note.source,
    isDirty: false,
    savedAt: note.updatedAt
  };
}

export const useNoteStore = create<NoteState>((set, get) => ({
  noteId: null,
  title: "",
  content: [],
  tags: [],
  dimensionKeys: [],
  source: "local",
  isDirty: false,
  hydrated: false,
  savedAt: null,
  setNoteId: (noteId) => set({ noteId, isDirty: true }),
  setTitle: (title) => set({ title, isDirty: true }),
  setContent: (content) => set({ content, isDirty: true }),
  setTags: (tags) => set({ tags: normalizeNoteTags(tags), isDirty: true }),
  toggleDimension: (dimensionKey) =>
    set((state) => ({
      dimensionKeys: state.dimensionKeys.includes(dimensionKey)
        ? state.dimensionKeys.filter((key) => key !== dimensionKey)
        : [...state.dimensionKeys, dimensionKey],
      isDirty: true
    })),
  addBlock: (block) =>
    set((state) => ({
      content: [...state.content, block],
      isDirty: true
    })),
  updateBlock: (index, block) =>
    set((state) => ({
      content: state.content.map((candidate, candidateIndex) =>
        candidateIndex === index ? block : candidate
      ),
      isDirty: true
    })),
  removeBlock: (index) =>
    set((state) => ({
      content: state.content.filter((_, candidateIndex) => candidateIndex !== index),
      isDirty: true
    })),
  applyIncomingContent: (payload) => {
    const savedAt = Date.now();
    const nextState: SnapshotState = {
      noteId: payload.noteId,
      title: payload.title,
      content: payload.content,
      tags: normalizeNoteTags(payload.tags),
      dimensionKeys: normalizeNoteDimensionKeys(payload.dimensionKeys),
      source: "transfer"
    };
    set({ ...nextState, isDirty: true, savedAt });
    void persistLocalDraft(makeSnapshot(nextState, savedAt));
  },
  hydrateFromStorage: async () => {
    try {
      const result = await Taro.getStorage<Partial<NoteDraftSnapshot>>({ key: NOTE_DRAFT_KEY });
      set({
        noteId: result.data.noteId ?? null,
        title: result.data.title ?? "",
        content: Array.isArray(result.data.content) ? result.data.content : [],
        tags: normalizeNoteTags(result.data.tags),
        dimensionKeys: normalizeNoteDimensionKeys(result.data.dimensionKeys),
        source: normalizeNoteSource(result.data.source),
        savedAt: result.data.savedAt ?? null,
        isDirty: false,
        hydrated: true
      });
    } catch {
      set({ hydrated: true });
    }
  },
  loadNote: async (noteId) => {
    const note = await fetchNoteDetail(noteId);
    const nextState: SnapshotState = {
      noteId: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      dimensionKeys: note.dimensionKeys,
      source: note.source
    };
    await persistLocalDraft(makeSnapshot(nextState, note.updatedAt));
    set({ ...applyNote(note), hydrated: true });
  },
  saveNote: async () => {
    const state = get();
    const title = state.title.trim() || "未命名图文材料";
    const tags = normalizeNoteTags(state.tags);
    const dimensionKeys = normalizeNoteDimensionKeys(state.dimensionKeys);
    const data: NoteSaveRequest = {
      title,
      content: state.content,
      tags,
      dimension_keys: dimensionKeys
    };
    const snapshotState: SnapshotState = {
      noteId: state.noteId,
      title,
      content: state.content,
      tags,
      dimensionKeys,
      source: state.source
    };
    const snapshot = makeSnapshot(snapshotState);

    await persistLocalDraft(snapshot);

    const saveLocally = async () => {
      const localNote = await rememberLocalNote({
        id: state.noteId,
        title,
        content: state.content,
        tags,
        dimensionKeys,
        source: state.source,
        savedAt: snapshot.savedAt
      });
      const savedSnapshot = makeSnapshot(
        {
          noteId: localNote.id,
          title: localNote.title,
          content: localNote.content,
          tags: localNote.tags,
          dimensionKeys: localNote.dimensionKeys,
          source: localNote.source
        },
        snapshot.savedAt
      );
      await persistLocalDraft(savedSnapshot);
      set({ ...applyNote(localNote), savedAt: snapshot.savedAt, hydrated: true });
    };

    if (!hasApiBaseUrl) {
      await saveLocally();
      return;
    }

    try {
      const response = await request<NoteApiResponse, NoteSaveRequest>({
        url: state.noteId ? `/notes/${encodeURIComponent(state.noteId)}` : "/notes",
        method: state.noteId ? "PUT" : "POST",
        data
      });
      const remoteNote = normalizeNote(
        {
          ...response,
          content: response.content ?? state.content,
          tags: response.tags ?? tags,
          dimensionKeys: response.dimensionKeys ?? response.dimension_keys ?? dimensionKeys,
          source: "remote"
        },
        "remote"
      );
      const cachedNote = await rememberLocalNote({ ...remoteNote, savedAt: remoteNote.updatedAt });
      await persistLocalDraft(
        makeSnapshot(
          {
            noteId: cachedNote.id,
            title: cachedNote.title,
            content: cachedNote.content,
            tags: cachedNote.tags,
            dimensionKeys: cachedNote.dimensionKeys,
            source: cachedNote.source
          },
          cachedNote.updatedAt
        )
      );
      set({ ...applyNote(cachedNote), hydrated: true });
    } catch {
      await saveLocally();
    }
  },
  reset: () => {
    try {
      Taro.removeStorageSync(NOTE_DRAFT_KEY);
    } catch {
      // Local cleanup is best-effort across mini program, H5 and RN runtimes.
    }

    set({
      noteId: null,
      title: "",
      content: [],
      tags: [],
      dimensionKeys: [],
      source: "local",
      isDirty: false,
      savedAt: null,
      hydrated: true
    });
  }
}));
