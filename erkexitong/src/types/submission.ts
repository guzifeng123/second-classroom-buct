import type { DimensionKey, EvaluationRecordMap, EvaluationValidationIssue } from "./evaluation";

export type ReviewStatus = "draft" | "pending" | "reviewing" | "approved" | "returned" | "archived";

export interface SubmissionDimensionSummary {
  key: DimensionKey;
  title: string;
  score: number;
  maxScore: number;
  selectedCount: number;
  materialCount: number;
  issueCount: number;
}

export interface SubmissionRecord {
  submissionId: string;
  userId: string;
  studentName?: string;
  className?: string;
  createdAt: number;
  ruleVersion: string;
  totalScore: number;
  materialCount: number;
  issueCount: number;
  reviewStatus: ReviewStatus;
  reviewComment?: string;
  returnReason?: string;
  reviewerName?: string;
  reviewedAt?: number;
  validationIssues: EvaluationValidationIssue[];
  records: EvaluationRecordMap;
  selectedItemIds: string[];
  dimensionSummaries: SubmissionDimensionSummary[];
}
