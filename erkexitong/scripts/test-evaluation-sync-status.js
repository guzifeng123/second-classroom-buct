const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const storage = new Map();
let remoteSaveMode = "success";

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
  },
  removeStorageSync: (key) => {
    storage.delete(key);
  },
  showModal: async () => ({ confirm: false })
};

const evaluationServiceMock = {
  fetchEvaluationSnapshot: async () => null,
  saveEvaluationDraftRemote: async () => {
    if (remoteSaveMode === "fail") {
      throw new Error("远端草稿保存失败");
    }
    if (remoteSaveMode === "auth-expired") {
      const error = new Error("远端草稿保存失败");
      error.errorCode = "AUTH_EXPIRED";
      error.statusCode = 401;
      throw error;
    }
  }
};

const { useEvaluationStore } = loadTsModule(path.join(projectRoot, "src", "stores", "useEvaluationStore.ts"), {
  mocks: {
    "@tarojs/taro": taroMock,
    "../services/evaluationService": evaluationServiceMock
  }
});

function resetStore() {
  storage.clear();
  remoteSaveMode = "success";
  useEvaluationStore.getState().resetDraft();
}

async function main() {
  resetStore();
  assertEqual(useEvaluationStore.getState().syncStatus, "local-saved", "初始状态应为本地已保存");

  const recordId = useEvaluationStore.getState().addRecord("moral", "base", "moral-activity");
  assertEqual(useEvaluationStore.getState().syncStatus, "local-unsaved", "新增记录后应标记为本地未保存");

  useEvaluationStore.getState().updateText("moral", "moral-activity", recordId, "参加德育活动");
  assertEqual(useEvaluationStore.getState().syncStatus, "local-unsaved", "编辑文字后应保持本地未保存");

  const localSaveResult = await useEvaluationStore.getState().saveDraft();
  assertEqual(useEvaluationStore.getState().syncStatus, "local-saved", "未登录保存后应标记为本地已保存");
  assertEqual(localSaveResult.remoteSaved, false, "未登录保存不应标记远端已保存");
  assertEqual(localSaveResult.remoteError, undefined, "仅本地保存不应伪装成远端同步失败");

  useEvaluationStore.getState().updateText("moral", "moral-activity", recordId, "参加德育活动并提交材料");
  const remoteSaveResult = await useEvaluationStore.getState().saveDraft("student-001");
  assertEqual(remoteSaveResult.remoteSaved, true, "远端保存成功应返回 remoteSaved=true");
  assertEqual(useEvaluationStore.getState().syncStatus, "remote-synced", "远端保存成功后应标记为远端已同步");
  assertEqual(useEvaluationStore.getState().lastSyncError, null, "远端保存成功后应清空同步错误");

  useEvaluationStore.getState().updateText("moral", "moral-activity", recordId, "再次编辑后远端失败");
  remoteSaveMode = "fail";
  const failedSaveResult = await useEvaluationStore.getState().saveDraft("student-001");
  assertEqual(failedSaveResult.remoteSaved, false, "远端保存失败应返回 remoteSaved=false");
  assertEqual(failedSaveResult.remoteError, "远端草稿保存失败", "远端保存失败应返回错误原因");
  assertEqual(useEvaluationStore.getState().syncStatus, "sync-failed", "远端保存失败后应标记同步失败");
  assertEqual(useEvaluationStore.getState().lastSyncError, "远端草稿保存失败", "远端保存失败后应保留错误原因");
  assertEqual(useEvaluationStore.getState().lastSyncErrorCode, null, "无稳定错误码时不应制造错误码");

  remoteSaveMode = "auth-expired";
  const authFailedSaveResult = await useEvaluationStore.getState().saveDraft("student-001");
  assertEqual(authFailedSaveResult.remoteSaved, false, "权限失效时远端保存应失败");
  assertEqual(authFailedSaveResult.remoteErrorCode, "AUTH_EXPIRED", "远端保存失败应返回稳定错误码");
  assertEqual(authFailedSaveResult.remoteErrorStatusCode, 401, "远端保存失败应返回 HTTP 状态码");
  assertEqual(useEvaluationStore.getState().lastSyncErrorCode, "AUTH_EXPIRED", "store 应保留稳定错误码");
  assertEqual(useEvaluationStore.getState().lastSyncErrorStatusCode, 401, "store 应保留 HTTP 状态码");

  console.log("评定草稿同步状态测试通过。");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
