import Taro from "@tarojs/taro";
import { create } from "zustand";
import { evaluationConfig, findEvaluationItem } from "../data/evaluationConfig";
import { fetchEvaluationSnapshot, saveEvaluationDraftRemote } from "../services/evaluationService";
import type {
  DimensionKey,
  EvaluationDraftSaveResult,
  EvaluationDimensionConfig,
  EvaluationItemConfig,
  EvaluationRecordMap,
  EvaluationSnapshot,
  EvaluationValidationIssue,
  ProofImage,
  ProofRecord,
  SectionKey
} from "../types/evaluation";
import type { EditingItemPayload } from "../types/transfer";
import { createId } from "../utils/id";

const DRAFT_KEY = "erkexitong-evaluation-draft";

interface EvaluationState {
  records: EvaluationRecordMap;
  selectedItemIds: string[];
  draftSavedAt: number | null;
  hydrated: boolean;
  lastSyncError: string | null;
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
  removeImage: (dimensionKey: DimensionKey, itemId: string, recordId: string, imageId: string) => void;
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

export function makeRecordKey(dimensionKey: DimensionKey, itemId: string): string {
  return `${dimensionKey}:${itemId}`;
}

export function hasRecordMaterial(record: ProofRecord): boolean {
  return record.text.trim().length > 0 || record.images.length > 0 || record.numericValue !== undefined;
}

function createRecord(
  dimensionKey: DimensionKey,
  sectionKey: SectionKey,
  itemId: string,
  item?: EvaluationItemConfig
): ProofRecord {
  const now = Date.now();
  return {
    id: createId("record"),
    dimensionKey,
    sectionKey,
    itemId,
    text: "",
    images: [],
    selectedOption: item?.options?.[0]?.value,
    numericValue: undefined,
    createdAt: now,
    updatedAt: now,
    dirty: false
  };
}

function createInitialRecords(): EvaluationRecordMap {
  const records: EvaluationRecordMap = {};

  evaluationConfig.forEach((dimension) => {
    dimension.sections.forEach((section) => {
      section.items.forEach((item) => {
        const key = makeRecordKey(dimension.key, item.id);
        records[key] = item.mode === "single" ? [createRecord(dimension.key, section.key, item.id, item)] : [];
      });
    });
  });

  return records;
}

function createDefaultSelectedItemIds(): string[] {
  const selected: string[] = [];

  evaluationConfig.forEach((dimension) => {
    dimension.sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.mode === "single") {
          selected.push(makeRecordKey(dimension.key, item.id));
        }
      });
    });
  });

  return selected;
}

function mergeWithInitialRecords(saved?: EvaluationRecordMap): EvaluationRecordMap {
  if (!saved) {
    return createInitialRecords();
  }

  return {
    ...createInitialRecords(),
    ...saved
  };
}

function createSnapshotFromState(state: Pick<EvaluationState, "records" | "selectedItemIds">): EvaluationSnapshot {
  return {
    records: state.records,
    selectedItemIds: state.selectedItemIds,
    savedAt: Date.now(),
    source: "local"
  };
}

function normalizeSnapshot(snapshot: EvaluationSnapshot, source: "local" | "remote"): EvaluationSnapshot {
  const records = mergeWithInitialRecords(snapshot.records);

  return {
    records,
    selectedItemIds: mergeSelectedItemIds(records, snapshot.selectedItemIds),
    savedAt: snapshot.savedAt,
    source
  };
}

function hasMeaningfulDraft(snapshot: EvaluationSnapshot): boolean {
  return Object.values(snapshot.records).some((records) => records.some(hasRecordMaterial));
}

function snapshotsDiffer(left: EvaluationSnapshot, right: EvaluationSnapshot): boolean {
  return JSON.stringify({
    records: left.records,
    selectedItemIds: left.selectedItemIds ?? []
  }) !== JSON.stringify({
    records: right.records,
    selectedItemIds: right.selectedItemIds ?? []
  });
}

