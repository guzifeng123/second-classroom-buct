import { useState } from "react";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import EvaluationPanel from "../../../components/EvaluationPanel";
import { evaluationConfig } from "../../../data/evaluationConfig";
import type { EvaluationFocusField } from "../../../types/evaluation";
import type { EvaluationValidationIssue } from "../../../types/evaluation";
import type { EvaluationDimensionSummary } from "../hooks/useEvaluationPageData";
import DimensionDropdownList from "./DimensionDropdownList";
import EvaluationOverview from "./EvaluationOverview";

interface EvaluationWorkspaceProps {
  materialCount: number;
  missingRequiredCount: number;
  selectedItemIds: string[];
  dimensionSummaries: EvaluationDimensionSummary[];
  focusDimensionKey?: string;
  focusItemId?: string;
  focusRecordId?: string;
  focusUpload?: boolean;
  focusField?: EvaluationFocusField;
  focusImageIndex?: number;
  mobileDimensionKey?: string | null;
  mobileOnly?: boolean;
  onlyIncomplete?: boolean;
  validationIssues?: EvaluationValidationIssue[];
}

export default function EvaluationWorkspace({
  materialCount,
  missingRequiredCount,
  selectedItemIds,
  dimensionSummaries,
  focusDimensionKey,
  focusItemId,
  focusRecordId,
  focusUpload = false,
  focusField,
  focusImageIndex
  , mobileDimensionKey
  , mobileOnly = false
  , onlyIncomplete = false
  , validationIssues = []
}: EvaluationWorkspaceProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const focusNodeId = focusDimensionKey && focusItemId ? `evaluation-item-${focusDimensionKey}-${focusItemId}` : "";

  return (
    <View
      className={`evaluation-workspace ${leftCollapsed ? "evaluation-workspace--left-collapsed" : ""} ${
        rightCollapsed ? "evaluation-workspace--right-collapsed" : ""
      }`}
    >
      <View className={`evaluation-sidebar ${leftCollapsed ? "evaluation-sidebar--collapsed" : ""}`}>
        <Button className="evaluation-sidebar__toggle" onClick={() => setLeftCollapsed((value) => !value)}>
          <Text className="evaluation-side-toggle__icon">{leftCollapsed ? "☰" : "‹"}</Text>
          <Text className="evaluation-side-toggle__text">目录</Text>
        </Button>
        {leftCollapsed ? null : (
          <>
            <EvaluationOverview materialCount={materialCount} missingRequiredCount={missingRequiredCount} />
            <DimensionDropdownList dimensions={dimensionSummaries} />
          </>
        )}
      </View>

      <ScrollView className="evaluation-scroll" scrollY scrollIntoView={focusNodeId}>
        <View className="evaluation-list">
          {evaluationConfig.filter((dimension) => !mobileOnly || dimension.key === mobileDimensionKey).map((dimension, index) => (
            <EvaluationPanel
              key={dimension.key}
              dimension={dimension}
              defaultExpanded={index === 0 || dimension.key === focusDimensionKey}
              selectedItemIds={selectedItemIds}
              focusItemId={dimension.key === focusDimensionKey ? focusItemId : undefined}
              focusRecordId={dimension.key === focusDimensionKey ? focusRecordId : undefined}
              focusUpload={dimension.key === focusDimensionKey ? focusUpload : false}
              focusField={dimension.key === focusDimensionKey ? focusField : undefined}
              focusImageIndex={dimension.key === focusDimensionKey ? focusImageIndex : undefined}
              onlyIncomplete={onlyIncomplete}
              incompleteItemIds={validationIssues.filter((issue) => issue.dimensionKey === dimension.key).map((issue) => issue.itemId)}
            />
          ))}
          <View className="evaluation-bottom-space" />
        </View>
      </ScrollView>

      <View className={`evaluation-inspector ${rightCollapsed ? "evaluation-inspector--collapsed" : ""}`}>
        <Button className="evaluation-inspector__toggle" onClick={() => setRightCollapsed((value) => !value)}>
          <Text className="evaluation-side-toggle__text">检查</Text>
          <Text className="evaluation-side-toggle__icon">{rightCollapsed ? "✓" : "›"}</Text>
        </Button>
        {rightCollapsed ? null : (
          <>
            <View className="evaluation-inspector__panel">
              <Text className="evaluation-inspector__eyebrow">检查区</Text>
              <Text className="evaluation-inspector__title">
                {missingRequiredCount === 0 ? "当前材料可进入预览" : `${missingRequiredCount} 项需要补充`}
              </Text>
              <Text className="evaluation-inspector__copy">
                目录负责选择项目，填写区负责材料，底部只处理保存、预览和提交。
              </Text>
            </View>
            <View className="evaluation-inspector__panel">
              <Text className="evaluation-inspector__eyebrow">维度进度</Text>
              {dimensionSummaries.map((dimension) => (
                <View className="evaluation-inspector__dimension" key={dimension.key}>
                  <Text className="evaluation-inspector__dimension-title">{dimension.title}</Text>
                  <Text className="evaluation-inspector__dimension-score">
                    {dimension.score}/{dimension.maxScore}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
