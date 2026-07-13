import { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { EmptyState, FeedbackButton } from "../../../components/ui";
import { evaluationConfig } from "../../../data/evaluationConfig";
import { persistNoteSnapshotPreview } from "../../../services/noteSnapshotService";
import { getSubmissionRecord } from "../../../services/submissionService";
import type { NoteReference } from "../../../types/evaluation";
import type { SubmissionRecord } from "../../../types/submission";
import { openDetailRouteOnce } from "../../../utils/detailNavigation";
import { hasRecordMaterial, makeRecordKey } from "../../../utils/evaluationScoring";
import "./index.scss";

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

async function openNoteSnapshot(reference: NoteReference) {
  await openDetailRouteOnce(await persistNoteSnapshotPreview(reference));
}

function getSelectedOptionLabel(itemId: string, selectedOption?: string): string {
  for (const dimension of evaluationConfig) {
    for (const section of dimension.sections) {
      const item = section.items.find((candidate) => candidate.id === itemId);
      const option = item?.options?.find((candidate) => candidate.value === selectedOption);
      if (option) {
        return option.label;
      }
    }
  }

  return selectedOption ?? "";
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
              <Text>评分规则：{record.ruleVersion}</Text>
            </View>
            <View className="submission-result__issues">
              <Text className="submission-result__section-title">校验结果</Text>
              {record.validationIssues.length > 0 ? (
                record.validationIssues.slice(0, 6).map((issue, index) => (
                  <Text className="submission-result__issue" key={`${issue.message}-${index}`}>
                    {issue.message}
                  </Text>
                ))
              ) : (
                <Text className="submission-result__issue submission-result__issue--ok">提交时未发现待完善问题</Text>
              )}
              {record.validationIssues.length > 6 ? (
                <Text className="submission-result__issue-more">
                  还有 {record.validationIssues.length - 6} 项问题
                </Text>
              ) : null}
            </View>
            <View className="submission-result__dimensions">
              {record.dimensionSummaries.map((summary) => (
                <View className="submission-result__dimension" key={summary.key}>
                  <Text className="submission-result__dimension-title">{summary.title}</Text>
                  <Text className="submission-result__dimension-score">
                    {summary.score}/{summary.maxScore}
                  </Text>
                  <Text className="submission-result__dimension-meta">
                    已选 {summary.selectedCount} 项 · 材料 {summary.materialCount} 条 · 问题 {summary.issueCount} 项
                  </Text>
                </View>
              ))}
            </View>
            <View className="submission-result__snapshot">
              <Text className="submission-result__section-title">提交材料快照</Text>
              {evaluationConfig.map((dimension) => {
                const dimensionItems = dimension.sections.flatMap((section) =>
                  section.items
                    .map((item) => {
                      const itemRecords = record.records[makeRecordKey(dimension.key, item.id)] ?? [];
                      const visibleRecords = itemRecords.filter(hasRecordMaterial);

                      return {
                        item,
                        records: visibleRecords
                      };
                    })
                    .filter((item) => item.records.length > 0)
                );

                if (dimensionItems.length === 0) {
                  return null;
                }

                return (
                  <View className="submission-result__snapshot-dimension" key={dimension.key}>
                    <Text className="submission-result__snapshot-dimension-title">{dimension.title}</Text>
                    {dimensionItems.map(({ item, records }) => (
                      <View className="submission-result__snapshot-item" key={item.id}>
                        <Text className="submission-result__snapshot-item-title">{item.title}</Text>
                        {records.map((itemRecord, index) => (
                          <View className="submission-result__snapshot-record" key={itemRecord.id}>
                            <Text className="submission-result__snapshot-record-title">记录 {index + 1}</Text>
                            <Text className="submission-result__snapshot-copy">
                              {itemRecord.text || "未填写文字说明"}
                            </Text>
                            <Text className="submission-result__snapshot-meta">
                              图片 {itemRecord.images.length} 张
                              {(itemRecord.noteReferences?.length ?? 0) > 0
                                ? ` · 图文 ${itemRecord.noteReferences?.length ?? 0} 篇`
                                : ""}
                              {itemRecord.numericValue !== undefined ? ` · 数值 ${itemRecord.numericValue}` : ""}
                              {itemRecord.selectedOption
                                ? ` · 选项 ${getSelectedOptionLabel(item.id, itemRecord.selectedOption)}`
                                : ""}
                            </Text>
                            {itemRecord.noteReferences && itemRecord.noteReferences.length > 0 ? (
                              <View className="submission-result__snapshot-notes">
                                {itemRecord.noteReferences.map((reference) => (
                                  <Button
                                    className="submission-result__snapshot-note"
                                    key={reference.noteId}
                                    onClick={() => void openNoteSnapshot(reference)}
                                  >
                                    《{reference.title}》 · {reference.imageCount} 张图片 · 查看快照
                                  </Button>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })}
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
