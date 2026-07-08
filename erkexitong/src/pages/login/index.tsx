import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Input, Text, View } from "@tarojs/components";
import { FeedbackButton, StatusBanner } from "../../components/ui";
import { getErrorMessage } from "../../services/api";
import { isOfflineAuthMode, loginWithUserId } from "../../services/authService";
import { initTransferSync } from "../../services/transferService";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useUserStore } from "../../stores/useUserStore";
import { getDeviceInfo } from "../../utils/platform";
import "./index.scss";

export default function LoginPage() {
  const [inputUserId, setInputUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const userId = useUserStore((state) => state.userId);
  const deviceName = useUserStore((state) => state.deviceName);
  const authMode = useUserStore((state) => state.authMode);
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const login = useUserStore((state) => state.login);
  const logout = useUserStore((state) => state.logout);
  const setDeviceInfo = useUserStore((state) => state.setDeviceInfo);
  const hydrateSession = useUserStore((state) => state.hydrateSession);
  const otherDevices = useConnectionStore((state) => state.otherDevices);
  const updateDevices = useConnectionStore((state) => state.updateDevices);

  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info.deviceId, info.deviceName);
    hydrateSession();
  }, [hydrateSession, setDeviceInfo]);

  const handleLogin = async () => {
    if (submitting) {
      return;
    }

    const trimmedUserId = inputUserId.trim() || userId.trim();
    if (!trimmedUserId) {
      setInlineError("请输入用户 ID 后再进入评定。");
      await Taro.showToast({
        title: "请输入用户 ID",
        icon: "none"
      });
      return;
    }

    const info = getDeviceInfo();
    setDeviceInfo(info.deviceId, info.deviceName);

    setSubmitting(true);
    setInlineError("");
    try {
      const result = await loginWithUserId(trimmedUserId);
      const nextMode = isOfflineAuthMode() ? "offline" : "remote";
      login(result.userId, result.token, nextMode);

      if (nextMode === "offline") {
        updateDevices([
          { deviceId: "broadcast", deviceName: "我的其他设备", online: true },
          { deviceId: "web-lab", deviceName: "实验室 Web 端", online: true },
          { deviceId: "android-phone", deviceName: "Android 手机端", online: false }
        ]);
      }

      initTransferSync();

      await Taro.redirectTo({
        url: "/pages/evaluation/index"
      });
    } catch (error) {
      const message = getErrorMessage(error, "登录失败");
      setInlineError(message);
      await Taro.showToast({
        title: message,
        icon: "none"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    initTransferSync();
    await Taro.redirectTo({
      url: "/pages/evaluation/index"
    });
  };

  const handleLogout = async () => {
    logout();
    setInputUserId("");
    await Taro.showToast({
      title: "已退出当前账号",
      icon: "success"
    });
  };

  return (
    <View className="page-shell login-page">
      <View className="login-shell">
        <View className="login-page__mast">
          <Text className="login-page__eyebrow">SECOND CLASSROOM</Text>
          <Text className="login-page__title">学生综合素质评定</Text>
          <Text className="login-page__subtitle">统一填写材料，跨端接续编辑</Text>
          <Text className="login-page__mode">
            {isOfflineAuthMode() ? "离线模式：未配置 API 地址，登录与暂存仅用于本机演示" : "在线模式：使用后端接口登录与同步"}
          </Text>
          <View className="login-page__stats">
            <View className="login-page__stat">
              <Text className="login-page__stat-value">600</Text>
              <Text className="login-page__stat-label">综合总分</Text>
            </View>
            <View className="login-page__stat">
              <Text className="login-page__stat-value">5</Text>
              <Text className="login-page__stat-label">评定维度</Text>
            </View>
            <View className="login-page__stat">
              <Text className="login-page__stat-value">3</Text>
              <Text className="login-page__stat-label">端同步</Text>
            </View>
          </View>
        </View>

        <View className="login-panel">
          <View className="login-card">
            <Text className="login-card__label">用户 ID</Text>
            <Input
              className="login-card__input"
              value={inputUserId}
              placeholder={isLoggedIn ? userId : "例如 student-2026-001"}
              onInput={(event) => setInputUserId(event.detail.value)}
            />
            {inlineError ? <StatusBanner tone="danger" title="登录未完成" description={inlineError} /> : null}
            <FeedbackButton
              className="login-card__primary"
              disabled={submitting}
              loadingText="登录中"
              onClick={handleLogin}
            >
              进入评定
            </FeedbackButton>
            {isLoggedIn ? (
              <Button className="login-card__secondary" onClick={handleContinue}>
                继续当前账号
              </Button>
            ) : null}
            {isLoggedIn ? (
              <Button className="login-card__text" onClick={handleLogout}>
                退出并切换账号
              </Button>
            ) : null}
          </View>

          <View className="device-strip">
            <Text className="device-strip__title">当前设备</Text>
            <Text className="device-strip__device">{deviceName || "未识别设备"}</Text>
            <Text className="device-strip__mode">{authMode === "offline" ? "离线会话" : "在线会话"}</Text>
            <View className="device-strip__list">
              {otherDevices.map((device) => (
                <View className="device-strip__pill" key={device.deviceId}>
                  <Text className={device.online ? "device-strip__dot--on" : "device-strip__dot"} />
                  <Text>{device.deviceName}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
