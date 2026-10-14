import type { SubmissionDimensionSummary, SubmissionRecord, ReviewStatus } from "../types/submission";

export interface ReviewStatsRow {
  id: string;
  score: number;
  materialCount: number;
  issueCount: number;
  status: ReviewStatus;
}

export interface ReviewDimensionStats {
  key: string;
  title: string;
  averageScore: number;
  maxScore: number;
  scoreRate: number;
  scoreGap: number;
  materialCount: number;
  issueCount: number;
}

export interface ReviewStatsSummary {
  totalCount: number;
  submittedCount: number;
  pendingCount: number;
  returnedCount: number;
  averageScore: number;
  submissionRate: number;
  materialCompletionRate: number;
  averageMaterialCount: number;
  highRiskDimension?: ReviewDimensionStats;
  dimensionStats: ReviewDimensionStats[];
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function roundOneDecimal(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function isSubmittedStatus(status: ReviewStatus): boolean {
  return status !== "draft";
}

function buildDimensionStats(
  submissions: SubmissionRecord[],
  fallbackDimensionSummaries: SubmissionDimensionSummary[]
): ReviewDimensionStats[] {
  const dimensionMap = new Map<
    string,
    {
      key: string;
      title: string;
      maxScore: number;
      scoreTotal: number;
      materialCount: number;
      issueCount: number;
      count: number;
    }
  >();

  const sourceSummaries = submissions.length > 0
    ? submissions.flatMap((submission) => submission.dimensionSummaries)
    : fallbackDimensionSummaries;

  sourceSummaries.forEach((summary) => {
    const previous = dimensionMap.get(summary.key) ?? {
      key: summary.key,
      title: summary.title,
      maxScore: summary.maxScore,
      scoreTotal: 0,
      materialCount: 0,
      issueCount: 0,
      count: 0
    };

    previous.title = summary.title;
    previous.maxScore = Math.max(previous.maxScore, summary.maxScore);
    previous.scoreTotal += summary.score;
    previous.materialCount += summary.materialCount;
    previous.issueCount += summary.issueCount;
    previous.count += 1;
    dimensionMap.set(summary.key, previous);
  });

  return Array.from(dimensionMap.values()).map((summary) => {
    const averageScore = roundOneDecimal(summary.scoreTotal / Math.max(1, summary.count));
    const scoreGap = Math.max(0, roundOneDecimal(summary.maxScore - averageScore));

    return {
      key: summary.key,
      title: summary.title,
      averageScore,
      maxScore: summary.maxScore,
      scoreRate: roundPercent(averageScore / Math.max(1, summary.maxScore)),
      scoreGap,
      materialCount: summary.materialCount,
      issueCount: summary.issueCount
    };
  });
}

function findHighRiskDimension(dimensionStats: ReviewDimensionStats[]): ReviewDimensionStats | undefined {
  return [...dimensionStats].sort((left, right) => {
    return right.issueCount - left.issueCount || right.scoreGap - left.scoreGap || left.scoreRate - right.scoreRate;
  })[0];
}

export function buildReviewStatsSummary(
  rows: ReviewStatsRow[],
  submissions: SubmissionRecord[],
  fallbackDimensionSummaries: SubmissionDimensionSummary[] = []
): ReviewStatsSummary {
  const totalCount = rows.length;
  const submittedCount = rows.filter((row) => isSubmittedStatus(row.status)).length;
  const pendingCount = rows.filter((row) => row.status === "pending" || row.status === "reviewing").length;
  const returnedCount = rows.filter((row) => row.status === "returned").length;
  const averageScore = totalCount > 0
    ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / totalCount)
    : 0;
  const materialRows = rows.filter((row) => row.materialCount > 0).length;
  const averageMaterialCount = totalCount > 0
    ? roundOneDecimal(rows.reduce((sum, row) => sum + row.materialCount, 0) / totalCount)
    : 0;
  const dimensionStats = buildDimensionStats(submissions, fallbackDimensionSummaries);

  return {
    totalCount,
    submittedCount,
    pendingCount,
    returnedCount,
    averageScore,
    submissionRate: roundPercent(submittedCount / Math.max(1, totalCount)),
    materialCompletionRate: roundPercent(materialRows / Math.max(1, totalCount)),
    averageMaterialCount,
    highRiskDimension: findHighRiskDimension(dimensionStats),
    dimensionStats
  };
}
