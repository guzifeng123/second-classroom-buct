import { evaluationConfig } from "../data/evaluationConfig";
import type {
  DimensionKey,
  EvaluationRecordMap,
  EvaluationValidationIssue,
  SectionKey
} from "../types/evaluation";
import { hasRecordMaterial, makeRecordKey } from "./evaluationScoring";

function buildIssue(
  type: EvaluationValidationIssue["type"],
  dimensionKey: DimensionKey,
  sectionKey: SectionKey,
  itemId: string,
  dimensionTitle: string,
  itemTitle: string,
  message: string,
  recordIndex?: number,
  recordId?: string,
  imageIndex?: number
): EvaluationValidationIssue {
  return {
    type,
    dimensionKey,
    sectionKey,
    itemId,
    recordId,
    dimensionTitle,
    itemTitle,
    recordIndex,
    imageIndex,
    message
  };
}

export function getEvaluationValidationIssues(
  records: EvaluationRecordMap,
  selectedItemIds: string[]
): EvaluationValidationIssue[] {
  const issues: EvaluationValidationIssue[] = [];
  const selectedSet = new Set(selectedItemIds);

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
              dimension.key,
              section.key,
              item.id,
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
              dimension.key,
              section.key,
              item.id,
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
                dimension.key,
                section.key,
                item.id,
                dimension.title,
                item.title,
                `${dimension.title} - ${item.title} 第 ${index + 1} 条需要补充文字说明`,
                index + 1,
                record.id
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
                dimension.key,
                section.key,
                item.id,
                dimension.title,
                item.title,
                `${dimension.title} - ${item.title} 第 ${index + 1} 条需要填写有效数值`,
                index + 1,
                record.id
              )
            );
          }

          record.images.forEach((image, imageIndex) => {
            if (!image.uploaded) {
              issues.push(
                buildIssue(
                  "local_image",
                  dimension.key,
                  section.key,
                  item.id,
                  dimension.title,
                  item.title,
                  `${dimension.title} - ${item.title} 第 ${index + 1} 条包含未上传图片`,
                  index + 1,
                  record.id,
                  imageIndex
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
