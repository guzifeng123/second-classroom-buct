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

const monitoring = loadTsModule(path.join(projectRoot, "src", "utils", "monitoring.ts"));

function assertMonitoringUtility() {
  monitoring.resetMonitoringSnapshot();
  monitoring.recordKeyAction("evaluation_submit", "attempt", { hasUserId: true, ignored: undefined });
  monitoring.recordKeyAction("evaluation_submit", "failed", { reason: "offline" });
  monitoring.recordErrorLog("evaluation_submit", new Error("正式提交失败"), { page: "evaluation" });
  monitoring.recordErrorLog("note_save", new Error("图文保存失败"), {
    userId: "student-001",
    content: "这是一段不应进入监控快照的正文",
    imageUrl: "https://example.test/proof.png",
    note: "x".repeat(180),
    safeFlag: true
  });
  monitoring.recordApiFailure({
    url: "/evaluation-submissions",
    method: "POST",
    statusCode: 500,
    message: "服务端异常"
  });
  monitoring.recordApiFailure({
    url: "/evaluation-submissions",
    method: "POST",
    statusCode: 500,
    message: "服务端异常"
  });

  const snapshot = monitoring.getMonitoringSnapshot();
  assertEqual(snapshot.events.length, 6, "监控事件应记录关键操作、错误和接口失败");
  assertEqual(snapshot.keyActionCounts["evaluation_submit:attempt"], 1, "关键操作 attempt 应计数");
  assertEqual(snapshot.keyActionCounts["evaluation_submit:failed"], 1, "关键操作 failed 应计数");
  assertEqual(snapshot.errorCount, 2, "错误日志数量应统计");
  assertEqual(snapshot.apiFailureStats["POST /evaluation-submissions 500"].count, 2, "同一接口失败应累加");
  assertEqual(
    snapshot.events[0].context.ignored,
    undefined,
    "undefined 上下文字段不应进入监控事件"
  );
  const redactedEvent = snapshot.events.find((event) => event.name === "note_save");
  assert(redactedEvent, "应记录用于验证脱敏的错误事件");
  assertEqual(redactedEvent.context.userId, "[redacted]", "用户标识字段应自动脱敏");
  assertEqual(redactedEvent.context.content, "[redacted]", "正文内容字段应自动脱敏");
  assertEqual(redactedEvent.context.imageUrl, "[redacted]", "图片 URL 字段应自动脱敏");
  assertEqual(redactedEvent.context.safeFlag, true, "非敏感布尔上下文应保留");
  assert(
    redactedEvent.context.note.length <= 163,
    "长字符串上下文应截断，避免大段材料进入监控快照"
  );

  for (let index = 0; index < 130; index += 1) {
    monitoring.recordKeyAction("bulk_action", "attempt", { index });
  }
  assertEqual(monitoring.getMonitoringSnapshot().events.length, 120, "监控事件应按上限裁剪");
}

function assertMonitoringUploadPayload() {
  monitoring.resetMonitoringSnapshot();
  const first = monitoring.recordKeyAction("evaluation_submit", "attempt");
  const second = monitoring.recordApiFailure({
    url: "/evaluation-submissions",
    method: "POST",
    statusCode: 500,
    message: "服务端异常"
  });
  const third = monitoring.recordErrorLog("evaluation_submit", new Error("提交失败"));

  const payload = monitoring.getMonitoringUploadPayload(2);
  assertEqual(payload.schemaVersion, 1, "监控上报 payload 应包含 schema 版本");
  assert(payload.generatedAt >= first.createdAt, "监控上报 payload 应包含生成时间");
  assertEqual(payload.events.length, 2, "监控上报 payload 应按 limit 截取事件");
  assertEqual(payload.droppedEventCount, 1, "监控上报 payload 应记录未进入本批次的事件数量");
  assertEqual(payload.keyActionCounts["evaluation_submit:attempt"], 1, "payload 应只统计本批次关键操作");
  assertEqual(payload.apiFailureStats["POST /evaluation-submissions 500"].count, 1, "payload 应统计本批次接口失败");
  assertEqual(payload.errorCount, 0, "payload 不应统计本批次之外的错误事件");

  monitoring.clearMonitoringEvents([first.id, second.id]);
  const afterClear = monitoring.getMonitoringSnapshot();
  assertEqual(afterClear.events.length, 1, "清理已上传事件后只应保留未上传事件");
  assertEqual(afterClear.events[0].id, third.id, "未进入上报批次的事件不应被清理");
  assertEqual(afterClear.keyActionCounts["evaluation_submit:attempt"], undefined, "清理后关键操作统计应同步收缩");
  assertEqual(afterClear.apiFailureStats["POST /evaluation-submissions 500"], undefined, "清理后接口失败统计应同步收缩");
  assertEqual(afterClear.errorCount, 1, "未上传错误事件仍应保留统计");
}

async function assertApiFailureInstrumentation() {
  let mode = "network-failure";
  const taroMock = {
    request: async () => {
      if (mode === "network-failure") {
        throw new Error("网络断开");
      }

      return {
        statusCode: 403,
        data: {
          message: "没有权限"
        }
      };
    }
  };
  const userStoreMock = {
    useUserStore: {
      getState: () => ({ token: "token-001" })
    }
  };
  const mocks = {
    "@tarojs/taro": taroMock,
    "../stores/useUserStore": userStoreMock
  };
  const api = loadTsModule(path.join(projectRoot, "src", "services", "api.ts"), { mocks });
  const apiMonitoring = loadTsModule(path.join(projectRoot, "src", "utils", "monitoring.ts"), { mocks });

  apiMonitoring.resetMonitoringSnapshot();

  try {
    await api.request({ url: "/evaluation-drafts/student-001", method: "PUT", data: {} });
    throw new Error("网络失败时 request 应抛出异常");
  } catch (error) {
    assertEqual(error.message, "网络断开", "网络失败应保留原始错误消息");
  }

  mode = "http-failure";
  try {
    await api.request({ url: "/evaluation-submissions", method: "POST", data: {} });
    throw new Error("HTTP 失败时 request 应抛出异常");
  } catch (error) {
    assertEqual(error.message, "没有权限", "HTTP 失败应使用响应中的错误消息");
    assertEqual(error.statusCode, 403, "HTTP 失败应保留状态码");
  }

  const snapshot = apiMonitoring.getMonitoringSnapshot();
  assertEqual(
    snapshot.apiFailureStats["PUT /evaluation-drafts/student-001 NETWORK"].count,
    1,
    "网络失败应写入 NETWORK 接口失败统计"
  );
  assertEqual(
    snapshot.apiFailureStats["POST /evaluation-submissions 403"].count,
    1,
    "HTTP 失败应写入状态码维度的接口失败统计"
  );
}

async function main() {
  assertMonitoringUtility();
  assertMonitoringUploadPayload();
  await assertApiFailureInstrumentation();
  console.log("监控埋点工具测试通过。");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
