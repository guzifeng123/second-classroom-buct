import { WS_BASE_URL, hasApiBaseUrl, hasWsBaseUrl } from "../services/api";

export type RuntimeEnvironmentMode = "offline-demo" | "partial-online" | "online";

export interface RuntimeEnvironmentStatus {
  mode: RuntimeEnvironmentMode;
  title: string;
  description: string;
  apiConfigured: boolean;
  wsConfigured: boolean;
  apiLabel: string;
  wsLabel: string;
}

function configuredLabel(value: string): string {
  return value.trim() ? "已配置" : "未配置";
}

export function getRuntimeEnvironmentStatus(): RuntimeEnvironmentStatus {
  if (!hasApiBaseUrl) {
    return {
      mode: "offline-demo",
      title: "离线演示模式",
      description: "未配置 API 地址，可登录、填写和本地暂存；正式提交、远端上传和真实跨端同步不可用。",
      apiConfigured: false,
      wsConfigured: hasWsBaseUrl,
      apiLabel: "API 未配置",
      wsLabel: `WebSocket ${configuredLabel(WS_BASE_URL)}`
    };
  }

  if (!hasWsBaseUrl) {
    return {
      mode: "partial-online",
      title: "在线填报模式",
      description: "API 已配置，可登录、同步草稿、上传和提交；WebSocket 未配置，跨端流转仅保留离线演示记录。",
      apiConfigured: true,
      wsConfigured: false,
      apiLabel: "API 已配置",
      wsLabel: "WebSocket 未配置"
    };
  }

  return {
    mode: "online",
    title: "完整在线模式",
    description: "API 与 WebSocket 均已配置，可使用远端提交、图片上传和真实跨端流转。",
    apiConfigured: true,
    wsConfigured: true,
    apiLabel: "API 已配置",
    wsLabel: "WebSocket 已配置"
  };
}

export function getRuntimeEnvironmentSummary(): string {
  const status = getRuntimeEnvironmentStatus();
  return `${status.apiLabel} · ${status.wsLabel}`;
}
