import type {
  DimensionKey,
  EvaluationDimensionConfig,
  EvaluationItemConfig,
  EvaluationRecordMap,
  ProofRecord
} from "../types/evaluation";

export function makeRecordKey(dimensionKey: DimensionKey, itemId: string): string {
  return `${dimensionKey}:${itemId}`;
}

export function hasRecordMaterial(record: ProofRecord): boolean {
  return (
    record.text.trim().length > 0 ||
    record.images.length > 0 ||
    (record.noteReferences?.length ?? 0) > 0 ||
    record.numericValue !== undefined
  );
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

export function calculateItemScore(records: ProofRecord[], item: EvaluationItemConfig): number {
  const score = records.reduce((sum, record) => sum + calculateRecordScore(record, item), 0);
  return Math.min(item.maxScore, Math.round(score));
}

export function calculateDimensionScore(
  records: EvaluationRecordMap,
  dimension: EvaluationDimensionConfig
): number {
  const score = dimension.sections.reduce((dimensionSum, section) => {
    const sectionScore = section.items.reduce((sectionSum, item) => {
      const key = makeRecordKey(dimension.key, item.id);
      return sectionSum + calculateItemScore(records[key] ?? [], item);
    }, 0);

    return dimensionSum + Math.min(section.maxScore, sectionScore);
  }, 0);

  return Math.min(dimension.maxScore, score);
}
