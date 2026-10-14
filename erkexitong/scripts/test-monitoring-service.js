const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

const apiMock = {
  hasApiBaseUrl: true,
  getErrorMessage: (error, fallback) => (error instanceof Error && error.message ? error.message : fallback),
  request: async () => {
    throw new Error("request mock 未初始化");
  }
};
const mocks = {
  "./api": apiMock
};
const monitoring = loadTsModule(path.join(projectRoot, "src", "utils", "monitoring.ts"), { mocks });
const service = loadTsModule(path.join(projectRoot, "src", "services", "monitoringService.ts"), { mocks });

async function assertSkipWithoutEvents() {
  apiMock.hasApiBaseUrl = true;
  apiMock.request = async () => {
    throw new Error("空队列不应请求上报接口");
  };
  monitoring.resetMonitoringSnapshot();
  const result = await service.uploadMonitoringEvents();
  assertEqual(result.attempted, false, "空队列不应尝试上报");
  assertEqual(result.skippedReason, "empty", "空队列应返回 empty 跳过原因");
}

async function assertSkipWithoutApiBaseUrl() {
  apiMock.hasApiBaseUrl = false;
  apiMock.request = async () => {
    throw new Error("未配置 API 时不应请求上报接口");
  };
  monitoring.resetMonitoringSnapshot();
  monitoring.recordKeyAction("evaluation_submit", "attempt");
  const result = await service.uploadMonitoringEvents();
  assertEqual(result.attempted, false, "未配置 API 时不应尝试上报");
  assertEqual(result.skippedReason, "missing-api-base-url", "未配置 API 时应返回明确跳过原因");
  assertEqual(result.remainingEventCount, 1, "未配置 API 时应保留待上报事件");
}

async function assertSuccessfulUploadClearsAcceptedEvents() {
  apiMock.hasApiBaseUrl = true;
  let requestPayload = null;
  apiMock.request = async ({ url, method, data }) => {
    assertEqual(url, "/frontend-monitoring-events", "监控服务应请求约定上报接口");
    assertEqual(method, "POST", "监控服务应使用 POST 上报");
    requestPayload = data;
    return {
      acceptedEventIds: data.events.map((event) => event.id)
    };
  };
  monitoring.resetMonitoringSnapshot();
  monitoring.recordKeyAction("evaluation_submit", "attempt");
  monitoring.recordApiFailure({
    url: "/evaluation-submissions",
    method: "POST",
    statusCode: 500,
    message: "服务端异常"
  });

  const result = await service.uploadMonitoringEvents(1);
  assertEqual(requestPayload.schemaVersion, 1, "上报请求应使用 schema v1");
  assertEqual(requestPayload.events.length, 1, "上报请求应遵守批次 limit");
  assertEqual(requestPayload.droppedEventCount, 1, "上报请求应包含本批次外事件数量");
  assertEqual(result.uploaded, true, "后端确认事件后应标记 uploaded");
  assertEqual(result.acceptedEventIds.length, 1, "应回传已确认事件 ID");
  assertEqual(result.remainingEventCount, 1, "只清理已确认事件，未进入批次事件应保留");
  assertEqual(monitoring.getMonitoringSnapshot().events.length, 1, "工具层应清理已确认事件");
}

async function assertFailedUploadKeepsEventsAndRecordsError() {
  apiMock.hasApiBaseUrl = true;
  apiMock.request = async () => {
    throw new Error("监控接口不可用");
  };
  monitoring.resetMonitoringSnapshot();
  monitoring.recordKeyAction("evaluation_submit", "failed");

  const result = await service.uploadMonitoringEvents();
  assertEqual(result.attempted, true, "上报失败仍应标记已尝试");
  assertEqual(result.uploaded, false, "上报失败不应标记 uploaded");
  assertEqual(result.error, "监控接口不可用", "上报失败应返回错误原因");
  assertEqual(monitoring.getMonitoringSnapshot().events.length, 2, "上报失败应保留原事件并记录上报错误");
  assert(monitoring.getMonitoringSnapshot().events.some((event) => event.name === "monitoring_upload"), "上报失败应记录监控错误事件");
}

async function main() {
  await assertSkipWithoutEvents();
  await assertSkipWithoutApiBaseUrl();
  await assertSuccessfulUploadClearsAcceptedEvents();
  await assertFailedUploadKeepsEventsAndRecordsError();
  console.log("监控上报服务测试通过。");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
