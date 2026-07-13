import Taro from "@tarojs/taro";
import { create } from "zustand";
import { evaluationConfig, findEvaluationItem } from "../data/evaluationConfig";
import { fetchEvaluationSnapshot, saveEvaluationDraftRemote } from "../services/evaluationService";
import type {
  DimensionKey,
  EvaluationDraftSaveResult,
  EvaluationRecordMap,
  EvaluationSnapshot,
  EvaluationSyncStatus,
  EvaluationValidationIssue,
  NoteReference,
  ProofImage,
  ProofRecord,
  SectionKey
} from "../types/evaluation";
import type { EditingItemPayload } from "../types/transfer";
import {
  calculateDimensionScore,
  calculateItemScore,
  calculateRecordScore,
  hasRecordMaterial,
  makeRecordKey
} from "../utils/evaluationScoring";
import {
  createDefaultSelectedEvaluationItemIds,
  createEvaluationRecord,
  createInitialEvaluationRecords,
  evaluationSnapshotsDiffer,
  hasMeaningfulEvaluationDraft,
  normalizeEvaluationSnapshot
} from "../utils/evaluationDraft";
import { getEvaluationValidationIssues } from "../utils/evaluationValidation";

export { calculateRecordScore, hasRecordMaterial, makeRecordKey } from "../utils/evaluationScoring";

const DRAFT_KEY = "erkexitong-evaluation-draft";

interface EvaluationState {
  records: EvaluationRecordMap;
  selectedItemIds: string[];
  draftSavedAt: number | null;
  hydrated: boolean;
  lastSyncError: string | null;
  syncStatus: EvaluationSyncStatus;
  addRecord: (dimensionKey: DimensionKey, sectionKey: SectionKey, itemId: string) => string | null;
  removeRecord: (dimensionKey: DimensionKey, itemId: string, recordId: string) => void;
  toggleItemSelection: (
    dimensionKey: DimensionKey,
    sectionKey: SectionKey,
    itemId: string,
    selected?: boolean
  ) => void;
  updateText: (dimensionKey: DimensionKey, itemId: string, recordId: string, text: string) => void;
  updateOption: (
    dimensionKey: DimensionKey,
    itemId: string,
    recordId: string,
    selectedOption: string
  ) => void;
  updateNumber: (
    dimensionKey: DimensionKey,
    itemId: string,
    recordId: string,
    numericValue: number
  ) => void;
  addImages: (dimensionKey: DimensionKey, itemId: string, recordId: string, images: ProofImage[]) => void;
  replaceImage: (
    dimensionKey: DimensionKey,
    itemId: string,
    recordId: string,
    imageId: string,
    image: ProofImage
  ) => void;
  removeImage: (dimensionKey: DimensionKey, itemId: string, recordId: string, imageId: string) => void;
  addNoteReference: (
    dimensionKey: DimensionKey,
    itemId: string,
    recordId: string,
    reference: NoteReference
  ) => void;
  removeNoteReference: (dimensionKey: DimensionKey, itemId: string, recordId: string, noteId: string) => void;
  applyTransferPayload: (payload: EditingItemPayload) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
  hydrateDraft: (userId?: string) => Promise<void>;
  applySnapshot: (snapshot: EvaluationSnapshot) => Promise<void>;
  saveDraft: (userId?: string) => Promise<EvaluationDraftSaveResult>;
  resetDraft: () => void;
  getItemScore: (dimensionKey: DimensionKey, itemId: string) => number;
  getDimensionScore: (dimensionKey: DimensionKey) => number;
  getTotalScore: () => number;
  getValidationIssues: () => EvaluationValidationIssue[];
}

function createSnapshotFromState(state: Pick<EvaluationState, "records" | "selectedItemIds">): EvaluationSnapshot {
  return {
    records: state.records,
    selectedItemIds: state.selectedItemIds,
    savedAt: Date.now(),
    source: "local"
  };
}

async function readLocalSnapshot(): Promise<EvaluationSnapshot | null> {
  try {
    const result = await Taro.getStorage<EvaluationSnapshot>({ key: DRAFT_KEY });
    return normalizeEvaluationSnapshot(result.data, "local");
  } catch {
    return null;
  }
}

async function persistLocalSnapshot(snapshot: EvaluationSnapshot): Promise<void> {
  await Taro.setStorage({
    key: DRAFT_KEY,
    data: {
      records: snapshot.records,
      selectedItemIds: snapshot.selectedItemIds,
      savedAt: snapshot.savedAt,
      source: "local"
    } satisfies EvaluationSnapshot
  });
}

