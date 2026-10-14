import type { SubmissionRecord } from "../types/submission";
import { getReviewStatusText } from "./reviewStatus";

const CSV_HEADERS = [
  "提交编号",
  "学生",
  "班级",
  "提交时间",
  "规则版本",
  "审核状态",
  "总分",
  "材料数",
  "问题数",
  "五维得分",
  "审核意见",
  "退回原因",
  "审核人",
  "审核时间"
];

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r?\n/g, "\n");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatTimestamp(value?: number): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatDimensionScores(record: SubmissionRecord): string {
  return record.dimensionSummaries
    .map((summary) => `${summary.title}:${summary.score}/${summary.maxScore}`)
    .join("；");
}

export function buildSubmissionExportRows(records: SubmissionRecord[]): string[][] {
  return records.map((record) => [
    record.submissionId,
    record.studentName ?? record.userId,
    record.className ?? "",
    formatTimestamp(record.createdAt),
    record.ruleVersion,
    getReviewStatusText(record.reviewStatus),
    String(record.totalScore),
    String(record.materialCount),
    String(record.issueCount),
    formatDimensionScores(record),
    record.reviewComment ?? "",
    record.returnReason ?? "",
    record.reviewerName ?? "",
    formatTimestamp(record.reviewedAt)
  ]);
}

export function buildSubmissionCsv(records: SubmissionRecord[]): string {
  const rows = [CSV_HEADERS, ...buildSubmissionExportRows(records)];
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

export function buildSubmissionCsvFileName(prefix = "evaluation-submissions", timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${prefix}-${year}${month}${day}.csv`;
}
