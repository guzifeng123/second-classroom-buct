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

  return {
    records,
    selectedItemIds: mergeSelectedEvaluationItemIds(records, snapshot.selectedItemIds),
    savedAt: snapshot.savedAt,
    source
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