async function readLocalSnapshot(): Promise<EvaluationSnapshot | null> {
  try {
    const result = await Taro.getStorage<EvaluationSnapshot>({ key: DRAFT_KEY });
    return normalizeSnapshot(result.data, "local");
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

function buildIssue(
  type: EvaluationValidationIssue["type"],
  dimensionTitle: string,
  itemTitle: string,
  message: string,
  recordIndex?: number
): EvaluationValidationIssue {
  return {
    type,
    dimensionTitle,
    itemTitle,
    recordIndex,
    message
  };
}

function mergeSelectedItemIds(records: EvaluationRecordMap, saved?: string[]): string[] {
  const selected = new Set(saved ?? createDefaultSelectedItemIds());

  Object.entries(records).forEach(([key, itemRecords]) => {
    if (itemRecords.some(hasRecordMaterial)) {
      selected.add(key);
    }
  });

  return Array.from(selected);
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

export function calculateRecordScore(record: ProofRecord, item: EvaluationItemConfig): number {
  if (!hasRecordMaterial(record)) {
    return 0;
  }

  if (item.scoreType === "fixed") {
    return item.fixedScore ?? item.maxScore;
  }

  if (item.scoreType === "select") {
    const option = item.options?.find((candidate) => candidate.value === record.selectedOption);
    return option?.score ?? 0;
  }

  if (item.scoreType === "count") {
    return item.scorePerRecord ?? 0;
  }

  if (item.scoreType === "number") {
    return Math.max(0, record.numericValue ?? 0) * (item.scorePerUnit ?? 0);
  }

  if (item.scoreType === "deduction") {
    return Math.max(0, item.maxScore - Math.max(0, record.numericValue ?? 0));
  }

  return 0;
}

function calculateItemScore(records: ProofRecord[], item: EvaluationItemConfig): number {
  const score = records.reduce((sum, record) => sum + calculateRecordScore(record, item), 0);
  return Math.min(item.maxScore, Math.round(score));
}

function calculateDimensionScore(records: EvaluationRecordMap, dimension: EvaluationDimensionConfig): number {
  const score = dimension.sections.reduce((dimensionSum, section) => {
    const sectionScore = section.items.reduce((sectionSum, item) => {
      const key = makeRecordKey(dimension.key, item.id);
      return sectionSum + calculateItemScore(records[key] ?? [], item);
    }, 0);

    return dimensionSum + Math.min(section.maxScore, sectionScore);
  }, 0);

  return Math.min(dimension.maxScore, score);
}

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  records: createInitialRecords(),
  selectedItemIds: createDefaultSelectedItemIds(),
  draftSavedAt: null,
  hydrated: false,
  lastSyncError: null,
  addRecord: (dimensionKey, sectionKey, itemId) => {
    const item = findEvaluationItem(itemId);
    const record = createRecord(dimensionKey, sectionKey, itemId, item);
    const key = makeRecordKey(dimensionKey, itemId);

    set((state) => ({
      selectedItemIds: state.selectedItemIds.includes(key)
        ? state.selectedItemIds
        : [...state.selectedItemIds, key],
      records: {
        ...state.records,
        [key]: [...(state.records[key] ?? []), record]
      }
    }));

    return record.id;
  },
  removeRecord: (dimensionKey, itemId, recordId) => {
    const key = makeRecordKey(dimensionKey, itemId);
    set((state) => ({
      records: {
        ...state.records,
        [key]: (state.records[key] ?? []).filter((record) => record.id !== recordId)
      }
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
              [key]: [createRecord(dimensionKey, sectionKey, itemId, item)]
            }
          : state.records
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
      }))
    })),
  updateOption: (dimensionKey, itemId, recordId, selectedOption) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        selectedOption,
        dirty: true,
        updatedAt: Date.now()
      }))
    })),
  updateNumber: (dimensionKey, itemId, recordId, numericValue) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        numericValue,
        dirty: true,
        updatedAt: Date.now()
      }))
    })),
  addImages: (dimensionKey, itemId, recordId, images) => {
    const item = findEvaluationItem(itemId);
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        images: [...record.images, ...images].slice(0, item?.imageLimit ?? 3),
        dirty: true,
        updatedAt: Date.now()
      }))
    }));
  },
  removeImage: (dimensionKey, itemId, recordId, imageId) =>
    set((state) => ({
      records: updateRecord(state.records, dimensionKey, itemId, recordId, (record) => ({
        ...record,
        images: record.images.filter((image) => image.id !== imageId),
        dirty: true,
        updatedAt: Date.now()
      }))
    })),
  applyTransferPayload: async (payload) => {
    const key = makeRecordKey(payload.dimensionKey, payload.itemId);
    let nextSnapshot: EvaluationSnapshot | null = null;

    set((state) => {
      const records = state.records[key] ?? [];
      const existing = records.find((record) => record.id === payload.recordId);
      const savedAt = Date.now();
      const nextRecord: ProofRecord = {
        ...(existing ?? createRecord(payload.dimensionKey, payload.sectionKey, payload.itemId)),
        id: payload.recordId,
        text: payload.text,
        images: payload.images,
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
        lastSyncError: null
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
        selectedItemIds: snapshot.selectedItemIds ?? createDefaultSelectedItemIds(),
        draftSavedAt: snapshot.savedAt,
        hydrated: true,
        lastSyncError: null
      });
    } else {
      const records = createInitialRecords();
      set({
        records,
        selectedItemIds: createDefaultSelectedItemIds(),
        draftSavedAt: null,
        hydrated: true,
        lastSyncError: null
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

    const localHasContent = localSnapshot ? hasMeaningfulDraft(localSnapshot) : false;
    const remoteHasContent = remoteSnapshot ? hasMeaningfulDraft(remoteSnapshot) : false;
    let selectedSnapshot = localSnapshot ?? remoteSnapshot;

    if (localSnapshot && remoteSnapshot && snapshotsDiffer(localSnapshot, remoteSnapshot)) {
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
        lastSyncError: remoteError
      });
      return;
    }

    const records = createInitialRecords();
    set({
      records,
      selectedItemIds: createDefaultSelectedItemIds(),
      draftSavedAt: null,
      hydrated: true,
      lastSyncError: remoteError
    });
  },
  applySnapshot: async (snapshot) => {
    const normalized = normalizeSnapshot(snapshot, snapshot.source ?? "local");
    await persistLocalSnapshot({
      ...normalized,
      source: "local"
    });
    set({
      records: normalized.records,
      selectedItemIds: normalized.selectedItemIds ?? createDefaultSelectedItemIds(),
      draftSavedAt: normalized.savedAt,
      hydrated: true,
      lastSyncError: null
    });
  },
  saveDraft: async (userId) => {
    const snapshot = createSnapshotFromState(get());
    await persistLocalSnapshot(snapshot);
    set({
      draftSavedAt: snapshot.savedAt,
      lastSyncError: null
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
      return {
        snapshot,
        remoteSaved: true
      };
    } catch (error) {
      const remoteError = error instanceof Error ? error.message : "远端草稿保存失败";
      set({ lastSyncError: remoteError });
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
      records: createInitialRecords(),
      selectedItemIds: createDefaultSelectedItemIds(),
      draftSavedAt: null,
      hydrated: true,
      lastSyncError: null
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
  getValidationIssues: () => {
    const issues: EvaluationValidationIssue[] = [];
    const records = get().records;
    const selectedSet = new Set(get().selectedItemIds);

    evaluationConfig.forEach((dimension) => {
      dimension.sections.forEach((section) => {
        section.items.forEach((item) => {
          const key = makeRecordKey(dimension.key, item.id);
          const itemRecords = records[key] ?? [];
          const isSelected = selectedSet.has(key);

          if (isSelected && itemRecords.length === 0) {
            issues.push(
              buildIssue(
                "empty_selected_item",
                dimension.title,
                item.title,
                `${dimension.title} - ${item.title} 已勾选但没有记录`
              )
            );
          }

          if (isSelected && itemRecords.length > 0 && !itemRecords.some(hasRecordMaterial)) {
            issues.push(
              buildIssue(
                "empty_selected_item",
                dimension.title,
                item.title,
                `${dimension.title} - ${item.title} 需要补充材料`
              )
            );
          }

          itemRecords.forEach((record, index) => {
            if (item.requiredText && hasRecordMaterial(record) && !record.text.trim()) {
              issues.push(
                buildIssue(
                  "missing_text",
                  dimension.title,
                  item.title,
                  `${dimension.title} - ${item.title} 第 ${index + 1} 条需要补充文字说明`,
                  index + 1
                )
              );
            }

            if (
              hasRecordMaterial(record) &&
              (item.scoreType === "number" || item.scoreType === "deduction") &&
              (record.numericValue === undefined || record.numericValue < 0)
            ) {
              issues.push(
                buildIssue(
                  "invalid_number",
                  dimension.title,
                  item.title,
                  `${dimension.title} - ${item.title} 第 ${index + 1} 条需要填写有效数值`,
                  index + 1
                )
              );
            }

            record.images.forEach((image) => {
              if (!image.uploaded) {
                issues.push(
                  buildIssue(
                    "local_image",
                    dimension.title,
                    item.title,
                    `${dimension.title} - ${item.title} 第 ${index + 1} 条包含未上传图片`,
                    index + 1
                  )
                );
              }
            });
          });
        });
      });
    });

    return issues;
  }
}));
