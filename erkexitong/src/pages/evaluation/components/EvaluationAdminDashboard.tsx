import { useCallback, useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Input, Text, View } from "@tarojs/components";
import { EVALUATION_RULE_VERSION } from "../../../data/evaluationConfig";
import { fetchSubmissionRecords } from "../../../services/submissionService";
import type { EvaluationValidationIssue } from "../../../types/evaluation";
import type { ReviewStatus, SubmissionDimensionSummary, SubmissionRecord } from "../../../types/submission";
import { exportTextFile } from "../../../utils/fileExport";
import { getReviewStatusText, inferReviewStatus } from "../../../utils/reviewStatus";
import { buildReviewStatsSummary } from "../../../utils/reviewStats";
import { buildSubmissionCsv, buildSubmissionCsvFileName } from "../../../utils/submissionExport";
import type { EvaluationDimensionSummary } from "../hooks/useEvaluationPageData";

type ReviewStatusFilter = "all" | ReviewStatus;
type ReviewSortMode = "latest" | "issue-desc" | "issue-asc" | "score-desc";
type TimeRangeFilter = "all" | "7d" | "30d" | "90d";

export interface AdminStudentRow {
  id: string;
  name: string;
  className: string;
  score: number;
  materialCount: number;
  issueCount: number;
  status: ReviewStatus;
  createdAt?: number;
  reviewComment?: string;
  returnReason?: string;
  reviewerName?: string;
  reviewedAt?: number;
}

interface EvaluationAdminDashboardProps {
  userId: string;
  totalScore: number;
  materialCount: number;
  validationIssues: EvaluationValidationIssue[];
  dimensionSummaries: EvaluationDimensionSummary[];
  onShowFill: () => void;
  onShowShowcase: () => void;
  onOpenHistory: () => void;
}

const statusFilterOptions: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "draft", label: "未提交" },
  { value: "pending", label: "待审核" },
  { value: "reviewing", label: "审核中" },
  { value: "approved", label: "已通过" },
  { value: "returned", label: "退回补充" },
  { value: "archived", label: "已归档" }
];

const sortOptions: Array<{ value: ReviewSortMode; label: string }> = [
  { value: "latest", label: "最新" },
  { value: "issue-desc", label: "问题最多" },
  { value: "issue-asc", label: "问题最少" },
  { value: "score-desc", label: "分数最高" }
];

const timeRangeOptions: Array<{ value: TimeRangeFilter; label: string; days?: number }> = [
  { value: "all", label: "全部时间" },
  { value: "7d", label: "近7天", days: 7 },
  { value: "30d", label: "近30天", days: 30 },
  { value: "90d", label: "近90天", days: 90 }
];

function sortRows(rows: AdminStudentRow[], sortMode: ReviewSortMode): AdminStudentRow[] {
  return [...rows].sort((left, right) => {
    if (sortMode === "issue-desc") {
      return right.issueCount - left.issueCount || (right.createdAt ?? 0) - (left.createdAt ?? 0);
    }

    if (sortMode === "issue-asc") {
      return left.issueCount - right.issueCount || (right.createdAt ?? 0) - (left.createdAt ?? 0);
    }

    if (sortMode === "score-desc") {
      return right.score - left.score || (right.createdAt ?? 0) - (left.createdAt ?? 0);
    }

    return (right.createdAt ?? 0) - (left.createdAt ?? 0);
  });
}

function getTimeRangeStart(timeRange: TimeRangeFilter): number | null {
  const option = timeRangeOptions.find((item) => item.value === timeRange);

  if (!option?.days) {
    return null;
  }

  return Date.now() - option.days * 24 * 60 * 60 * 1000;
}

function filterRows(
  rows: AdminStudentRow[],
  statusFilter: ReviewStatusFilter,
  classFilter: string,
  timeRange: TimeRangeFilter,
  keyword: string
): AdminStudentRow[] {
  const keywordValue = keyword.trim().toLowerCase();
  const timeStart = getTimeRangeStart(timeRange);

  return rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) {
      return false;
    }

    if (classFilter !== "all" && row.className !== classFilter) {
      return false;
    }

    if (timeStart !== null && (!row.createdAt || row.createdAt < timeStart)) {
      return false;
    }

    if (keywordValue) {
      const searchText = `${row.name} ${row.id} ${row.className}`.toLowerCase();
      if (!searchText.includes(keywordValue)) {
        return false;
      }
    }

    return true;
  });
}

