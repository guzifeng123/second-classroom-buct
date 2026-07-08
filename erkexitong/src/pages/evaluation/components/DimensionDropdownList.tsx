import { useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import { useEvaluationStore } from "../../../stores/useEvaluationStore";
import type { DimensionKey, SectionKey } from "../../../types/evaluation";
import type { EvaluationDimensionSummary } from "../hooks/useEvaluationPageData";

interface DimensionDropdownListProps {
  dimensions: EvaluationDimensionSummary[];
}

export default function DimensionDropdownList({ dimensions }: DimensionDropdownListProps) {
  const [expandedKeys, setExpandedKeys] = useState<DimensionKey[]>(() =>
    dimensions[0] ? [dimensions[0].key] : []
  );
  const toggleItemSelection = useEvaluationStore((state) => state.toggleItemSelection);

  const toggleDimension = (dimensionKey: DimensionKey) => {
    setExpandedKeys((current) =>
      current.includes(dimensionKey)
        ? current.filter((key) => key !== dimensionKey)
        : [...current, dimensionKey]
    );
  };

  const handleToggleItem = (
    dimensionKey: DimensionKey,
    sectionKey: SectionKey,
    itemId: string,
    selected: boolean
  ) => {
    toggleItemSelection(dimensionKey, sectionKey, itemId, !selected);
  };

  return (
    <View className="evaluation-sidebar__block evaluation-directory">
      <Text className="evaluation-sidebar__eyebrow">五维目录</Text>
      {dimensions.map((dimension) => {
        const expanded = expandedKeys.includes(dimension.key);

        return (
          <View className="evaluation-directory__dimension" key={dimension.key}>
            <Button
              className="evaluation-directory__trigger"
              onClick={() => toggleDimension(dimension.key)}
            >
              <View className="evaluation-directory__trigger-copy">
                <Text className="evaluation-directory__title">{dimension.title}</Text>
                <Text className="evaluation-directory__meta">
                  已选 {dimension.selectedCount}/{dimension.itemCount}
                </Text>
              </View>
              <View className="evaluation-directory__score-wrap">
                <Text className="evaluation-directory__score">
                  {dimension.score}/{dimension.maxScore}
                </Text>
                <Text className={`evaluation-directory__arrow ${expanded ? "evaluation-directory__arrow--open" : ""}`}>
                  ⌄
                </Text>
              </View>
            </Button>

            {expanded ? (
              <View className="evaluation-directory__body">
                {dimension.sections.map((section) => (
                  <View className="evaluation-directory__section" key={section.key}>
                    <Text className="evaluation-directory__section-title">{section.title}</Text>
                    {section.items.map((item) => (
                      <Button
                        className={`evaluation-directory__item ${
                          item.selected ? "evaluation-directory__item--selected" : ""
                        }`}
                        key={item.id}
                        onClick={() => handleToggleItem(dimension.key, item.sectionKey, item.id, item.selected)}
                      >
                        <Text
                          className={`evaluation-directory__check ${
                            item.selected ? "evaluation-directory__check--selected" : ""
                          }`}
                        >
                          {item.selected ? "✓" : ""}
                        </Text>
                        <View className="evaluation-directory__item-copy">
                          <Text className="evaluation-directory__item-title">{item.title}</Text>
                          <Text className="evaluation-directory__item-rule">{item.description}</Text>
                          {item.selected ? (
                            <Text className="evaluation-directory__item-feedback">已加入填写区</Text>
                          ) : null}
                        </View>
                        <Text className="evaluation-directory__item-score">
                          {item.score}/{item.maxScore}
                        </Text>
                      </Button>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