function updateRecord(
  records: EvaluationRecordMap,
  dimensionKey: DimensionKey,
  itemId: string,
  recordId: string,
  updater: (record: ProofRecord) => ProofRecord
): EvaluationRecordMap {
  const key = makeRecordKey(dimensionKey, itemId);
  const nextRecords = records[key]?.map((record) => (record.id === recordId ? updater(record) : record)) ?? [];
  return {
    ...records,
    [key]: nextRecords
  };
}

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  records: createInitialEvaluationRecords(),
  selectedItemIds: createDefaultSelectedEvaluationItemIds(),
  draftSavedAt: null,
  hydrated: false,
  lastSyncError: null,
  syncStatus: "local-saved",
  addRecord: (dimensionKey, sectionKey, itemId) => {
    const item = findEvaluationItem(itemId);
    const record = createEvaluationRecord(dimensionKey, sectionKey, itemId, item);
    const key = makeRecordKey(dimensionKey, itemId);

    set((state) => ({
      selectedItemIds: state.selectedItemIds.includes(key)
        ? state.selectedItemIds
        : [...state.selectedItemIds, key],
      records: {
        ...state.records,
        [key]: [...(state.records[key] ?? []), record]
      },
      syncStatus: "local-unsaved",
      lastSyncError: null
    }));

    return record.id;
  },
  removeRecord: (dimensionKey, itemId, recordId) => {
    const key = makeRecordKey(dimensionKey, itemId);
    set((state) => ({
      records: {
        ...state.records,
        [key]: (state.records[key] ?? []).filter((record) => record.id !== recordId)
      },
      syncStatus: "local-unsaved",
      lastSyncError: null
    }));
  },
  toggleItemSelection: (dimensionKey, sectionKey, itemId, selected) => {
    const key = makeRecordKey(dimensionKey, itemId);
    const item = findEvaluationItem(itemId);

    set((state) => {
      const selectedSet = new Set(state.selectedItemIds);
      const shouldSelect = selected ?? !selectedSet.has(key);

      if (shouldSelect) {
        selectedSet.add(key);
      } else {
        selectedSet.delete(key);
      }

      const records = state.records[key] ?? [];
      const shouldCreateEditableRecord = shouldSelect && records.length === 0;

      return {
        selectedItemIds: Array.from(selectedSet),
        records: shouldCreateEditableRecord
          ? {
              ...state.records,
              [key]: [createEvaluationRecord(dimensionKey, sectionKey, itemId, item)]
            }
          : state.records,
        syncStatus: "local-unsaved",
        lastSyncError: null
      };
    });
  },
  updateText: (dimensionKey, itemId, recordId, text) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        text,
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  updateOption: (dimensionKey, itemId, recordId, selectedOption) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        selectedOption,
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  updateNumber: (dimensionKey, itemId, recordId, numericValue) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        numericValue,
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  addImages: (dimensionKey, itemId, recordId, images) => {
    const item = findEvaluationItem(itemId);
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        images: [...record.images, ...images].slice(0, item?.imageLimit ?? 3),
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    }));
  },
  replaceImage: (dimensionKey, itemId, recordId, imageId, image) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        images: record.images.map((candidate) => (candidate.id === imageId ? image : candidate)),
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  removeImage: (dimensionKey, itemId, recordId, imageId) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        images: record.images.filter((image) => image.id !== imageId),
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  addNoteReference: (dimensionKey, itemId, recordId, reference) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => {
        const existingReferences = record.noteReferences ?? [];
        const references = [
          reference,
          ...existingReferences.filter((candidate) => candidate.noteId !== reference.noteId)
        ].slice(0, 4);

        return {
          ...record,
          noteReferences: references,
          dirty: true,
          updatedAt: Date.now()
        };
      }),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  removeNoteReference: (dimensionKey, itemId, recordId, noteId) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        noteReferences: (record.noteReferences ?? []).filter((reference) => reference.noteId !== noteId),
        dirty: true,
        updatedAt: Date.now()
      })),
      syncStatus: "local-unsaved",
      lastSyncError: null
    })),
  applyTransferPayload: async (payload) => {
    const key = makeRecordKey(payload.dimensionKey, payload.itemId);
    let nextSnapshot: EvaluationSnapshot | null = null;

    set((state) => {
      const records = state.records[key] ?? [];
      const existing = records.find((record) => record.id === payload.recordId);
      const savedAt = Date.now();
      const nextRecord: ProofRecord = {
        ...(existing ?? createEvaluationRecord(payload.dimensionKey, payload.sectionKey, payload.itemId)),
        id: payload.recordId,
        text: payload.text,
        images: payload.images,
        noteReferences: payload.noteReferences ?? existing?.noteReferences ?? [],
        selectedOption: payload.selectedOption,
        numericValue: payload.numericValue,
        dirty: true,
        updatedAt: savedAt
      };
      const nextSelectedItemIds = state.selectedItemIds.includes(key)
        ? state.selectedItemIds
        : [...state.selectedItemIds, key];
      const nextRecords = {
        ...state.records,
        [key]: existing
          ? records.map((record) => (record.id === payload.recordId ? nextRecord : record))
          : [...records, nextRecord]
      };

      nextSnapshot = {
        records: nextRecords,
        selectedItemIds: nextSelectedItemIds,
        savedAt,
        source: "local"
      };

      return {
        selectedItemIds: nextSelectedItemIds,
        records: nextRecords,
        draftSavedAt: savedAt,
        lastSyncError: null,
        syncStatus: "local-saved"
      };
    });

    if (nextSnapshot) {
      await persistLocalSnapshot(nextSnapshot);
    }
  },
  hydrateFromStorage: async () => {
    const snapshot = await readLocalSnapshot();

    if (snapshot) {
      set({
        records: snapshot.records,
        selectedItemIds: snapshot.selectedItemIds ?? createDefaultSelectedEvaluationItemIds(),
        draftSavedAt: snapshot.savedAt,
        hydrated: true,
        lastSyncError: null,
        syncStatus: "local-saved"
      });
    } else {
      const records = createInitialEvaluationRecords();
      set({
        records,
        selectedItemIds: createDefaultSelectedEvaluationItemIds(),
        draftSavedAt: null,
        hydrated: true,
        lastSyncError: null,
        syncStatus: "local-saved"
      });
    }
  },
  hydrateDraft: async (userId) => {
    const localSnapshot = await readLocalSnapshot();
    let remoteSnapshot: EvaluationSnapshot | null = null;
    let remoteError: string | null = null;

    if (userId) {
      try {
        remoteSnapshot = await fetchEvaluationSnapshot(userId);
      } catch (error) {
        remoteError = error instanceof Error ? error.message : "远端快照读取失败";
      }
    }

    const localHasContent = localSnapshot ? hasMeaningfulEvaluationDraft(localSnapshot) : false;
    const remoteHasContent = remoteSnapshot ? hasMeaningfulEvaluationDraft(remoteSnapshot) : false;
    let selectedSnapshot = localSnapshot ?? remoteSnapshot;

    if (localSnapshot && remoteSnapshot && evaluationSnapshotsDiffer(localSnapshot, remoteSnapshot)) {
      const result = await Taro.showModal({
        title: "发现草稿冲突",
        content: `本机暂存 ${new Date(localSnapshot.savedAt).toLocaleString()}，远端暂存 ${new Date(
          remoteSnapshot.savedAt
        ).toLocaleString()}。是否应用远端草稿？`,
        confirmText: "用远端",
        cancelText: "保留本机"
      });
      selectedSnapshot = result.confirm ? remoteSnapshot : localSnapshot;
    } else if (!localHasContent && remoteHasContent) {
      selectedSnapshot = remoteSnapshot;
    }

    if (selectedSnapshot) {
      await get().applySnapshot(selectedSnapshot);
      set({
        hydrated: true,
        lastSyncError: remoteError,
        syncStatus: remoteError ? "sync-failed" : "local-saved"
      });
      return;
    }

    const records = createInitialEvaluationRecords();
    set({
      records,
      selectedItemIds: createDefaultSelectedEvaluationItemIds(),
      draftSavedAt: null,
      hydrated: true,
      lastSyncError: remoteError,
      syncStatus: remoteError ? "sync-failed" : "local-saved"
    });
  },
  applySnapshot: async (snapshot) => {
    const normalized = normalizeEvaluationSnapshot(snapshot, snapshot.source ?? "local");
    await persistLocalSnapshot({
      ...normalized,
      source: "local"
    });
    set({
      records: normalized.records,
      selectedItemIds: normalized.selectedItemIds ?? createDefaultSelectedEvaluationItemIds(),
      draftSavedAt: normalized.savedAt,
      hydrated: true,
      lastSyncError: null,
      syncStatus: "local-saved"
    });
  },
  saveDraft: async (userId) => {
    const snapshot = createSnapshotFromState(get());
    await persistLocalSnapshot(snapshot);
    set({
      draftSavedAt: snapshot.savedAt,
      lastSyncError: null,
      syncStatus: userId ? "remote-syncing" : "local-saved"
    });

    if (!userId) {
      return {
        snapshot,
        remoteSaved: false,
        remoteError: "未登录，已仅保存到本机"
      };
    }

    try {
      await saveEvaluationDraftRemote(userId, snapshot);
      set({
        lastSyncError: null,
        syncStatus: "remote-synced"
      });
      return {
        snapshot,
        remoteSaved: true
      };
    } catch (error) {
      const remoteError = error instanceof Error ? error.message : "远端草稿保存失败";
      set({ lastSyncError: remoteError, syncStatus: "sync-failed" });
      return {
        snapshot,
        remoteSaved: false,
        remoteError
      };
    }
  },
  resetDraft: () => {
    try {
      Taro.removeStorageSync(DRAFT_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    set({
      records: createInitialEvaluationRecords(),
      selectedItemIds: createDefaultSelectedEvaluationItemIds(),
      draftSavedAt: null,
      hydrated: true,
      lastSyncError: null,
      syncStatus: "local-saved"
    });
  },
  getItemScore: (dimensionKey, itemId) => {
    const item = findEvaluationItem(itemId);
    if (!item) {
      return 0;
    }
    return calculateItemScore(get().records[makeRecordKey(dimensionKey, itemId)] ?? [], item);
  },
  getDimensionScore: (dimensionKey) => {
    const dimension = evaluationConfig.find((candidate) => candidate.key === dimensionKey);
    if (!dimension) {
      return 0;
    }
    return calculateDimensionScore(get().records, dimension);
  },
  getTotalScore: () =>
    evaluationConfig.reduce((sum, dimension) => sum + calculateDimensionScore(get().records, dimension), 0),
  getValidationIssues: () => getEvaluationValidationIssues(get().records, get().selectedItemIds)
}));
