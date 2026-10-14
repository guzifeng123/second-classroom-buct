import { lazy, Suspense, type ReactNode, useEffect, useState } from "react";
import { View } from "@tarojs/components";
import { isH5DetailRoutePath } from "../../utils/detailNavigation";

const EvaluationPage = lazy(() => import("../../pages/evaluation"));
export const WEB_SPLIT_LAYOUT_MEDIA_QUERY = "(min-width: 1180px)";

export function shouldUseWebSplit(routePath: string): boolean {
  return process.env.TARO_ENV === "h5" && isH5DetailRoutePath(routePath);
}

function getIsWideWebViewport(): boolean {
  if (process.env.TARO_ENV !== "h5" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(WEB_SPLIT_LAYOUT_MEDIA_QUERY).matches;
}

function useWideWebViewport(): boolean {
  const [isWide, setIsWide] = useState(getIsWideWebViewport);

  useEffect(() => {
    if (process.env.TARO_ENV !== "h5" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const query = window.matchMedia(WEB_SPLIT_LAYOUT_MEDIA_QUERY);
    const handleChange = () => setIsWide(query.matches);

    handleChange();

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handleChange);
      return () => query.removeEventListener("change", handleChange);
    }

    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);

  return isWide;
}

export function shouldMountWebSplitMaster(routePath: string, isWideViewport: boolean): boolean {
  return shouldUseWebSplit(routePath) && isWideViewport;
}

interface WebSplitLayoutProps {
  children: ReactNode;
  routePath: string;
}

export default function WebSplitLayout({ children, routePath }: WebSplitLayoutProps) {
  const isWideViewport = useWideWebViewport();
  const shouldUseDetailShell = shouldUseWebSplit(routePath);
  const shouldShowMaster = shouldMountWebSplitMaster(routePath, isWideViewport);

  if (!shouldUseDetailShell) {
    return <>{children}</>;
  }

  return (
    <View className={shouldShowMaster ? "web-split-layout" : "web-split-layout-inline"}>
      {shouldShowMaster ? (
        <View key="master" className="web-split-layout__pane web-split-layout__master">
          <Suspense fallback={null}>
            <EvaluationPage />
          </Suspense>
        </View>
      ) : null}
      <View
        key="detail"
        className={shouldShowMaster ? "web-split-layout__pane web-split-layout__detail" : "web-split-layout-inline__detail"}
      >
        {children}
      </View>
    </View>
  );
}
