import { useEffect } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { FeedbackButton } from "../../../components/ui";
import { evaluationConfig } from "../../../data/evaluationConfig";
import { hasRecordMaterial, makeRecordKey, useEvaluationStore } from "../../../stores/useEvaluationStore";
import { useUserStore } from "../../../stores/useUserStore";
import { buildDimensionSummaries, countMaterials } from "../../../utils/evaluationSummary";
import "./index.scss";

export default function EvaluationPreviewPage() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const userId = useUserStore((state) => state.userId);
  const records = useEvaluationStore((state) => state.records);
  const selectedItemIds = useEvaluationStore((state) => state.selectedItemIds);
  const hydrated = useEvaluationStore((state) => state.hydrated);
  const hydrateDraft = useEvaluationStore((state) => state.hydrateDraft);
  const getValidationIssues = useEvaluationStore((state) => state.getValidationIssues);
  const issues = getValidationIssues();
  const summaries = buildDimensionSummaries(records, selectedItemIds, issues);
  const totalScore = summaries.reduce((sum, item) => sum + item.score, 0);
  const materialCount = countMaterials(records);

  useEffect(() => {
    if (isLoggedIn && !hydrated) {
      void hydrateDraft(userId);
    }
  }, [hydrated, hydrateDraft, isLoggedIn, userId]);

  const handleSubmit = async () => {
    await Taro.redirectTo({
      url: "/pages/evaluation/index?submit=1"
    });
  };

  if (!isLoggedIn) {
    return (
      <View className="page-shell evaluation-preview evaluation-preview--gate">
        <Text className="evaluation-preview__gate-title">未登录</Text>
        <Button
          className="evaluation-preview__gate-button"
          onClick={() => Taro.redirectTo({ url: "/pages/login/index" })}
        >
          返回登录
        </Button>
      </View>
    );
  }

  return (
    <View className="page-shell evaluation-preview">
      <View className="evaluation-preview__hero">
        <View>
          <Text className="evaluation-preview__label">提交前预览</Text>
          <Text className="evaluation-preview__title">{userId}</Text>
          <Text className="evaluation-preview__sub">核对分数、材料数量和缺项，再返回修改或提交。</Text>
        </View>
        <View className="evaluation-preview__score">
          <Text className="evaluation-preview__score-number">{totalScore}</Text>
          <Text className="evaluation-preview__score-label">/600</Text>
        </View>
      </View>

      <View className="evaluation-preview__stats">
        <View className="evaluation-preview__stat">
          <Text className="evaluation-preview__stat-value">{materialCount}</Text>
          <Text className="evaluation-preview__stat-label">材料记录</Text>
        </View>
        <View className="evaluation-preview__stat">
          <Text className="evaluation-preview__stat-value">{selectedItemIds.length}</Text>
          <Text className="evaluation-preview__stat-label">已选项目</Text>
        </View>
        <View className="evaluation-preview__stat">
          <Text className="evaluation-preview__stat-value">{issues.length}</Text>
          <Text className="evaluation-preview__stat-label">待完善</Text>
        </View>
      </View>

      {issues.length > 0 ? (
        <View className="evaluation-preview__issues">
          <Text className="evaluation-preview__section-title">待完善问题</Text>
          {issues.slice(0, 8).map((issue, index) => (
            <Text className="evaluation-preview__issue" key={`${issue.message}-${index}`}>
              {issue.message}
            </Text>
          ))}
          {issues.length > 8 ? <Text className="evaluation-preview__issue-more">还有 {issues.length - 8} 项</Text> : null}
        </View>
      ) : null}

      <ScrollView className="evaluation-preview__scroll" scrollY>
        <View className="evaluation-preview__summaries">
          {summaries.map((summary) => (
            <View className="evaluation-preview__summary" key={summary.key}>
              <View className="evaluation-preview__summary-head">
                <Text className="evaluation-preview__summary-title">{summary.title}</Text>
                <Text className="evaluation-preview__summary-score">
                  {summary.score}/{summary.maxScore}
                </Text>
              </View>
              <Text className="evaluation-preview__summary-meta">
                已选 {summary.selectedCount} 项 · 材料 {summary.materialCount} 条 · 问题 {summary.issueCount} 项
              </Text>
            </View>
          ))}
        </View>

        <View className="evaluation-preview__detail">
          <Text className="evaluation-preview__section-title">材料明细</Text>
          {evaluationConfig.map((dimension) => (
            <View className="evaluation-preview__dimension" key={dimension.key}>
              <Text className="evaluation-preview__dimension-title">{dimension.title}</Text>
              {dimension.sections.map((section) =>
                section.items.map((item) => {
                  const key = makeRecordKey(dimension.key, item.id);
                  const itemRecords = records[key] ?? [];
                  const visibleRecords = itemRecords.filter(hasRecordMaterial);

                  if (visibleRecords.length === 0) {
                    return null;
                  }

                  return (
                    <View className="evaluation-preview__item" key={item.id}>
                      <Text className="evaluation-preview__item-title">{item.title}</Text>
                      {visibleRecords.map((record, index) => (
                        <View className="evaluation-preview__record" key={record.id}>
                          <Text className="evaluation-preview__record-title">记录 {index + 1}</Text>
                          <Text className="evaluation-preview__record-copy">{record.text || "未填写文字说明"}</Text>
                          <Text className="evaluation-preview__record-meta">
                            图片 {record.images.length} 张
                            {record.numericValue !== undefined ? ` · 数值 ${record.numericValue}` : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </View>
          ))}
        </View>
        <View className="evaluation-preview__bottom-space" />
      </ScrollView>

      <View className="evaluation-preview__actions">
        <FeedbackButton
          className="evaluation-preview__ghost"
          loadingText="返回中"
          onClick={() => Taro.redirectTo({ url: "/pages/evaluation/index" })}
        >
          返回修改
        </FeedbackButton>
        <FeedbackButton
          className="evaluation-preview__primary"
          disabled={issues.length > 0}
          disabledReason={issues.length > 0 ? `还有 ${issues.length} 项待完善` : undefined}
          loadingText="提交中"
          onClick={handleSubmit}
        >
          确认提交
        </FeedbackButton>
      </View>
    </View>
  );
}
