import { evaluationConfig } from "../../../data/evaluationConfig";
import { hasRecordMaterial, makeRecordKey, useEvaluationStore } from "../../../stores/useEvaluationStore";
import type { DimensionKey, SectionKey } from "../../../types/evaluation";

export interface EvaluationDirectoryItem {
  id: string;
  title: string;
  description: string;
  maxScore: number;
  score: number;
  selected: boolean;
  sectionKey: SectionKey;
}

export interface EvaluationDirectorySection {
  key: SectionKey;
  title: string;
  items: EvaluationDirectoryItem[];
}

export interface EvaluationDimensionSummary {
  key: DimensionKey;
  title: string;
  score: number;
  maxScore: number;
  selectedCount: number;
  itemCount: number;
  sections: EvaluationDirectorySection[];
}

export function useEvaluationPageData() {
  const records = useEvaluationStore((state) => state.records);
  const selectedItemIds = useEvaluationStore((state) => state.selectedItemIds);
  const draftSavedAt = useEvaluationStore((state) => state.draftSavedAt);
  const hydrated = useEvaluationStore((state) => state.hydrated);
  const hydrateDraft = useEvaluationStore((state) => state.hydrateDraft);
  const lastSyncError = useEvaluationStore((state) => state.lastSyncError);
  const getTotalScore = useEvaluationStore((state) => state.getTotalScore);
  const getDimensionScore = useEvaluationStore((state) => state.getDimensionScore);
  const getItemScore = useEvaluationStore((state) => state.getItemScore);
  const getValidationIssues = useEvaluationStore((state) => state.getValidationIssues);

  const totalScore = getTotalScore();
  const validationIssues = getValidationIssues();
  const selectedSet = new Set(selectedItemIds);
  const materialCount = Object.values(records).reduce(
    (sum, list) => sum + list.filter(hasRecordMaterial).length,
    0
  );

  const dimensionSummaries: EvaluationDimensionSummary[] = evaluationConfig.map((dimension) => {
    const sections = dimension.sections.map((section) => ({
      key: section.key,
      title: section.title,
      items: section.items.map((item) => {
        const key = makeRecordKey(dimension.key, item.id);

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          maxScore: item.maxScore,
          score: getItemScore(dimension.key, item.id),
          selected: selectedSet.has(key),
          sectionKey: section.key
        };
      })
    }));
    const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
    const selectedCount = sections.reduce(
      (sum, section) => sum + section.items.filter((item) => item.selected).length,
      0
    );

    return {
      key: dimension.key,
      title: dimension.title,
      score: getDimensionScore(dimension.key),
      maxScore: dimension.maxScore,
      selectedCount,
      itemCount,
      sections
    };
  });

  return {
    records,
    selectedItemIds,
    draftSavedAt,
    hydrated,
    hydrateDraft,
    lastSyncError,
    totalScore,
    validationIssues,
    materialCount,
    dimensionSummaries
  };
}
