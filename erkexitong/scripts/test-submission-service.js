const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const storage = new Map();
let shouldFailRemote = false;

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

const taroMock = {
  getStorage: async ({ key }) => {
    if (!storage.has(key)) {
      throw new Error("storage miss");
    }

    return { data: storage.get(key) };
  },
  setStorage: async ({ key, data }) => {
    storage.set(key, data);
  }
};

const apiMock = {
  hasApiBaseUrl: true,
  getErrorMessage: (error, fallback) => (error instanceof Error && error.message ? error.message : fallback),
  request: async ({ url }) => {
    if (shouldFailRemote) {
      throw new Error("远端提交详情不可用");
    }

    assertEqual(url, "/evaluation-submissions/sub_remote", "提交详情接口路径应包含提交 ID");

    return {
      submission_id: "sub_remote",
      user_id: "student-001",
      created_at: "2026-07-13T08:00:00.000Z",
      rule_version: "2026.07.v1",
      total_score: 96,
      material_count: 3,
      issue_count: 0,
      records: {
        "moral:student-code": [
          {
            id: "record-1",
            text: "遵守学生行为准则",
            images: []
          }
        ]
      },
      selected_item_ids: ["student-code"],
      dimension_summaries: [
        {
          key: "moral",
          title: "道德与思想素质",
          score: 96,
          maxScore: 180,
          selectedCount: 1,
          materialCount: 1,
          issueCount: 0
        }
      ]
    };
  }
};

const { getSubmissionRecordDetail } = loadTsModule(path.join(projectRoot, "src", "services", "submissionService.ts"), {
  mocks: {
    "@tarojs/taro": taroMock,
    "./api": apiMock
  }
});

async function main() {
  const remoteResult = await getSubmissionRecordDetail("sub_remote");
  assertEqual(remoteResult.source, "remote", "远端详情成功时来源应为 remote");
  assertEqual(remoteResult.record.submissionId, "sub_remote", "远端详情应归一化提交 ID");
  assertEqual(remoteResult.record.records["moral:student-code"].length, 1, "远端详情应保留 records 快照");
  assertEqual(remoteResult.record.selectedItemIds[0], "student-code", "远端详情应保留 selectedItemIds");
  assertEqual(remoteResult.record.dimensionSummaries.length, 1, "远端详情应保留维度汇总");

  shouldFailRemote = true;
  const fallbackResult = await getSubmissionRecordDetail("sub_remote");
  assertEqual(fallbackResult.source, "local", "远端详情失败时来源应回落 local");
  assertEqual(fallbackResult.error, "远端提交详情不可用", "远端详情失败应保留错误原因");
  assertEqual(fallbackResult.record.submissionId, "sub_remote", "远端失败时应返回最近缓存的本地详情");
  assertEqual(fallbackResult.record.records["moral:student-code"].length, 1, "本地兜底应保留已缓存 records");

  const missingResult = await getSubmissionRecordDetail("");
  assertEqual(missingResult.source, "local", "缺少提交 ID 时来源应为 local");
  assertEqual(missingResult.record, null, "缺少提交 ID 时不应读取详情");

  console.log("提交详情服务测试通过。");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
