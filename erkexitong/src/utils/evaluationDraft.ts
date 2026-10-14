import { evaluationConfig, findEvaluationItem } from "../data/evaluationConfig";
import type {
  DimensionKey,
  EvaluationItemConfig,
  EvaluationRecordMap,
  EvaluationSnapshot,
  ProofRecord,
  SectionKey
} from "../types/evaluation";
import { createId } from "./id";
import { hasRecordMaterial, makeRecordKey } from "./evaluationScoring";

export interface EvaluationSnapshotSummary {
  selectedItemCount: number;
  materialCount: number;
  imageCount: number;
}

export interface EvaluationDimensionDiffSummary {
  dimensionKey: DimensionKey;
  title: string;
  changedItemCount: number;
  localMaterialCount: number;
  remoteMaterialCount: number;
}

export interface EvaluationItemDiffSummary {
  recordKey: string;
  dimensionKey: DimensionKey;
  dimensionTitle: string;
  itemTitle: string;
  selectionChanged: boolean;
  recordsChanged: boolean;
  localSelected: boolean;
  remoteSelected: boolean;
  localMaterialCount: number;
  remoteMaterialCount: number;
}

type RawEvaluationSnapshot = EvaluationSnapshot & {
  draft_version?: unknown;
  version?: unknown;
};

export function createEvaluationRecord(
  dimensionKey: DimensionKey,
  sectionKey: SectionKey,
  itemId: string,
  item: EvaluationItemConfig | undefined = findEvaluationItem(itemId)
): ProofRecord {
  const now = Date.now();
  return {
    id: createId("record"),
    dimensionKey,
    sectionKey,
    itemId,
    text: "",
    images: [],
    noteReferences: [],
    selectedOption: item?.options?.[0]?.value,
    numericValue: undefined,
    createdAt: now,
    updatedAt: now,
    dirty: false
  };
}

export function createInitialEvaluationRecords(): EvaluationRecordMap {
  const records: EvaluationRecordMap = {};

  evaluationConfig.forEach((dimension) => {
    dimension.sections.forEach((section) => {
      section.items.forEach((item) => {
        const key = makeRecordKey(dimension.key, item.id);
        records[key] =
          item.mode === "single" ? [createEvaluationRecord(dimension.key, section.key, item.id, item)] : [];
      });
    });
  });

  return records;
}

