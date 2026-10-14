const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

const {
  classifySyncError,
  formatSavedAt,
  getSyncErrorDisplay,
  getSyncErrorLabel,
  getSyncStatusDisplay,
  getSyncStatusText
} = loadTsModule(path.join(projectRoot, "src", "utils", "evaluationSyncStatus.ts"));

const savedAt = new Date(2026, 6, 13, 6, 5, 0).getTime();

assertEqual(getSyncStatusText("local-unsaved"), "本地未保存", "本地未保存文案应正确");
assertEqual(getSyncStatusText("local-saved"), "本地已保存", "本地已保存文案应正确");
assertEqual(getSyncStatusText("remote-syncing"), "远端同步中", "远端同步中文案应正确");
assertEqual(getSyncStatusText("remote-synced"), "远端已同步", "远端已同步文案应正确");
assertEqual(getSyncStatusText("sync-failed"), "同步失败", "同步失败文案应正确");
assertEqual(formatSavedAt(null), "", "缺少保存时间时应返回空字符串");
assertEqual(formatSavedAt(savedAt), "06:05", "保存时间应格式化为小时和分钟");
assertEqual(getSyncStatusDisplay("remote-synced", savedAt), "远端已同步 · 06:05", "状态展示应包含保存时间");
assertEqual(getSyncStatusDisplay("local-unsaved", null), "本地未保存", "无保存时间时状态展示应保持纯状态");
assertEqual(classifySyncError("Network request failed"), "network", "网络请求失败应归类为网络异常");
assertEqual(classifySyncError("请求超时，请重试"), "network", "中文超时错误应归类为网络异常");
assertEqual(classifySyncError("HTTP 401 Unauthorized"), "permission", "未授权响应应归类为权限异常");
assertEqual(classifySyncError("HTTP 422 validation failed"), "validation", "校验响应应归类为数据校验失败");
assertEqual(classifySyncError("服务暂时不可用"), "unknown", "无法识别的错误应保留为未知异常");
assertEqual(classifySyncError("HTTP 1401"), "unknown", "状态码分类不应误匹配更长数字");
assertEqual(
  classifySyncError({ message: "服务返回了含混错误", code: "AUTH_EXPIRED" }),
  "permission",
  "稳定权限错误码应优先于错误文本"
);
assertEqual(
  classifySyncError({ message: "Network request failed", statusCode: 422 }),
  "validation",
  "HTTP 状态码应优先于错误文本"
);
assertEqual(
  classifySyncError({ message: "远端草稿保存失败", code: "network-error" }),
  "network",
  "错误码分类应兼容横线格式"
);
assertEqual(getSyncErrorLabel("fetch failed"), "网络异常", "网络异常短标签应稳定");
assertEqual(
  getSyncErrorDisplay("403 Forbidden"),
  "权限异常：登录可能已失效，请重新登录后重试。",
  "权限异常应给出重新登录指引"
);
assertEqual(
  getSyncErrorDisplay({ message: "远端草稿保存失败", code: "AUTH_EXPIRED" }),
  "权限异常：登录可能已失效，请重新登录后重试。",
  "稳定错误码命中权限异常时应给出重新登录指引"
);
assertEqual(
  getSyncErrorDisplay("字段格式 invalid"),
  "数据校验失败：请检查填报内容后再重试。",
  "校验异常应给出内容检查指引"
);
assertEqual(
  getSyncErrorDisplay(null),
  "未知同步异常：请稍后重试，持续失败请联系管理员。",
  "缺少错误明细时应提供兜底指引"
);

console.log("评定状态栏展示测试通过。");
