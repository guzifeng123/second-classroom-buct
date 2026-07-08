import { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { EmptyState, FeedbackButton } from "../../../components/ui";
import { getSubmissionRecord } from "../../../services/submissionService";
import type { SubmissionRecord } from "../../../types/submission";
import { openDetailRouteOnce } from "../../../utils/detailNavigation";
import "./index.scss";

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

export default function SubmissionResultPage() {
  const router = useRouter();
  const submissionId = router.params.submissionId ?? "";
  const [record, setRecord] = useState<SubmissionRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadRecord = async () => {
      setRecord(submissionId ? await getSubmissionRecord(submissionId) : null);
      setLoaded(true);
    };

    void loadRecord();
  }, [submissionId]);

  return (
    <View className="page-shell submission-result">
      <View className="submission-result__hero">
        <Text className="submission-result__label">提交结果</Text>
        <Text className="submission-result__title">材料已提交</Text>
        <Text className="submission-result__sub">{submissionId ? `提交编号 ${submissionId}` : "提交编号待返回"}</Text>
      </View>

      <View className="submission-result__panel">
        {!loaded ? <Text className="submission-result__muted">正在读取提交摘要</Text> : null}
        {loaded && !record ? (
          <EmptyState title="没有找到本地提交摘要" description="可返回评定页继续查看当前草稿和分数。" />
        ) : null}
        {record ? (
          <>
            <View className="submission-result__metrics">
              <View className="submission-result__metric">
                <Text className="submission-result__metric-value">{record.totalScore}</Text>
                <Text className="submission-result__metric-label">预估总分</Text>
              </View>
              <View className="submission-result__metric">
                <Text className="submission-result__metric-value">{record.materialCount}</Text>
                <Text className="submission-result__metric-label">材料记录</Text>
              </View>
              <View className="submission-result__metric">
                <Text className="submission-result__metric-value">{record.issueCount}</Text>
                <Text className="submission-result__metric-label">提交问题</Text>
              </View>
            </View>
            <View className="submission-result__meta">
              <Text>提交人：{record.userId}</Text>
              <Text>提交时间：{formatTime(record.createdAt)}</Text>
            </View>
            <View className="submission-result__dimensions">
              {record.dimensionSummaries.map((summary) => (
                <View className="submission-result__dimension" key={summary.key}>
                  <Text className="submission-result__dimension-title">{summary.title}</Text>
                  <Text className="submission-result__dimension-score">
                    {summary.score}/{summary.maxScore}
                  </Text>
                  <Text className="submission-result__dimension-meta">
                    已选 {summary.selectedCount} 项 · 材料 {summary.materialCount} 条
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View className="submission-result__actions">
        <FeedbackButton
          className="submission-result__ghost"
          loadingText="返回中"
          onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}
        >
          返回评定
        </FeedbackButton>
        <FeedbackButton
          className="submission-result__primary"
          loadingText="打开中"
          onClick={() => openDetailRouteOnce("/pages/submission/history/index")}
        >
          提交记录
        </FeedbackButton>
      </View>
    </View>
  );
}
