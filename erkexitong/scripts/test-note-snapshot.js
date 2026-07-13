const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

const {
  buildNoteSnapshotModal,
  buildNoteSnapshotRoute,
  buildNoteSnapshotIndexEntry,
  getNoteSnapshotContent,
  getNoteSnapshotStorageKey,
  getNoteSnapshotSummary,
  mergeNoteSnapshotIndex,
  NOTE_SNAPSHOT_INDEX_KEY,
  NOTE_SNAPSHOT_INDEX_LIMIT,
  NOTE_SNAPSHOT_STORAGE_KEY,
  NOTE_SNAPSHOT_STORAGE_PREFIX
} = loadTsModule(path.join(projectRoot, "src", "utils", "noteSnapshot.ts"));

const reference = {
  noteId: "note_1",
  title: "志愿服务记录",
  plainText: "  参加社区志愿服务并完成现场记录  ",
  imageCount: 2,
  referencedAt: Date.parse("2026-07-11T08:30:00.000Z")
};

assertEqual(
  getNoteSnapshotSummary(reference),
  "参加社区志愿服务并完成现场记录",
  "快照摘要应去除首尾空白"
);

assertEqual(
  getNoteSnapshotSummary({ ...reference, plainText: "abcdef" }, 3),
  "abc",
  "快照摘要应按最大长度截断"
);

assertEqual(
  getNoteSnapshotSummary({ ...reference, plainText: "   " }),
  "暂无摘要",
  "空摘要应使用兜底文案"
);

const modal = buildNoteSnapshotModal(reference);
assertEqual(modal.title, "《志愿服务记录》快照", "快照弹窗标题应包含图文标题");
assertEqual(modal.content.includes("参加社区志愿服务并完成现场记录"), true, "快照弹窗应包含摘要");
assertEqual(modal.content.includes("图片：2 张"), true, "快照弹窗应包含图片数量");
assertEqual(modal.content.includes("引用时间："), true, "快照弹窗应包含引用时间");

const fallbackContent = getNoteSnapshotContent(reference);
assertEqual(fallbackContent.length, 1, "缺少内容块时应使用摘要生成兜底内容");
assertEqual(fallbackContent[0].type, "paragraph", "摘要兜底内容应为段落");
assertEqual(fallbackContent[0].text, "参加社区志愿服务并完成现场记录", "摘要兜底内容应复用清理后的摘要");

const contentSnapshot = [
  { type: "heading", text: "活动现场", level: 2 },
  { type: "image", url: "https://example.com/proof.jpg", thumbUrl: "https://example.com/proof-thumb.jpg" }
];
const snapshotContent = getNoteSnapshotContent({
  ...reference,
  contentSnapshot
});
assertEqual(snapshotContent, contentSnapshot, "存在内容块快照时应优先使用原始内容块");
assertEqual(NOTE_SNAPSHOT_STORAGE_KEY, "erkexitong-note-snapshot-preview", "快照临时存储 key 应稳定");
assertEqual(NOTE_SNAPSHOT_STORAGE_PREFIX, "erkexitong-note-snapshot-preview:", "快照独立存储 key 前缀应稳定");
assertEqual(NOTE_SNAPSHOT_INDEX_KEY, "erkexitong-note-snapshot-preview:index", "快照索引 key 应稳定");
assertEqual(NOTE_SNAPSHOT_INDEX_LIMIT, 24, "快照索引默认保留上限应稳定");

const storageKey = getNoteSnapshotStorageKey(reference);
assertEqual(
  storageKey,
  "erkexitong-note-snapshot-preview:note_1-1783758600000",
  "快照独立存储 key 应由图文 ID 和引用时间组成"
);

const route = buildNoteSnapshotRoute(reference);
assertEqual(
  route,
  `/pages/note/snapshot/index?snapshotKey=${encodeURIComponent(storageKey)}`,
  "快照路由应携带独立存储 key 参数"
);

const entry = buildNoteSnapshotIndexEntry(reference, 100);
assertEqual(entry.storageKey, storageKey, "快照索引条目应保存独立存储 key");
assertEqual(entry.noteId, reference.noteId, "快照索引条目应保存图文 ID");
assertEqual(entry.title, reference.title, "快照索引条目应保存标题");
assertEqual(entry.savedAt, 100, "快照索引条目应保存写入时间");

const olderEntry = buildNoteSnapshotIndexEntry({ ...reference, noteId: "note_old", referencedAt: 1 }, 50);
const newerEntry = buildNoteSnapshotIndexEntry({ ...reference, noteId: "note_new", referencedAt: 2 }, 120);
const merged = mergeNoteSnapshotIndex([olderEntry, entry], newerEntry, 2);
assertEqual(merged.length, 2, "快照索引应按上限裁剪");
assertEqual(merged[0].storageKey, newerEntry.storageKey, "快照索引应按 savedAt 倒序排序");
assertEqual(merged[1].storageKey, entry.storageKey, "快照索引应保留较新的既有条目");

const refreshed = mergeNoteSnapshotIndex([olderEntry, entry], { ...olderEntry, savedAt: 200 }, 3);
assertEqual(refreshed.length, 2, "重复 storageKey 应去重");
assertEqual(refreshed[0].storageKey, olderEntry.storageKey, "重复条目刷新后应移到最前");
assertEqual(refreshed[0].savedAt, 200, "重复条目刷新后应使用新的写入时间");

console.log("图文快照展示测试通过。");
