import { PropsWithChildren } from "react";
import { useLaunch } from "@tarojs/taro";
import WebSplitLayout from "./components/WebSplitLayout";
import { useUserStore } from "./stores/useUserStore";
import { getDeviceInfo } from "./utils/platform";
import "./app.scss";

function getCurrentH5RoutePath(): string {
  if (process.env.TARO_ENV !== "h5" || typeof window === "undefined") {
    return "";
  }

  const hashRoute = window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : "";

  return hashRoute || `${window.location.pathname}${window.location.search}`;
}

export default function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    const { deviceId, deviceName } = getDeviceInfo();
    useUserStore.getState().setDeviceInfo(deviceId, deviceName);
    useUserStore.getState().hydrateSession();
  });

  return <WebSplitLayout routePath={getCurrentH5RoutePath()}>{children}</WebSplitLayout>;
}
