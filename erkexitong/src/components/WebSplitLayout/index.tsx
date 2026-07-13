import { lazy, Suspense, type ReactNode } from "react";
import { View } from "@tarojs/components";
import { isH5DetailRoutePath } from "../../utils/detailNavigation";

const EvaluationPage = lazy(() => import("../../pages/evaluation"));

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
        <Suspense fallback={null}>
          <EvaluationPage />
        </Suspense>
      </View>
      <View className="web-split-layout__pane web-split-layout__detail">{children}</View>
    </View>
  );
}
