import { evaluationConfig } from "../data/evaluationConfig";
import { calculateRecordScore, hasRecordMaterial, makeRecordKey } from "../stores/useEvaluationStore";
import type {
  EvaluationRecordMap,
  EvaluationValidationIssue,
  ProofRecord
} from "../types/evaluation";
import type { SubmissionDimensionSummary } from "../types/submission";

function selectedSetFromRecords(records: EvaluationRecordMap, selectedItemIds: string[]): Set<string> {
  const selected = new Set(selectedItemIds);

  Object.entries(records).forEach(([key, list]) => {
    if (list.some(hasRecordMaterial)) {
      selected.add(key);
    }
  });

  return selected;
}

function calculateItemScore(records: ProofRecord[], itemId: string): number {
  for (const dimension of evaluationConfig) {
    for (const section of dimension.sections) {
      const item = section.items.find((candidate) => candidate.id === itemId);
      if (item) {
        const score = records.reduce((sum, record) => sum + calculateRecordScore(record, item), 0);
        return Math.min(item.maxScore, Math.round(score));
      }
    }
  }

  return 0;
}

export function buildDimensionSummaries(
  records: EvaluationRecordMap,
  selectedItemIds: string[],
  issues: EvaluationValidationIssue[] = []
): SubmissionDimensionSummary[] {
  const selected = selectedSetFromRecords(records, selectedItemIds);

  return evaluationConfig.map((dimension) => {
    let score = 0;
    let selectedCount = 0;
    let materialCount = 0;

    dimension.sections.forEach((section) => {
      let sectionScore = 0;

      section.items.forEach((item) => {
        const key = makeRecordKey(dimension.key, item.id);
        const itemRecords = records[key] ?? [];

        if (selected.has(key)) {
          selectedCount += 1;
        }

        materialCount += itemRecords.filter(hasRecordMaterial).length;
        sectionScore += calculateItemScore(itemRecords, item.id);
      });

      score += Math.min(section.maxScore, sectionScore);
    });

    return {
      key: dimension.key,
      title: dimension.title,
      score: Math.min(dimension.maxScore, score),
      maxScore: dimension.maxScore,
      selectedCount,
      materialCount,
      issueCount: issues.filter((issue) => issue.dimensionTitle === dimension.title).length
    };
  });
}

export function countMaterials(records: EvaluationRecordMap): number {
  return Object.values(records).reduce((sum, list) => sum + list.filter(hasRecordMaterial).length, 0);
}
