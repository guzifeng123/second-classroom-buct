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

const storage = new Map();
const removedKeys = [];
const taroMock = {
  getStorage: async ({ key }) => {
    if (!storage.has(key)) {
      throw new Error("missing storage");
    }

    return { data: storage.get(key) };
  },
  setStorage: async ({ key, data }) => {
    storage.set(key, data);
  },
  removeStorage: async ({ key }) => {
    removedKeys.push(key);
    storage.delete(key);
  }
};

const {
  NOTE_SNAPSHOT_INDEX_KEY,
  NOTE_SNAPSHOT_STORAGE_KEY,
  buildNoteSnapshotIndexEntry,
  getNoteSnapshotStorageKey
} = loadTsModule(path.join(projectRoot, "src", "utils", "noteSnapshot.ts"));
const { persistNoteSnapshotPreview } = loadTsModule(
  path.join(projectRoot, "src", "services", "noteSnapshotService.ts"),
  {
    mocks: {
      "@tarojs/taro": {
        __esModule: true,
        default: taroMock
      }
    }
  }
);

const reference = {
  noteId: "note_keep",
  title: "保留快照",
  plainText: "快照摘要",
  imageCount: 1,
  referencedAt: 1000
};
const oldReferences = Array.from({ length: 24 }, (_, index) => ({
  noteId: `note_old_${index}`,
  title: `旧快照 ${index}`,
  plainText: "旧摘要",
  imageCount: 0,
  referencedAt: index + 1
}));
const oldEntries = oldReferences.map((item, index) => buildNoteSnapshotIndexEntry(item, index + 1));

for (const item of oldReferences) {
  storage.set(getNoteSnapshotStorageKey(item), item);
}
storage.set(NOTE_SNAPSHOT_INDEX_KEY, oldEntries);

persistNoteSnapshotPreview(reference)
  .then((route) => {
    const storageKey = getNoteSnapshotStorageKey(reference);
    const index = storage.get(NOTE_SNAPSHOT_INDEX_KEY);

    assert(route.includes(encodeURIComponent(storageKey)), "快照路由应包含新快照 storage key");
    assertEqual(storage.get(storageKey), reference, "应写入独立快照 key");
    assertEqual(storage.get(NOTE_SNAPSHOT_STORAGE_KEY), reference, "应写入最近快照兜底 key");
    assertEqual(index.length, 24, "快照索引应按默认上限保留 24 条");
    assertEqual(index[0].storageKey, storageKey, "新快照应排在索引首位");
    assertEqual(removedKeys.length, 1, "超出上限时应清理 1 条旧快照");
    assertEqual(removedKeys[0], oldEntries[0].storageKey, "应清理最旧快照 key");
    assert(!storage.has(oldEntries[0].storageKey), "最旧快照数据应被移除");

    return persistNoteSnapshotPreview({
      ...reference,
      title: "保留快照更新"
    });
  })
  .then(() => {
    const storageKey = getNoteSnapshotStorageKey(reference);
    const index = storage.get(NOTE_SNAPSHOT_INDEX_KEY);

    assertEqual(index.length, 24, "重复快照写入不应增加索引长度");
    assertEqual(index.filter((entry) => entry.storageKey === storageKey).length, 1, "重复快照应去重");
    assertEqual(storage.get(storageKey).title, "保留快照更新", "重复快照应覆盖为最新数据");
    console.log("图文快照服务测试通过。");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
