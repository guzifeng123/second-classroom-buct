import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { EmptyState, FeedbackButton, StatusBanner } from "../../../components/ui";
import { fetchSubmissionRecords } from "../../../services/submissionService";
import { useUserStore } from "../../../stores/useUserStore";
import type { SubmissionRecord } from "../../../types/submission";
import { getReviewStatusText } from "../../../utils/reviewStatus";
import "./index.scss";

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

function getReviewMessage(record: SubmissionRecord): string {
  if (record.reviewStatus === "returned") {
    return record.returnReason ?? record.reviewComment ?? "审核退回，请根据问题队列补充材料。";
  }

  return record.reviewComment ?? "";
}

export default function SubmissionHistoryPage() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "remote">("local");
  const [error, setError] = useState("");
  const latestReturnedRecord = records.find((record) => record.reviewStatus === "returned");

  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await fetchSubmissionRecords(userId);
      setRecords(result.data);
      setSource(result.source);
      setError(result.error ?? "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "提交记录读取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      void loadRecords();
    }
  }, [isLoggedIn, userId]);

  if (!isLoggedIn) {
    return (
      <View className="page-shell submission-history submission-history--gate">
        <Text className="submission-history__gate-title">未登录</Text>
        <Button
          className="submission-history__gate-button"
          onClick={() => Taro.redirectTo({ url: "/pages/login/index" })}
        >
          返回登录
        </Button>
      </View>
    );
  }

  return (
    <View className="page-shell submission-history">
      <View className="submission-history__hero">
        <View className="submission-history__hero-copy">
          <Text className="submission-history__label">提交记录</Text>
          <Text className="submission-history__title">{userId}</Text>
          <Text className="submission-history__sub">查看已提交材料的编号、时间和分数摘要。</Text>
        </View>
        <Button className="submission-history__back" onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}>
          评定页
        </Button>
      </View>

      <View className="submission-history__status">
        <Text>{source === "remote" ? "远端记录" : "本地记录"}</Text>
        <Text>{records.length} 条</Text>
        <FeedbackButton className="submission-history__refresh" loadingText="刷新中" onClick={loadRecords}>
          刷新
        </FeedbackButton>
      </View>

      {error ? <StatusBanner tone="danger" title="提交记录同步失败" description={error} /> : null}
      {latestReturnedRecord ? (
        <StatusBanner
          tone="warning"
          title="有材料被退回补充"
          description={getReviewMessage(latestReturnedRecord)}
          action={
            <FeedbackButton
              className="submission-history__supplement"
              loadingText="打开中"
              onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}
            >
              去补充
            </FeedbackButton>
          }
        />
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          title={loading ? "正在读取提交记录" : "还没有提交记录"}
          description="完成一次正式提交后，这里会保留编号和摘要。"
          action={
            <FeedbackButton
              className="submission-history__empty-button"
              loadingText="返回中"
              onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}
            >
              返回评定
            </FeedbackButton>
          }
        />
      ) : (
        <View className="submission-history__list">
          {records.map((record) => (
            <View className="submission-history__card" key={record.submissionId}>
              <Text className="submission-history__card-title">{record.submissionId}</Text>
              <Text className="submission-history__card-meta">{formatTime(record.createdAt)}</Text>
              <Text className={`submission-history__status-badge submission-history__status-badge--${record.reviewStatus}`}>
                {getReviewStatusText(record.reviewStatus)}
              </Text>
              <View className="submission-history__metrics">
                <Text>{record.totalScore} 分</Text>
                <Text>{record.materialCount} 条材料</Text>
                <Text>{record.issueCount} 项问题</Text>
              </View>
              {getReviewMessage(record) ? (
                <View className="submission-history__review">
                  <Text className="submission-history__review-title">
                    {record.reviewStatus === "returned" ? "退回原因" : "审核意见"}
                  </Text>
                  <Text className="submission-history__review-copy">{getReviewMessage(record)}</Text>
                  <Text className="submission-history__review-meta">
                    {record.reviewerName ? `审核人 ${record.reviewerName}` : "审核人未记录"}
                    {record.reviewedAt ? ` · ${formatTime(record.reviewedAt)}` : " · 时间未记录"}
                  </Text>
                </View>
              ) : null}
              <Button
                className="submission-history__card-button"
                onClick={() =>
                  Taro.redirectTo({
                    url: `/pages/submission/result/index?submissionId=${encodeURIComponent(record.submissionId)}`
                  })
                }
              >
                查看结果
              </Button>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
