import { Text, View } from "@tarojs/components";
import { FeedbackButton } from "../../../components/ui";

interface EvaluationActionBarProps {
  hasIncomingTransfer: boolean;
  onApplyTransfer: () => void;
}

export default function EvaluationActionBar({
  hasIncomingTransfer,
  onApplyTransfer
}: EvaluationActionBarProps) {
  if (!hasIncomingTransfer) {
    return null;
  }

  return (
    <View className="evaluation-actions">
      <View className="evaluation-actions__transfer-card">
        <View className="evaluation-actions__transfer-copy">
          <Text className="evaluation-actions__transfer-title">有一份跨端流转内容待应用</Text>
          <Text className="evaluation-actions__transfer-sub">确认后会合并到当前填写区。</Text>
        </View>
        <FeedbackButton
          className="evaluation-actions__transfer-button"
          loadingText="应用中"
          successText="已应用"
          onClick={onApplyTransfer}
        >
          应用流转
        </FeedbackButton>
      </View>
    </View>
  );
}
