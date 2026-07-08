import Taro from "@tarojs/taro";
import { create } from "zustand";
import { request } from "../services/api";
import { fetchNoteDetail, rememberLocalNote } from "../services/noteService";
import type { ContentBlock } from "../types/content";
import type { NoteTransferPayload } from "../types/transfer";

const NOTE_DRAFT_KEY = "erkexitong-note-draft";

interface NoteSaveRequest {
  title: string;
  content: ContentBlock[];
}

interface NoteApiResponse {
  id: string;
  title: string;
  content: ContentBlock[];
  plain_text?: string;
  created_at?: string;
  updated_at?: string;
}

interface NoteDraftSnapshot {
  noteId: string | null;
  title: string;
  content: ContentBlock[];
  savedAt: number;
}

interface NoteState {
  noteId: string | null;
  title: string;
  content: ContentBlock[];
  isDirty: boolean;
  hydrated: boolean;
  savedAt: number | null;
  setNoteId: (id: string | null) => void;
  setTitle: (title: string) => void;
  setContent: (content: ContentBlock[]) => void;
  addBlock: (block: ContentBlock) => void;
  updateBlock: (index: number, block: ContentBlock) => void;
  removeBlock: (index: number) => void;
  applyIncomingContent: (payload: NoteTransferPayload) => void;
  hydrateFromStorage: () => Promise<void>;
  loadNote: (noteId: string) => Promise<void>;
  saveNote: () => Promise<void>;
  reset: () => void;
}

function makeSnapshot(state: Pick<NoteState, "noteId" | "title" | "content">): NoteDraftSnapshot {
  return {
    noteId: state.noteId,
    title: state.title,
    content: state.content,
    savedAt: Date.now()
  };
}

async function persistLocalDraft(snapshot: NoteDraftSnapshot): Promise<void> {
  await Taro.setStorage({
    key: NOTE_DRAFT_KEY,
    data: snapshot
  });
}

function applyServerNote(note: NoteApiResponse): Partial<NoteState> {
  return {
    noteId: note.id,
    title: note.title,
    content: note.content ?? [],
    isDirty: false,
    savedAt: Date.now()
  };
}

export const useNoteStore = create<NoteState>((set, get) => ({
  noteId: null,
  title: "",
  content: [],
  isDirty: false,
  hydrated: false,
  savedAt: null,
  setNoteId: (noteId) => set({ noteId, isDirty: true }),
  setTitle: (title) => set({ title, isDirty: true }),
  setContent: (content) => set({ content, isDirty: true }),
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
    set({
      noteId: payload.noteId,
      title: payload.title,
      content: payload.content,
      isDirty: true,
      savedAt
    });
    void persistLocalDraft({
      noteId: payload.noteId,
      title: payload.title,
      content: payload.content,
      savedAt
    });
  },
  hydrateFromStorage: async () => {
    try {
      const result = await Taro.getStorage<NoteDraftSnapshot>({ key: NOTE_DRAFT_KEY });
      set({
        noteId: result.data.noteId,
        title: result.data.title,
        content: result.data.content,
        savedAt: result.data.savedAt,
        isDirty: false,
        hydrated: true
      });
    } catch {
      set({ hydrated: true });
    }
  },
  loadNote: async (noteId) => {
    const note = await fetchNoteDetail(noteId);
    const nextState = applyServerNote(note);
    await persistLocalDraft(makeSnapshot(nextState as Pick<NoteState, "noteId" | "title" | "content">));
    set({
      ...nextState,
      hydrated: true
    });
  },
  saveNote: async () => {
    const state = get();
    const title = state.title.trim() || "未命名图文材料";
    const data: NoteSaveRequest = {
      title,
      content: state.content
    };
    const snapshot = makeSnapshot({
      noteId: state.noteId,
      title,
      content: state.content
    });

    await persistLocalDraft(snapshot);

    try {
      const note = await request<NoteApiResponse, NoteSaveRequest>({
        url: state.noteId ? `/notes/${encodeURIComponent(state.noteId)}` : "/notes",
        method: state.noteId ? "PUT" : "POST",
        data
      });
      await rememberLocalNote({
        id: note.id,
        title: note.title,
        content: note.content ?? state.content,
        savedAt: Date.now()
      });
      set({
        ...applyServerNote(note),
        hydrated: true
      });
    } catch {
      const localNote = await rememberLocalNote({
        id: state.noteId,
        title,
        content: state.content,
        savedAt: snapshot.savedAt
      });
      await persistLocalDraft({
        noteId: localNote.id,
        title,
        content: state.content,
        savedAt: snapshot.savedAt
      });
      set({
        noteId: localNote.id,
        title,
        isDirty: false,
        savedAt: snapshot.savedAt,
        hydrated: true
      });
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
      isDirty: false,
      savedAt: null,
      hydrated: true
    });
  }
}));
