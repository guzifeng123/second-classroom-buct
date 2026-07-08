import { Button, Text, View } from "@tarojs/components";
import { evaluationConfig } from "../../../data/evaluationConfig";
import { hasRecordMaterial, makeRecordKey } from "../../../stores/useEvaluationStore";
import type { EvaluationRecordMap, EvaluationValidationIssue } from "../../../types/evaluation";
import type { EvaluationDimensionSummary } from "../hooks/useEvaluationPageData";

interface EvaluationShowcaseDashboardProps {
  userId: string;
  totalScore: number;
  materialCount: number;
  selectedItemCount: number;
  records: EvaluationRecordMap;
  validationIssues: EvaluationValidationIssue[];
  dimensionSummaries: EvaluationDimensionSummary[];
  onShowFill: () => void;
  onOpenPreview: () => void;
  onOpenHistory: () => void;
}

interface ShowcaseTimelineItem {
  id: string;
  title: string;
  dimensionTitle: string;
  text: string;
  imageCount: number;
  updatedAt: number;
}

function buildTimeline(records: EvaluationRecordMap): ShowcaseTimelineItem[] {
  const items: ShowcaseTimelineItem[] = [];

  evaluationConfig.forEach((dimension) => {
    dimension.sections.forEach((section) => {
      section.items.forEach((item) => {
        const key = makeRecordKey(dimension.key, item.id);
        (records[key] ?? []).forEach((record) => {
          if (!hasRecordMaterial(record)) {
            return;
          }

          items.push({
            id: record.id,
            title: item.title,
            dimensionTitle: dimension.title,
            text: record.text.trim() || "已填写图片或数值材料",
            imageCount: record.images.length,
            updatedAt: record.updatedAt
          });
        });
      });
    });
  });

  return items.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 6);
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString();
}

export default function EvaluationShowcaseDashboard({
  userId,
  totalScore,
  materialCount,
  selectedItemCount,
  records,
  validationIssues,
  dimensionSummaries,
  onShowFill,
  onOpenPreview,
  onOpenHistory
}: EvaluationShowcaseDashboardProps) {
  const timeline = buildTimeline(records);
  const completeCount = dimensionSummaries.filter((summary) => summary.score > 0).length;

  return (
    <View className="evaluation-showcase">
      <View className="evaluation-showcase__hero">
        <View className="evaluation-showcase__copy">
          <Text className="evaluation-showcase__eyebrow">个人成果看板</Text>
          <Text className="evaluation-showcase__title">{userId}</Text>
          <Text className="evaluation-showcase__sub">把已填材料整理成一页清晰的成果摘要。</Text>
        </View>
        <View className="evaluation-showcase__score-card">
          <Text className="evaluation-showcase__score">{totalScore}</Text>
          <Text className="evaluation-showcase__score-label">/600 预估分</Text>
        </View>
      </View>

      <View className="evaluation-showcase__actions">
        <Button className="evaluation-showcase__ghost" onClick={onShowFill}>
          返回填报
        </Button>
        <Button className="evaluation-showcase__secondary" onClick={onOpenHistory}>
          提交记录
        </Button>
        <Button className="evaluation-showcase__primary" onClick={onOpenPreview}>
          预览提交
        </Button>
      </View>

      <View className="evaluation-showcase__stats">
        <View className="evaluation-showcase__stat">
          <Text className="evaluation-showcase__stat-value">{materialCount}</Text>
          <Text className="evaluation-showcase__stat-label">材料记录</Text>
        </View>
        <View className="evaluation-showcase__stat">
          <Text className="evaluation-showcase__stat-value">{selectedItemCount}</Text>
          <Text className="evaluation-showcase__stat-label">已选项目</Text>
        </View>
        <View className="evaluation-showcase__stat">
          <Text className="evaluation-showcase__stat-value">{completeCount}</Text>
          <Text className="evaluation-showcase__stat-label">已有得分维度</Text>
        </View>
      </View>

      <View className="evaluation-showcase__layout">
        <View className="evaluation-showcase__panel">
          <Text className="evaluation-showcase__panel-title">五维进度</Text>
          {dimensionSummaries.map((summary) => {
            const percent = Math.round((summary.score / summary.maxScore) * 100);
            const level = Math.min(10, Math.max(0, Math.round(percent / 10)));

            return (
              <View className="evaluation-showcase__dimension" key={summary.key}>
                <View className="evaluation-showcase__dimension-head">
                  <Text>{summary.title}</Text>
                  <Text>{summary.score}/{summary.maxScore}</Text>
                </View>
                <View className="evaluation-showcase__bar">
                  <View className={`evaluation-showcase__bar-fill evaluation-showcase__bar-fill--${level}`} />
                </View>
              </View>
            );
          })}
        </View>

        <View className="evaluation-showcase__panel evaluation-showcase__panel--timeline">
          <Text className="evaluation-showcase__panel-title">材料时间线</Text>
          {timeline.length === 0 ? (
            <View className="evaluation-showcase__empty">
              <Text className="evaluation-showcase__empty-title">还没有可展示材料</Text>
              <Text className="evaluation-showcase__empty-copy">回到填报界面补充文字、数值或图片后，这里会自动生成时间线。</Text>
            </View>
          ) : (
            timeline.map((item) => (
              <View className="evaluation-showcase__timeline-item" key={item.id}>
                <Text className="evaluation-showcase__timeline-date">{formatDate(item.updatedAt)}</Text>
                <View className="evaluation-showcase__timeline-copy">
                  <Text className="evaluation-showcase__timeline-title">{item.title}</Text>
                  <Text className="evaluation-showcase__timeline-meta">
                    {item.dimensionTitle} · 图片 {item.imageCount} 张
                  </Text>
                  <Text className="evaluation-showcase__timeline-text">{item.text}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View className="evaluation-showcase__panel">
          <Text className="evaluation-showcase__panel-title">下一步</Text>
          {validationIssues.length === 0 ? (
            <View className="evaluation-showcase__ready">
              <Text className="evaluation-showcase__ready-title">材料已通过当前校验</Text>
              <Text className="evaluation-showcase__ready-copy">可以进入预览页做最后核对。</Text>
            </View>
          ) : (
            validationIssues.slice(0, 4).map((issue, index) => (
              <View className="evaluation-showcase__todo" key={`${issue.message}-${index}`}>
                <Text className="evaluation-showcase__todo-title">{issue.itemTitle}</Text>
                <Text className="evaluation-showcase__todo-copy">{issue.message}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
