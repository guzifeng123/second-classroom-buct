import type { EvaluationRecordMap, EvaluationValidationIssue } from "../types/evaluation";
import type { SubmissionDimensionSummary, SubmissionRecord } from "../types/submission";
import { inferReviewStatus, normalizeReviewStatus } from "./reviewStatus";

export interface SubmissionApiResponse {
  submissionId?: string;
  submission_id?: string;
  id?: string;
  userId?: string;
  user_id?: string;
  studentName?: string;
  student_name?: string;
  name?: string;
  className?: string;
  class_name?: string;
  class?: string;
  createdAt?: number;
  created_at?: string;
  ruleVersion?: string;
  rule_version?: string;
  totalScore?: number;
  total_score?: number;
  materialCount?: number;
  material_count?: number;
  issueCount?: number;
  issue_count?: number;
  reviewStatus?: string;
  review_status?: string;
  status?: string;
  auditStatus?: string;
  audit_status?: string;
  reviewComment?: string;
  review_comment?: string;
  returnReason?: string;
  return_reason?: string;
  reviewerName?: string;
  reviewer_name?: string;
  reviewedAt?: number;
  reviewed_at?: string;
  validationIssues?: EvaluationValidationIssue[];
  validation_issues?: EvaluationValidationIssue[];
  issues?: EvaluationValidationIssue[];
  records?: EvaluationRecordMap;
  selectedItemIds?: string[];
  selected_item_ids?: string[];
  dimensionSummaries?: SubmissionDimensionSummary[];
  dimension_summaries?: SubmissionDimensionSummary[];
}

export type SubmissionListApiResponse = SubmissionApiResponse[] | { data?: SubmissionApiResponse[]; total?: number };

export function parseSubmissionTime(value?: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

export function normalizeRemoteSubmission(raw: SubmissionApiResponse): SubmissionRecord {
  const issueCount = raw.issueCount ?? raw.issue_count ?? 0;

  return {
    submissionId: raw.submissionId ?? raw.submission_id ?? raw.id ?? "",
    userId: raw.userId ?? raw.user_id ?? "",
    studentName: raw.studentName ?? raw.student_name ?? raw.name,
    className: raw.className ?? raw.class_name ?? raw.class,
    createdAt: parseSubmissionTime(raw.createdAt ?? raw.created_at),
    ruleVersion: raw.ruleVersion ?? raw.rule_version ?? "unknown",
    totalScore: raw.totalScore ?? raw.total_score ?? 0,
    materialCount: raw.materialCount ?? raw.material_count ?? 0,
    issueCount,
    reviewStatus:
      normalizeReviewStatus(raw.reviewStatus ?? raw.review_status ?? raw.status ?? raw.auditStatus ?? raw.audit_status) ??
      inferReviewStatus(issueCount, true),
    reviewComment: raw.reviewComment ?? raw.review_comment,
    returnReason: raw.returnReason ?? raw.return_reason,
    reviewerName: raw.reviewerName ?? raw.reviewer_name,
    reviewedAt: raw.reviewedAt ?? (raw.reviewed_at ? parseSubmissionTime(raw.reviewed_at) : undefined),
    validationIssues: raw.validationIssues ?? raw.validation_issues ?? raw.issues ?? [],
    records: raw.records ?? {},
    selectedItemIds: raw.selectedItemIds ?? raw.selected_item_ids ?? [],
    dimensionSummaries: raw.dimensionSummaries ?? raw.dimension_summaries ?? []
  };
}

export function normalizeSubmissionList(raw: SubmissionListApiResponse): SubmissionRecord[] {
  const list = Array.isArray(raw) ? raw : raw.data ?? [];
  return list.map(normalizeRemoteSubmission).filter((submission) => submission.submissionId);
}

export function normalizeStoredSubmission(record: SubmissionRecord): SubmissionRecord {
  return {
    ...record,
    ruleVersion: record.ruleVersion ?? "unknown",
    studentName: record.studentName,
    className: record.className,
    reviewStatus: normalizeReviewStatus(record.reviewStatus) ?? inferReviewStatus(record.issueCount ?? 0, true),
    reviewComment: record.reviewComment,
    returnReason: record.returnReason,
    reviewerName: record.reviewerName,
    reviewedAt: record.reviewedAt,
    validationIssues: record.validationIssues ?? [],
    dimensionSummaries: record.dimensionSummaries ?? [],
    selectedItemIds: record.selectedItemIds ?? [],
    records: record.records ?? {}
  };
}
