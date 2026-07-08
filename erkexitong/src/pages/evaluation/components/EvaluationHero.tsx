import { Text, View } from "@tarojs/components";

interface EvaluationHeroProps {
  userId: string;
  totalScore: number;
}

export default function EvaluationHero({ userId, totalScore }: EvaluationHeroProps) {
  return (
    <View className="evaluation-hero">
      <View className="evaluation-hero__copy">
        <Text className="evaluation-top__label">综合素质评价平台</Text>
        <Text className="evaluation-top__user">{userId}</Text>
        <Text className="evaluation-top__sub">材料填写、计分预估与跨端接续集中处理</Text>
      </View>
      <View className="evaluation-top__score">
        <Text className="evaluation-top__score-number">{totalScore}</Text>
        <Text className="evaluation-top__score-label">/600</Text>
      </View>
    </View>
  );
}