export function createDefaultSelectedEvaluationItemIds(): string[] {
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

export function mergeEvaluationRecordsWithInitial(saved?: EvaluationRecordMap): EvaluationRecordMap {
  if (!saved) {
    return createInitialEvaluationRecords();
  }

  return {
    ...createInitialEvaluationRecords(),
    ...saved
  };
}

export function mergeSelectedEvaluationItemIds(records: EvaluationRecordMap, saved?: string[]): string[] {
  const selected = new Set(saved ?? createDefaultSelectedEvaluationItemIds());

  Object.entries(records).forEach(([key, itemRecords]) => {
    if (itemRecords.some(hasRecordMaterial)) {
      selected.add(key);
    }
  });

  return Array.from(selected);
}

export function normalizeEvaluationSnapshot(
  snapshot: EvaluationSnapshot,
  source: "local" | "remote"
): EvaluationSnapshot {
  const records = mergeEvaluationRecordsWithInitial(snapshot.records);
  const rawSnapshot = snapshot as RawEvaluationSnapshot;
  const rawVersion = rawSnapshot.draftVersion ?? rawSnapshot.draft_version ?? rawSnapshot.version;
  const draftVersion =
    typeof rawVersion === "string" || typeof rawVersion === "number" ? String(rawVersion).trim() : "";

  return {
    records,
    selectedItemIds: mergeSelectedEvaluationItemIds(records, snapshot.selectedItemIds),
    savedAt: snapshot.savedAt,
    source,
    deviceName: snapshot.deviceName,
    draftVersion: draftVersion || undefined
  };
}

export function hasMeaningfulEvaluationDraft(snapshot: EvaluationSnapshot): boolean {
  return Object.values(snapshot.records).some((records) => records.some(hasRecordMaterial));
}

export function evaluationSnapshotsDiffer(left: EvaluationSnapshot, right: EvaluationSnapshot): boolean {
  return JSON.stringify({
    records: left.records,
    selectedItemIds: left.selectedItemIds ?? []
  }) !== JSON.stringify({
    records: right.records,
    selectedItemIds: right.selectedItemIds ?? []
  });
}

export function summarizeEvaluationSnapshot(snapshot: EvaluationSnapshot): EvaluationSnapshotSummary {
  const selectedItems = new Set(snapshot.selectedItemIds ?? []);
  const materialRecords = Object.entries(snapshot.records).flatMap(([key, records]) => {
    const recordsWithMaterial = records.filter(hasRecordMaterial);

    if (recordsWithMaterial.length > 0) {
      selectedItems.add(key);
    }

    return recordsWithMaterial;
  });

  return {
    selectedItemCount: selectedItems.size,
    materialCount: materialRecords.length,
    imageCount: materialRecords.reduce((sum, record) => sum + record.images.length, 0)
  };
}

export function countChangedEvaluationItems(left: EvaluationSnapshot, right: EvaluationSnapshot): number {
  const keys = new Set([
    ...Object.keys(left.records),
    ...Object.keys(right.records),
    ...(left.selectedItemIds ?? []),
    ...(right.selectedItemIds ?? [])
  ]);
  const leftSelected = new Set(left.selectedItemIds ?? []);
  const rightSelected = new Set(right.selectedItemIds ?? []);
  let changedCount = 0;

  for (const key of keys) {
    const selectionChanged = leftSelected.has(key) !== rightSelected.has(key);
    const recordsChanged = JSON.stringify(left.records[key] ?? []) !== JSON.stringify(right.records[key] ?? []);

    if (selectionChanged || recordsChanged) {
      changedCount += 1;
    }
  }

  return changedCount;
}

function getDimensionKeyFromRecordKey(recordKey: string): DimensionKey | null {
  const [dimensionKey] = recordKey.split(":");
  return evaluationConfig.some((dimension) => dimension.key === dimensionKey) ? (dimensionKey as DimensionKey) : null;
}

function getItemIdFromRecordKey(recordKey: string): string {
  const separatorIndex = recordKey.indexOf(":");
  return separatorIndex >= 0 ? recordKey.slice(separatorIndex + 1) : recordKey;
}

function countMaterialRecords(records: ProofRecord[] | undefined): number {
  return (records ?? []).filter(hasRecordMaterial).length;
}

export function summarizeChangedEvaluationItems(
  localSnapshot: EvaluationSnapshot,
  remoteSnapshot: EvaluationSnapshot
): EvaluationItemDiffSummary[] {
  const keys = new Set([
    ...Object.keys(localSnapshot.records),
    ...Object.keys(remoteSnapshot.records),
    ...(localSnapshot.selectedItemIds ?? []),
    ...(remoteSnapshot.selectedItemIds ?? [])
  ]);
  const localSelected = new Set(localSnapshot.selectedItemIds ?? []);
  const remoteSelected = new Set(remoteSnapshot.selectedItemIds ?? []);
  const summaries: EvaluationItemDiffSummary[] = [];

  for (const key of keys) {
    const dimensionKey = getDimensionKeyFromRecordKey(key);

    if (!dimensionKey) {
      continue;
    }

    const selectionChanged = localSelected.has(key) !== remoteSelected.has(key);
    const recordsChanged =
      JSON.stringify(localSnapshot.records[key] ?? []) !== JSON.stringify(remoteSnapshot.records[key] ?? []);

    if (!selectionChanged && !recordsChanged) {
      continue;
    }

    const dimension = evaluationConfig.find((candidate) => candidate.key === dimensionKey);
    const item = findEvaluationItem(getItemIdFromRecordKey(key));

    summaries.push({
      recordKey: key,
      dimensionKey,
      dimensionTitle: dimension?.title ?? dimensionKey,
      itemTitle: item?.title ?? getItemIdFromRecordKey(key),
      selectionChanged,
      recordsChanged,
      localSelected: localSelected.has(key),
      remoteSelected: remoteSelected.has(key),
      localMaterialCount: countMaterialRecords(localSnapshot.records[key]),
      remoteMaterialCount: countMaterialRecords(remoteSnapshot.records[key])
    });
  }

  return summaries.sort((left, right) => {
    const leftDimensionIndex = evaluationConfig.findIndex((dimension) => dimension.key === left.dimensionKey);
    const rightDimensionIndex = evaluationConfig.findIndex((dimension) => dimension.key === right.dimensionKey);

    if (leftDimensionIndex !== rightDimensionIndex) {
      return leftDimensionIndex - rightDimensionIndex;
    }

    return left.recordKey.localeCompare(right.recordKey);
  });
}

export function summarizeChangedEvaluationDimensions(
  localSnapshot: EvaluationSnapshot,
  remoteSnapshot: EvaluationSnapshot
): EvaluationDimensionDiffSummary[] {
  const summaryByDimension = new Map<DimensionKey, EvaluationDimensionDiffSummary>();

  summarizeChangedEvaluationItems(localSnapshot, remoteSnapshot).forEach((itemDiff) => {
    const current = summaryByDimension.get(itemDiff.dimensionKey) ?? {
      dimensionKey: itemDiff.dimensionKey,
      title: itemDiff.dimensionTitle,
      changedItemCount: 0,
      localMaterialCount: 0,
      remoteMaterialCount: 0
    };

    current.changedItemCount += 1;
    current.localMaterialCount += itemDiff.localMaterialCount;
    current.remoteMaterialCount += itemDiff.remoteMaterialCount;
    summaryByDimension.set(itemDiff.dimensionKey, current);
  });

  return evaluationConfig
    .map((dimension) => summaryByDimension.get(dimension.key))
    .filter((summary): summary is EvaluationDimensionDiffSummary => Boolean(summary));
}

function formatDimensionDiffSummary(summaries: EvaluationDimensionDiffSummary[]): string {
  if (summaries.length === 0) {
    return "差异维度：无。";
  }

  return `差异维度：${summaries
    .map(
      (summary) =>
        `${summary.title} ${summary.changedItemCount} 项（本机材料 ${summary.localMaterialCount} 条，远端 ${summary.remoteMaterialCount} 条）`
    )
    .join("；")}。`;
}

function formatSelectionChange(summary: EvaluationItemDiffSummary): string {
  if (!summary.selectionChanged) {
    return "";
  }

  if (summary.localSelected && !summary.remoteSelected) {
    return "远端未选";
  }

  if (!summary.localSelected && summary.remoteSelected) {
    return "远端新增";
  }

  return "选择变化";
}

function formatItemDiffSummary(summaries: EvaluationItemDiffSummary[], maxItems = 5): string {
  if (summaries.length === 0) {
    return "差异条目：无。";
  }

  const visibleSummaries = summaries.slice(0, maxItems);
  const suffix = summaries.length > maxItems ? `；等 ${summaries.length} 项` : "";
  return `差异条目：${visibleSummaries
    .map((summary) => {
      const changeParts = [
        formatSelectionChange(summary),
        summary.recordsChanged ? "材料变化" : ""
      ].filter(Boolean);
      const changeText = changeParts.length > 0 ? changeParts.join("、") : "内容变化";

      return `${summary.itemTitle}（${changeText}，本机材料 ${summary.localMaterialCount} 条，远端 ${summary.remoteMaterialCount} 条）`;
    })
    .join("；")}${suffix}。`;
}

export function formatEvaluationSnapshotTime(savedAt: number): string {
  const date = new Date(savedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function buildSnapshotRecencyText(localSavedAt: number, remoteSavedAt: number): string {
  const difference = remoteSavedAt - localSavedAt;

  if (Math.abs(difference) < 60000) {
    return "两个版本保存时间接近";
  }

  const minutes = Math.max(1, Math.round(Math.abs(difference) / 60000));
  return `${difference > 0 ? "远端" : "本机"}较新约 ${minutes} 分钟`;
}

function formatDraftVersion(sourceLabel: string, snapshot: EvaluationSnapshot): string {
  return snapshot.draftVersion ? `${sourceLabel}版本 ${snapshot.draftVersion}` : "";
}

export function buildEvaluationConflictMessage(
  localSnapshot: EvaluationSnapshot,
  remoteSnapshot: EvaluationSnapshot
): string {
  const localSummary = summarizeEvaluationSnapshot(localSnapshot);
  const remoteSummary = summarizeEvaluationSnapshot(remoteSnapshot);
  const changedItemCount = countChangedEvaluationItems(localSnapshot, remoteSnapshot);
  const dimensionDiffs = summarizeChangedEvaluationDimensions(localSnapshot, remoteSnapshot);
  const itemDiffs = summarizeChangedEvaluationItems(localSnapshot, remoteSnapshot);
  const remoteSource = remoteSnapshot.deviceName ? `远端 · ${remoteSnapshot.deviceName}` : "远端服务";
  const versionSummary = [
    formatDraftVersion("本机", localSnapshot),
    formatDraftVersion("远端", remoteSnapshot)
  ].filter(Boolean);

  return [
    `本机（${formatEvaluationSnapshotTime(localSnapshot.savedAt)}）：已选 ${localSummary.selectedItemCount} 项，材料 ${localSummary.materialCount} 条，图片 ${localSummary.imageCount} 张`,
    `${remoteSource}（${formatEvaluationSnapshotTime(remoteSnapshot.savedAt)}）：已选 ${remoteSummary.selectedItemCount} 项，材料 ${remoteSummary.materialCount} 条，图片 ${remoteSummary.imageCount} 张`,
    versionSummary.length > 0 ? `草稿版本：${versionSummary.join("；")}。` : "",
    `差异涉及 ${changedItemCount} 个评定条目；${buildSnapshotRecencyText(localSnapshot.savedAt, remoteSnapshot.savedAt)}。`,
    formatDimensionDiffSummary(dimensionDiffs),
    formatItemDiffSummary(itemDiffs),
    "“用远端”会覆盖本机当前草稿；“保留本机”继续使用本机版本。"
  ].filter(Boolean).join("\n");
}
