const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const storage = new Map();

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
  hasApiBaseUrl: false,
  getErrorMessage: (_error, fallback) => fallback,
  request: async () => {
    throw new Error("离线测试不应请求接口");
  }
};

const { fetchNotes, markNoteUsed, rememberLocalNote } = loadTsModule(
  path.join(projectRoot, "src", "services", "noteService.ts"),
  {
    mocks: {
      "@tarojs/taro": taroMock,
      "./api": apiMock
    }
  }
);

async function main() {
  storage.set("erkexitong-note-index", [
    {
      id: "legacy-note",
      title: "旧缓存材料",
      content: [{ type: "paragraph", text: "兼容旧缓存" }],
      plainText: "兼容旧缓存",
      blockCount: 1,
      imageCount: 0,
      createdAt: 10,
      updatedAt: 10
    }
  ]);

  const legacy = await fetchNotes("");
  assertEqual(legacy.data[0].tags.length, 0, "旧缓存应自动补齐空标签");
  assertEqual(legacy.data[0].source, "local", "旧缓存应自动补齐本机来源");
  assertEqual(legacy.data[0].usedCount, 0, "旧缓存应自动补齐使用次数");

  await rememberLocalNote({
    id: "asset-note",
    title: "志愿服务记录",
    content: [{ type: "paragraph", text: "服务过程" }],
    tags: ["志愿服务"],
    dimensionKeys: ["moral"],
    source: "transfer",
    savedAt: 100
  });
  await markNoteUsed("asset-note", {
    dimensionKey: "labor",
    sectionKey: "base",
    itemId: "volunteer-hours",
    usedAt: 200
  });

  const result = await fetchNotes("劳动与社会实践");
  const note = result.data.find((candidate) => candidate.id === "asset-note");
  assertEqual(Boolean(note), true, "关联维度名称应可检索到图文材料");
  assertEqual(note.tags[0], "志愿服务", "使用统计更新不应丢失标签");
  assertEqual(note.dimensionKeys.join(","), "moral,labor", "引用时应合并关联维度");
  assertEqual(note.source, "transfer", "引用时应保留材料来源");
  assertEqual(note.usedCount, 1, "引用时应增加使用次数");
  assertEqual(note.recentUsedAt, 200, "引用时应记录最近使用时间");
  assertEqual(note.lastUsedDimensionKey, "labor", "引用时应记录最近使用维度");
  assertEqual(note.lastUsedSectionKey, "base", "引用时应记录最近使用区段");
  assertEqual(note.lastUsedItemId, "volunteer-hours", "引用时应记录最近使用条目");

  await rememberLocalNote({
    id: "asset-note",
    title: "志愿服务记录",
    content: [{ type: "paragraph", text: "服务过程" }],
    tags: [],
    dimensionKeys: [],
    source: "transfer",
    savedAt: 300
  });
  const cleared = await fetchNotes("");
  const clearedNote = cleared.data.find((candidate) => candidate.id === "asset-note");
  assertEqual(clearedNote.tags.length, 0, "主动清空标签后不应被旧缓存恢复");
  assertEqual(clearedNote.dimensionKeys.length, 0, "主动清空关联维度后不应被旧缓存恢复");
  assertEqual(clearedNote.usedCount, 1, "编辑元数据不应清空既有引用次数");

  console.log("图文材料资产元数据测试通过。");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
