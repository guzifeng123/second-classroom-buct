const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const storage = new Map();
let requestCount = 0;
let rememberCount = 0;
let rememberedInput = null;

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
  },
  removeStorageSync: (key) => {
    storage.delete(key);
  }
};

const noteServiceMock = {
  fetchNoteDetail: async () => {
    throw new Error("本测试不读取详情");
  },
  rememberLocalNote: async ({ id, title, content, tags, dimensionKeys, source, savedAt }) => {
    rememberCount += 1;
    rememberedInput = { id, title, content, tags, dimensionKeys, source, savedAt };
    return {
      id: id || "note-local-test",
      title,
      content,
      plainText: content.map((block) => ("text" in block ? block.text : "")).join(" "),
      blockCount: content.length,
      imageCount: 0,
      tags,
      dimensionKeys,
      source,
      usedCount: 0,
      createdAt: savedAt,
      updatedAt: savedAt
    };
  }
};

const apiMock = {
  hasApiBaseUrl: false,
  request: async () => {
    requestCount += 1;
    throw new Error("离线模式不应发起请求");
  }
};

const { useNoteStore } = loadTsModule(path.join(projectRoot, "src", "stores", "useNoteStore.ts"), {
  mocks: {
    "@tarojs/taro": taroMock,
    "../services/api": apiMock,
    "../services/noteService": noteServiceMock
  }
});
const { getNoteSaveStatusText } = loadTsModule(
  path.join(projectRoot, "src", "utils", "noteSaveStatus.ts")
);

async function main() {
  useNoteStore.getState().reset();
  useNoteStore.getState().setTitle("离线图文材料");
  useNoteStore.getState().setContent([
    {
      type: "paragraph",
      text: "离线保存内容"
    }
  ]);
  useNoteStore.getState().setTags(["离线", "志愿服务"]);
  useNoteStore.getState().toggleDimension("labor");

  await useNoteStore.getState().saveNote();

  const state = useNoteStore.getState();
  const draft = storage.get("erkexitong-note-draft");

  assertEqual(requestCount, 0, "未配置 API 时不应请求 /notes");
  assertEqual(rememberCount, 1, "离线保存应写入本地图文索引");
  assertEqual(state.noteId, "note-local-test", "离线保存后应获得稳定本地 ID");
  assertEqual(state.isDirty, false, "离线保存后应清除修改状态");
  assert(typeof state.savedAt === "number", "离线保存后应记录保存时间");
  assertEqual(draft.noteId, "note-local-test", "本地草稿应关联保存后的图文 ID");
  assertEqual(draft.title, "离线图文材料", "本地草稿应保留标题");
  assertEqual(draft.content[0].text, "离线保存内容", "本地草稿应保留内容块");
  assertEqual(draft.tags.join(","), "离线,志愿服务", "本地草稿应保留标签");
  assertEqual(draft.dimensionKeys.join(","), "labor", "本地草稿应保留关联维度");
  assertEqual(draft.source, "local", "本地草稿应保留来源");
  assertEqual(rememberedInput.tags.join(","), "离线,志愿服务", "本地图文索引应接收标签");
  assertEqual(rememberedInput.dimensionKeys[0], "labor", "本地图文索引应接收关联维度");
  assertEqual(getNoteSaveStatusText(true, false), "有修改", "修改后的图文材料应提示有修改");
  assertEqual(getNoteSaveStatusText(false, false), "本地已保存", "离线保存后应提示本地已保存");
  assertEqual(getNoteSaveStatusText(false, true), "已同步", "远端保存成功后才应提示已同步");

  console.log("图文材料离线保存测试通过。");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
