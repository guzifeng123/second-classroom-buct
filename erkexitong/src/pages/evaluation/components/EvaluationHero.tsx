import { Text, View } from "@tarojs/components";
import { FeedbackButton } from "../../../components/ui";

interface EvaluationHeroProps {
  userId: string;
  totalScore: number;
  onSave: () => Promise<unknown> | unknown;
  onPreview: () => Promise<unknown> | unknown;
  onSubmit: () => Promise<unknown> | unknown;
}

export default function EvaluationHero({ userId, totalScore, onSave, onPreview, onSubmit }: EvaluationHeroProps) {
  return (
    <View className="evaluation-hero">
      <View className="evaluation-top__save-wrap">
        <FeedbackButton
          className="evaluation-top__action evaluation-top__action--save"
          loadingText="保存中"
          successText="已保存"
          onClick={onSave}
        >
          暂存
        </FeedbackButton>
        <FeedbackButton
          className="evaluation-top__action evaluation-top__action--preview"
          loadingText="保存中"
          onClick={onPreview}
        >
          预览
        </FeedbackButton>
        <FeedbackButton
          className="evaluation-top__action evaluation-top__action--submit"
          loadingText="提交中"
          onClick={onSubmit}
        >
          提交
        </FeedbackButton>
      </View>
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
