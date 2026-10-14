import Taro from "@tarojs/taro";
import { createId } from "../id";

const DEVICE_ID_KEY = "erkexitong-device-id";

export function getRuntimeLabel(): string {
  const env = Taro.getEnv();

  if (env === Taro.ENV_TYPE.WEAPP) {
    return "微信小程序";
  }

  if (env === Taro.ENV_TYPE.RN) {
    return "Android App";
  }

  return "Web H5";
}

export function getDeviceInfo(): { deviceId: string; deviceName: string } {
  let deviceId = "";

  try {
    deviceId = Taro.getStorageSync<string>(DEVICE_ID_KEY);
  } catch {
    deviceId = "";
  }

  if (!deviceId) {
    deviceId = createId("device");
    try {
      Taro.setStorageSync(DEVICE_ID_KEY, deviceId);
    } catch {
      // Storage can be unavailable in strict privacy/browser modes.
    }
  }

  try {
    const system = Taro.getSystemInfoSync();
    return {
      deviceId,
      deviceName: `${getRuntimeLabel()} · ${system.model || system.platform || "unknown"}`
    };
  } catch {
    return {
      deviceId,
      deviceName: getRuntimeLabel()
    };
  }
}