function buildRows(
  userId: string,
  totalScore: number,
  materialCount: number,
  issueCount: number,
  submissions: SubmissionRecord[]
): AdminStudentRow[] {
  if (submissions.length > 0) {
    return submissions.map((submission) => ({
      id: submission.submissionId,
      name: submission.studentName ?? submission.userId ?? userId ?? "当前学生",
      className: submission.className ?? "已提交记录",
      score: submission.totalScore,
      materialCount: submission.materialCount,
      issueCount: submission.issueCount,
      status: submission.reviewStatus,
      createdAt: submission.createdAt,
      reviewComment: submission.reviewComment,
      returnReason: submission.returnReason,
      reviewerName: submission.reviewerName,
      reviewedAt: submission.reviewedAt
    }));
  }

  const currentStatus = inferReviewStatus(issueCount, materialCount > 0);

  return [
    {
      id: userId || "student-test-001",
      name: "当前学生",
      className: "当前草稿",
      score: totalScore,
      materialCount,
      issueCount,
      status: currentStatus
    }
  ];
}

function getClassOptions(rows: AdminStudentRow[]): string[] {
  return Array.from(new Set(rows.map((row) => row.className).filter(Boolean)));
}

function formatTime(value?: number): string {
  return value ? new Date(value).toLocaleString() : "草稿未提交";
}

function getReviewNote(row: AdminStudentRow): { title: string; content: string; meta: string } | null {
  const content = row.status === "returned" ? row.returnReason ?? row.reviewComment : row.reviewComment;

  if (!content) {
    return null;
  }

  const reviewer = row.reviewerName ? `审核人 ${row.reviewerName}` : "审核人未记录";
  const reviewedAt = row.reviewedAt ? formatTime(row.reviewedAt) : "时间未记录";

  return {
    title: row.status === "returned" ? "退回原因" : "审核意见",
    content,
    meta: `${reviewer} · ${reviewedAt}`
  };
}

function renderReviewNote(row: AdminStudentRow) {
  const note = getReviewNote(row);

  if (!note) {
    return null;
  }

  return (
    <View className="evaluation-admin__review-note">
      <Text className="evaluation-admin__review-title">{note.title}</Text>
      <Text className="evaluation-admin__review-copy">{note.content}</Text>
      <Text className="evaluation-admin__review-meta">{note.meta}</Text>
    </View>
  );
}

function getDimensionRows(
  submissions: SubmissionRecord[],
  dimensionSummaries: EvaluationDimensionSummary[]
): Array<Pick<SubmissionDimensionSummary, "key" | "title" | "score" | "maxScore">> {
  const latestSubmittedSummaries = submissions[0]?.dimensionSummaries ?? [];
  return latestSubmittedSummaries.length > 0 ? latestSubmittedSummaries : dimensionSummaries;
}

function toSubmissionDimensionSummaries(
  dimensionSummaries: EvaluationDimensionSummary[],
  validationIssues: EvaluationValidationIssue[] = []
): SubmissionDimensionSummary[] {
  return dimensionSummaries.map((summary) => ({
    key: summary.key,
    title: summary.title,
    score: summary.score,
    maxScore: summary.maxScore,
    selectedCount: summary.selectedCount,
    materialCount: 0,
    issueCount: validationIssues.filter((issue) => issue.dimensionKey === summary.key).length
  }));
}

function buildDraftSubmissionRecord(
  userId: string,
  totalScore: number,
  materialCount: number,
  validationIssues: EvaluationValidationIssue[],
  dimensionSummaries: EvaluationDimensionSummary[]
): SubmissionRecord {
  const now = Date.now();
  const submissionDimensionSummaries = toSubmissionDimensionSummaries(dimensionSummaries, validationIssues);

  return {
    submissionId: userId ? `draft-${userId}` : "draft-current",
    userId: userId || "current-user",
    studentName: "当前学生",
    className: "当前草稿",
    createdAt: now,
    ruleVersion: EVALUATION_RULE_VERSION,
    totalScore,
    materialCount,
    issueCount: validationIssues.length,
    reviewStatus: inferReviewStatus(validationIssues.length, materialCount > 0),
    validationIssues,
    records: {},
    selectedItemIds: [],
    dimensionSummaries: submissionDimensionSummaries
  };
}

