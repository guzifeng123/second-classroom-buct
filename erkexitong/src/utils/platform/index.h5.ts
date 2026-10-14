import { createId } from "../id";

const DEVICE_ID_KEY = "erkexitong-device-id";

export function getRuntimeLabel(): string {
  return "Web H5";
}

function readDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(DEVICE_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDeviceId(deviceId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {
    // Storage can be unavailable in strict privacy/browser modes.
  }
}

function getBrowserDeviceLabel(): string {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const platform = navigator.platform || "";
  const userAgentDataPlatform =
    "userAgentData" in navigator
      ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ""
      : "";

  return userAgentDataPlatform || platform || "unknown";
}

export function getDeviceInfo(): { deviceId: string; deviceName: string } {
  let deviceId = readDeviceId();

  if (!deviceId) {
    deviceId = createId("device");
    writeDeviceId(deviceId);
  }

  return {
    deviceId,
    deviceName: `${getRuntimeLabel()} · ${getBrowserDeviceLabel()}`
  };
}
