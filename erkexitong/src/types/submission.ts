import type { DimensionKey, EvaluationRecordMap } from "./evaluation";

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
  createdAt: number;
  totalScore: number;
  materialCount: number;
  issueCount: number;
  records: EvaluationRecordMap;
  selectedItemIds: string[];
  dimensionSummaries: SubmissionDimensionSummary[];
}