export default function EvaluationAdminDashboard({
  userId,
  totalScore,
  materialCount,
  validationIssues,
  dimensionSummaries,
  onShowFill,
  onShowShowcase,
  onOpenHistory
}: EvaluationAdminDashboardProps) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionSource, setSubmissionSource] = useState<"local" | "remote">("local");
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [sortMode, setSortMode] = useState<ReviewSortMode>("latest");

  const loadSubmissions = useCallback(async () => {
    if (!userId) {
      setSubmissions([]);
      setSubmissionError("");
      return;
    }

    setLoadingSubmissions(true);
    try {
      const result = await fetchSubmissionRecords(userId);
      setSubmissions(result.data);
      setSubmissionSource(result.source);
      setSubmissionError(result.error ?? "");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "提交记录读取失败");
    } finally {
      setLoadingSubmissions(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const rows = buildRows(userId, totalScore, materialCount, validationIssues.length, submissions);
  const classOptions = getClassOptions(rows);
  const visibleRows = sortRows(filterRows(rows, statusFilter, classFilter, timeRange, keyword), sortMode);
  const dimensionRows = getDimensionRows(submissions, dimensionSummaries);
  const stats = buildReviewStatsSummary(rows, submissions, toSubmissionDimensionSummaries(dimensionSummaries, validationIssues));
  const sourceText = submissions.length > 0 ? (submissionSource === "remote" ? "远端提交" : "本地提交") : "当前草稿";

  const handleExportVisibleRows = async () => {
    const visibleRowIds = new Set(visibleRows.map((row) => row.id));
    const exportRecords = submissions.length > 0
      ? submissions.filter((submission) => visibleRowIds.has(submission.submissionId))
      : [buildDraftSubmissionRecord(userId, totalScore, materialCount, validationIssues, dimensionSummaries)];

    if (exportRecords.length === 0) {
      await Taro.showToast({ title: "无可导出记录", icon: "none" });
      return;
    }

    const fileName = buildSubmissionCsvFileName("evaluation-submissions");
    const result = await exportTextFile(fileName, buildSubmissionCsv(exportRecords));
    await Taro.showToast({
      title: result.method === "download" ? "CSV 已导出" : "CSV 已复制",
      icon: "success"
    });
  };

  return (
    <View className="evaluation-admin">
      <View className="evaluation-admin__hero">
        <View className="evaluation-admin__copy">
          <Text className="evaluation-admin__eyebrow">前端审核后台</Text>
          <Text className="evaluation-admin__title">班级填报管理</Text>
          <Text className="evaluation-admin__sub">集中查看提交状态、缺项和五维分布，优先读取正式提交记录。</Text>
        </View>
        <View className="evaluation-admin__hero-actions">
          <Button className="evaluation-admin__ghost" onClick={onShowFill}>
            去填报
          </Button>
          <Button className="evaluation-admin__primary" onClick={onShowShowcase}>
            看展示
          </Button>
        </View>
      </View>

      <View className="evaluation-admin__metrics">
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{stats.submissionRate}%</Text>
          <Text className="evaluation-admin__metric-label">班级提交率</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{stats.pendingCount}</Text>
          <Text className="evaluation-admin__metric-label">待处理</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{stats.returnedCount}</Text>
          <Text className="evaluation-admin__metric-label">退回补充</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{stats.averageScore}</Text>
          <Text className="evaluation-admin__metric-label">平均预估分</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{stats.materialCompletionRate}%</Text>
          <Text className="evaluation-admin__metric-label">材料完成度</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{stats.highRiskDimension?.title ?? "暂无"}</Text>
          <Text className="evaluation-admin__metric-label">
            {stats.highRiskDimension
              ? `风险维度 · ${stats.highRiskDimension.issueCount} 项问题`
              : "风险维度"}
          </Text>
        </View>
      </View>

      <View className="evaluation-admin__grid">
        <View className="evaluation-admin__panel evaluation-admin__panel--wide">
          <View className="evaluation-admin__panel-head">
            <View>
              <Text className="evaluation-admin__panel-title">审核记录列表</Text>
              <Text className="evaluation-admin__panel-meta">
                {sourceText} · {loadingSubmissions ? "刷新中" : `${visibleRows.length} / ${rows.length} 条`}
              </Text>
            </View>
            <View className="evaluation-admin__panel-actions">
              <Button className="evaluation-admin__text-button" onClick={loadSubmissions}>
                刷新
              </Button>
              <Button className="evaluation-admin__text-button" onClick={handleExportVisibleRows}>
                导出CSV
              </Button>
              <Button className="evaluation-admin__text-button" onClick={onOpenHistory}>
                提交记录
              </Button>
            </View>
          </View>
          <View className="evaluation-admin__filters">
            <View className="evaluation-admin__filter-group evaluation-admin__filter-group--search">
              <Text className="evaluation-admin__filter-label">学生</Text>
              <Input
                className="evaluation-admin__search"
                placeholder="姓名 / 学号"
                value={keyword}
                onInput={(event) => {
                  setKeyword(event.detail.value);
                }}
              />
            </View>
            <View className="evaluation-admin__filter-group">
              <Text className="evaluation-admin__filter-label">状态</Text>
              <View className="evaluation-admin__filter-options">
                {statusFilterOptions.map((option) => (
                  <Button
                    className={`evaluation-admin__filter ${
                      statusFilter === option.value ? "evaluation-admin__filter--active" : ""
                    }`}
                    key={option.value}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
            </View>
            <View className="evaluation-admin__filter-group">
              <Text className="evaluation-admin__filter-label">班级</Text>
              <View className="evaluation-admin__filter-options">
                <Button
                  className={`evaluation-admin__filter ${
                    classFilter === "all" ? "evaluation-admin__filter--active" : ""
                  }`}
                  onClick={() => setClassFilter("all")}
                >
                  全部班级
                </Button>
                {classOptions.map((className) => (
                  <Button
                    className={`evaluation-admin__filter ${
                      classFilter === className ? "evaluation-admin__filter--active" : ""
                    }`}
                    key={className}
                    onClick={() => setClassFilter(className)}
                  >
                    {className}
                  </Button>
                ))}
              </View>
            </View>
            <View className="evaluation-admin__filter-group">
              <Text className="evaluation-admin__filter-label">提交时间</Text>
              <View className="evaluation-admin__filter-options">
                {timeRangeOptions.map((option) => (
                  <Button
                    className={`evaluation-admin__filter ${
                      timeRange === option.value ? "evaluation-admin__filter--active" : ""
                    }`}
                    key={option.value}
                    onClick={() => setTimeRange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
            </View>
            <View className="evaluation-admin__filter-group">
              <Text className="evaluation-admin__filter-label">排序</Text>
              <View className="evaluation-admin__filter-options">
                {sortOptions.map((option) => (
                  <Button
                    className={`evaluation-admin__filter ${
                      sortMode === option.value ? "evaluation-admin__filter--active" : ""
                    }`}
                    key={option.value}
                    onClick={() => setSortMode(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
            </View>
          </View>
          {submissionError ? <Text className="evaluation-admin__warning">{submissionError}</Text> : null}
          <View className="evaluation-admin__table">
            {visibleRows.length === 0 ? (
              <Text className="evaluation-admin__empty">没有符合当前状态筛选的审核记录。</Text>
            ) : null}
            {visibleRows.map((row) => (
              <View className="evaluation-admin__row" key={row.id}>
                <View className="evaluation-admin__student">
                  <Text className="evaluation-admin__student-name">{row.name}</Text>
                  <Text className="evaluation-admin__student-meta">
                    {row.id} · {row.className} · {formatTime(row.createdAt)}
                  </Text>
                  {renderReviewNote(row)}
                </View>
                <Text className="evaluation-admin__score">{row.score}</Text>
                <Text className="evaluation-admin__materials">
                  {row.materialCount} 条材料 · {row.issueCount} 项问题
                </Text>
                <Text className={`evaluation-admin__status evaluation-admin__status--${row.status}`}>
                  {getReviewStatusText(row.status)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="evaluation-admin__panel">
          <Text className="evaluation-admin__panel-title">问题队列</Text>
          {validationIssues.length === 0 ? (
            <Text className="evaluation-admin__empty">当前学生没有待补项。</Text>
          ) : (
            validationIssues.slice(0, 5).map((issue, index) => (
              <View className="evaluation-admin__issue" key={`${issue.message}-${index}`}>
                <Text className="evaluation-admin__issue-title">{issue.itemTitle}</Text>
                <Text className="evaluation-admin__issue-copy">{issue.message}</Text>
              </View>
            ))
          )}
        </View>

        <View className="evaluation-admin__panel">
          <Text className="evaluation-admin__panel-title">五维分布</Text>
          {stats.dimensionStats.map((summary) => {
            const level = Math.min(10, Math.max(0, Math.round(summary.scoreRate / 10)));

            return (
              <View className="evaluation-admin__dimension" key={summary.key}>
                <View className="evaluation-admin__dimension-head">
                  <Text>{summary.title}</Text>
                  <Text>{summary.averageScore}/{summary.maxScore}</Text>
                </View>
                <Text className="evaluation-admin__dimension-meta">
                  缺口 {summary.scoreGap} 分 · 材料 {summary.materialCount} 条 · 问题 {summary.issueCount} 项
                </Text>
                <View className="evaluation-admin__bar">
                  <View className={`evaluation-admin__bar-fill evaluation-admin__bar-fill--${level}`} />
                </View>
              </View>
            );
          })}
          {stats.dimensionStats.length === 0 && dimensionRows.length === 0 ? (
            <Text className="evaluation-admin__empty">暂无维度统计。</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
