import { Button, Text, View } from "@tarojs/components";
import type { DimensionKey } from "../../../types/evaluation";
import type { EvaluationDimensionSummary } from "../hooks/useEvaluationPageData";

interface MobileEvaluationNavigatorProps {
  dimensions: EvaluationDimensionSummary[];
  currentKey: DimensionKey;
  missingRequiredCount: number;
  pendingImageCount: number;
  onChange: (key: DimensionKey) => void;
  onSave: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isLast: boolean;
  onlyIncomplete: boolean;
  onToggleIncomplete: () => void;
}

const DIMENSION_SHORT_LABELS: Record<DimensionKey, string> = {
  moral: "德育",
  academic: "科创",
  sports: "身心",
  aesthetic: "人文",
  labor: "实践"
};

export default function MobileEvaluationNavigator({
  dimensions,
  currentKey,
  missingRequiredCount,
  pendingImageCount,
  onChange,
  onSave,
  onNext,
  onPrevious,
  isLast
  , onlyIncomplete
  , onToggleIncomplete
}: MobileEvaluationNavigatorProps) {
  const currentIndex = Math.max(0, dimensions.findIndex((dimension) => dimension.key === currentKey));
  const current = dimensions[currentIndex];
  const stepProgress = dimensions.length > 0 ? ((currentIndex + 1) / dimensions.length) * 100 : 0;

  return (
    <View className="mobile-evaluation-nav">
      <View className="mobile-evaluation-nav__heading">
        <View>
          <Text className="mobile-evaluation-nav__kicker">移动填报</Text>
          <Text className="mobile-evaluation-nav__title">{current?.title ?? "评定材料"}</Text>
        </View>
        <Text className="mobile-evaluation-nav__step">
          {currentIndex + 1}/{dimensions.length}
        </Text>
      </View>
      <View className="mobile-evaluation-nav__progress">
        <View className="mobile-evaluation-nav__progress-fill" style={{ width: `${stepProgress}%` }} />
      </View>
      <View className="mobile-evaluation-nav__meta">
        <Text>当前得分 {current?.score ?? 0}/{current?.maxScore ?? 0}</Text>
        <Text>{missingRequiredCount} 项待补 · {pendingImageCount} 张图片待上传</Text>
      </View>
      <Button className={`mobile-evaluation-nav__filter ${onlyIncomplete ? "is-active" : ""}`} onClick={onToggleIncomplete}>
        {onlyIncomplete ? "显示全部条目" : "只看未完成项"}
      </Button>
      <View className="mobile-evaluation-nav__dimensions">
        {dimensions.map((dimension, index) => (
          <Button
            key={dimension.key}
            className={`mobile-evaluation-nav__dimension ${dimension.key === currentKey ? "is-current" : ""}`}
            onClick={() => onChange(dimension.key)}
          >
            <Text>{index + 1}</Text>
            <Text>{DIMENSION_SHORT_LABELS[dimension.key]}</Text>
          </Button>
        ))}
      </View>
      <View className="mobile-evaluation-nav__actions">
        <Button className="mobile-evaluation-nav__button mobile-evaluation-nav__button--secondary" disabled={currentIndex === 0} onClick={onPrevious}>上一项</Button>
        <Button className="mobile-evaluation-nav__button mobile-evaluation-nav__button--save" onClick={onSave}>保存</Button>
        <Button className="mobile-evaluation-nav__button mobile-evaluation-nav__button--primary" onClick={onNext}>{isLast ? "查看预览" : "下一项"}</Button>
      </View>
    </View>
  );
}
