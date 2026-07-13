import { useEffect, useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import { EmptyState } from "../ui";
import ProofItem from "../ProofItem";
import { makeRecordKey, useEvaluationStore } from "../../stores/useEvaluationStore";
import type { EvaluationDimensionConfig, EvaluationFocusField } from "../../types/evaluation";
import "./index.scss";

interface EvaluationPanelProps {
  dimension: EvaluationDimensionConfig;
  defaultExpanded?: boolean;
  selectedItemIds: string[];
  focusItemId?: string;
  focusRecordId?: string;
  focusUpload?: boolean;
  focusField?: EvaluationFocusField;
  focusImageIndex?: number;
}

export default function EvaluationPanel({
  dimension,
  defaultExpanded = false,
  selectedItemIds,
  focusItemId,
  focusRecordId,
  focusUpload = false,
  focusField,
  focusImageIndex
}: EvaluationPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const records = useEvaluationStore((state) => state.records);
  const addRecord = useEvaluationStore((state) => state.addRecord);
  const getItemScore = useEvaluationStore((state) => state.getItemScore);
  const getDimensionScore = useEvaluationStore((state) => state.getDimensionScore);
  const dimensionScore = getDimensionScore(dimension.key);
  const selectedSet = new Set(selectedItemIds);
  const selectedSections = dimension.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => selectedSet.has(makeRecordKey(dimension.key, item.id)))
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    if (focusItemId) {
      setExpanded(true);
    }
  }, [focusItemId]);

  return (
    <View className={`evaluation-panel ${expanded ? "evaluation-panel--expanded" : ""}`}>
      <View className="evaluation-panel__summary" onClick={() => setExpanded((value) => !value)}>
        <View>
          <Text className="evaluation-panel__title">{dimension.title}</Text>
          <Text className="evaluation-panel__meta">
            满分 {dimension.maxScore} · 基础 {dimension.baseMax} · 拓展 {dimension.extensionMax}
          </Text>
        </View>
        <View className="evaluation-panel__score-wrap">
          <Text className="evaluation-panel__score">{dimensionScore}</Text>
          <Text className="evaluation-panel__toggle">{expanded ? "收起" : "展开"}</Text>
        </View>
      </View>

      {expanded ? (
        <View className="evaluation-panel__body">
          {selectedSections.length === 0 ? (
            <EmptyState
              title="还没有勾选项目"
              description="先在五维目录选择符合自己的项目，选中后会立即出现在这里填写材料。"
            />
          ) : null}

          {selectedSections.map((section) => {
            const sectionScore = Math.min(
              section.maxScore,
              section.items.reduce((sum, item) => sum + getItemScore(dimension.key, item.id), 0)
            );

            return (
              <View className="evaluation-panel__section" key={section.key}>
                <View className="evaluation-panel__section-head">
                  <Text className="evaluation-panel__section-title">{section.title}</Text>
                  <Text className="evaluation-panel__section-score">
                    {sectionScore}/{section.maxScore}
                  </Text>
                </View>

                {section.items.map((item) => {
                  const key = makeRecordKey(dimension.key, item.id);
                  const itemRecords = records[key] ?? [];

                  return (
                    <View
                      className={`evaluation-panel__item ${
                        focusItemId === item.id ? "evaluation-panel__item--focused" : ""
                      }`}
                      id={`evaluation-item-${dimension.key}-${item.id}`}
                      key={item.id}
                    >
                      <View className="evaluation-panel__item-head">
                        <View>
                          <View className="evaluation-panel__item-title-row">
                            <Text className="evaluation-panel__item-title">{item.title}</Text>
                            <Text className="evaluation-panel__item-badge">已加入填写区</Text>
                          </View>
                          <Text className="evaluation-panel__item-rule">
                            {item.description} · 上限 {item.maxScore} 分
                          </Text>
                        </View>
                        <Text className="evaluation-panel__item-score">
                          {getItemScore(dimension.key, item.id)} 分
                        </Text>
                      </View>

                      {itemRecords.length === 0 ? (
                        <View className="evaluation-panel__empty">暂无记录</View>
                      ) : null}

                      {itemRecords.map((record, index) => (
                        <ProofItem
                          key={record.id}
                          item={item}
                          record={record}
                          recordIndex={index}
                          canRemove={item.mode === "multi"}
                          showHeader={item.mode === "multi"}
                          focused={focusRecordId === record.id}
                          focusUpload={focusUpload && focusRecordId === record.id}
                          focusField={focusRecordId === record.id ? focusField : undefined}
                          focusImageIndex={focusRecordId === record.id ? focusImageIndex : undefined}
                        />
                      ))}

                      {item.mode === "multi" ? (
                        <Button
                          className="evaluation-panel__add"
                          onClick={() => addRecord(dimension.key, section.key, item.id)}
                        >
                          添加记录
                        </Button>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
