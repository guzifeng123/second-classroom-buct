import { Button, Text, View } from "@tarojs/components";

interface EvaluationGateProps {
  onGoLogin: () => void;
}

export default function EvaluationGate({ onGoLogin }: EvaluationGateProps) {
  return (
    <View className="page-shell evaluation-page evaluation-page--gate">
      <Text className="evaluation-gate__title">未登录</Text>
      <Button className="evaluation-gate__button" onClick={onGoLogin}>
        返回登录
      </Button>
    </View>
  );
}
