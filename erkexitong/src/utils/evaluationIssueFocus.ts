import type { EvaluationFocusField, EvaluationValidationIssue } from "../types/evaluation";

export function getIssueFocusField(issue: EvaluationValidationIssue): EvaluationFocusField | undefined {
  if (issue.type === "missing_text") {
    return "text";
  }

  if (issue.type === "invalid_number") {
    return "number";
  }

  if (issue.type === "local_image") {
    return "upload";
  }

  return undefined;
}

export function buildIssueFocusUrl(issue: EvaluationValidationIssue): string {
  const params: Array<[string, string]> = [
    ["mode", "fill"],
    ["focusDimension", issue.dimensionKey],
    ["focusSection", issue.sectionKey],
    ["focusItem", issue.itemId]
  ];
  const focusField = getIssueFocusField(issue);

  if (issue.recordId) {
    params.push(["focusRecord", issue.recordId]);
  }

  if (focusField) {
    params.push(["focusField", focusField]);
  }

  if (focusField === "upload") {
    params.push(["focusUpload", "1"]);
  }

  if (typeof issue.imageIndex === "number") {
    params.push(["focusImageIndex", String(issue.imageIndex)]);
  }

  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");

  return `/pages/evaluation/index?${query}`;
}
