import { useCallback, useEffect, useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import { fetchSubmissionRecords } from "../../../services/submissionService";
import type { EvaluationValidationIssue } from "../../../types/evaluation";
import type { SubmissionDimensionSummary, SubmissionRecord } from "../../../types/submission";
import type { EvaluationDimensionSummary } from "../hooks/useEvaluationPageData";

export interface AdminStudentRow {
  id: string;
  name: string;
  className: string;
  score: number;
  materialCount: number;
  issueCount: number;
  status: "ready" | "reviewing" | "needs-work" | "draft";
  createdAt?: number;
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

function getStatusText(status: AdminStudentRow["status"]): string {
  if (status === "ready") {
    return "待审核";
  }

  if (status === "reviewing") {
    return "审核中";
  }

  if (status === "draft") {
    return "未提交";
  }

  return "需补充";
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
      name: submission.userId || userId || "当前学生",
      className: "已提交记录",
      score: submission.totalScore,
      materialCount: submission.materialCount,
      issueCount: submission.issueCount,
      status: submission.issueCount > 0 ? "needs-work" : "ready",
      createdAt: submission.createdAt
    }));
  }

  const currentStatus: AdminStudentRow["status"] =
    materialCount === 0 ? "draft" : issueCount > 0 ? "needs-work" : "ready";

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

function formatTime(value?: number): string {
  return value ? new Date(value).toLocaleString() : "草稿未提交";
}

function getDimensionRows(
  submissions: SubmissionRecord[],
  dimensionSummaries: EvaluationDimensionSummary[]
): Array<Pick<SubmissionDimensionSummary, "key" | "title" | "score" | "maxScore">> {
  const latestSubmittedSummaries = submissions[0]?.dimensionSummaries ?? [];
  return latestSubmittedSummaries.length > 0 ? latestSubmittedSummaries : dimensionSummaries;
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
  const dimensionRows = getDimensionRows(submissions, dimensionSummaries);
  const readyCount = rows.filter((row) => row.status === "ready").length;
  const needsWorkCount = rows.filter((row) => row.status === "needs-work").length;
  const averageScore = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
  const sourceText = submissions.length > 0 ? (submissionSource === "remote" ? "远端提交" : "本地提交") : "当前草稿";

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
          <Text className="evaluation-admin__metric-value">{rows.length}</Text>
          <Text className="evaluation-admin__metric-label">审核记录</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{readyCount}</Text>
          <Text className="evaluation-admin__metric-label">待审核</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{needsWorkCount}</Text>
          <Text className="evaluation-admin__metric-label">需补充</Text>
        </View>
        <View className="evaluation-admin__metric">
          <Text className="evaluation-admin__metric-value">{averageScore}</Text>
          <Text className="evaluation-admin__metric-label">平均预估分</Text>
        </View>
      </View>

      <View className="evaluation-admin__grid">
        <View className="evaluation-admin__panel evaluation-admin__panel--wide">
          <View className="evaluation-admin__panel-head">
            <View>
              <Text className="evaluation-admin__panel-title">审核记录列表</Text>
              <Text className="evaluation-admin__panel-meta">
                {sourceText} · {loadingSubmissions ? "刷新中" : `${rows.length} 条`}
              </Text>
            </View>
            <View className="evaluation-admin__panel-actions">
              <Button className="evaluation-admin__text-button" onClick={loadSubmissions}>
                刷新
              </Button>
              <Button className="evaluation-admin__text-button" onClick={onOpenHistory}>
                提交记录
              </Button>
            </View>
          </View>
          {submissionError ? <Text className="evaluation-admin__warning">{submissionError}</Text> : null}
          <View className="evaluation-admin__table">
            {rows.map((row) => (
              <View className="evaluation-admin__row" key={row.id}>
                <View className="evaluation-admin__student">
                  <Text className="evaluation-admin__student-name">{row.name}</Text>
                  <Text className="evaluation-admin__student-meta">
                    {row.id} · {row.className} · {formatTime(row.createdAt)}
                  </Text>
                </View>
                <Text className="evaluation-admin__score">{row.score}</Text>
                <Text className="evaluation-admin__materials">
                  {row.materialCount} 条材料 · {row.issueCount} 项问题
                </Text>
                <Text className={`evaluation-admin__status evaluation-admin__status--${row.status}`}>
                  {getStatusText(row.status)}
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
          {dimensionRows.map((summary) => {
            const percent = Math.round((summary.score / summary.maxScore) * 100);
            const level = Math.min(10, Math.max(0, Math.round(percent / 10)));

            return (
              <View className="evaluation-admin__dimension" key={summary.key}>
                <View className="evaluation-admin__dimension-head">
                  <Text>{summary.title}</Text>
                  <Text>{summary.score}/{summary.maxScore}</Text>
                </View>
                <View className="evaluation-admin__bar">
                  <View className={`evaluation-admin__bar-fill evaluation-admin__bar-fill--${level}`} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
