import { type ReactNode } from "react";
import { View } from "@tarojs/components";
import EvaluationPage from "../../pages/evaluation";
import { isH5DetailRoutePath } from "../../utils/detailNavigation";

export function shouldUseWebSplit(routePath: string): boolean {
  return process.env.TARO_ENV === "h5" && isH5DetailRoutePath(routePath);
}

interface WebSplitLayoutProps {
  children: ReactNode;
  routePath: string;
}

export default function WebSplitLayout({ children, routePath }: WebSplitLayoutProps) {
  if (!shouldUseWebSplit(routePath)) {
    return <>{children}</>;
  }

  return (
    <View className="web-split-layout">
      <View className="web-split-layout__pane web-split-layout__master">
        <EvaluationPage />
      </View>
      <View className="web-split-layout__pane web-split-layout__detail">{children}</View>
    </View>
  );
}
