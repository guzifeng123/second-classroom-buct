import type { ReviewStatus } from "../types/submission";

export function normalizeReviewStatus(value?: string | null): ReviewStatus | null {
  if (
    value === "draft" ||
    value === "pending" ||
    value === "reviewing" ||
    value === "approved" ||
    value === "returned" ||
    value === "archived"
  ) {
    return value;
  }

  return null;
}

export function inferReviewStatus(issueCount: number, hasSubmission: boolean): ReviewStatus {
  if (!hasSubmission) {
    return "draft";
  }

  return issueCount > 0 ? "returned" : "pending";
}

export function getReviewStatusText(status: ReviewStatus): string {
  if (status === "draft") {
    return "未提交";
  }

  if (status === "pending") {
    return "待审核";
  }

  if (status === "reviewing") {
    return "审核中";
  }

  if (status === "approved") {
    return "已通过";
  }

  if (status === "archived") {
    return "已归档";
  }

  return "退回补充";
}
