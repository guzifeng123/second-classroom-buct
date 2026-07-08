import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";

interface EvaluationOverviewProps {
  materialCount: number;
  missingRequiredCount: number;
}

export default function EvaluationOverview({
  materialCount,
  missingRequiredCount
}: EvaluationOverviewProps) {
  return (
    <View className="evaluation-sidebar__block">
      <Text className="evaluation-sidebar__eyebrow">概览</Text>
      <View className="evaluation-metrics">
        <View className="evaluation-metric">
          <Text className="evaluation-metric__value">{materialCount}</Text>
          <Text className="evaluation-metric__label">已填材料</Text>
        </View>
        <View className="evaluation-metric">
          <Text className="evaluation-metric__value">{missingRequiredCount}</Text>
          <Text className="evaluation-metric__label">待补文字</Text>
        </View>
      </View>
      <Button
        className="evaluation-overview__issue-button"
        onClick={() => Taro.navigateTo({ url: "/pages/evaluation/preview/index" })}
      >
        查看问题清单
      </Button>
    </View>
  );
}
