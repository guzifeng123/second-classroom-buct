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

const {
  filterNotes,
  getNotePlainText,
  mergeNoteMetadata,
  normalizeNote,
  normalizeNoteDimensionKeys,
  normalizeNoteList,
  normalizeNoteTags,
  parseNoteTime
} = loadTsModule(path.join(projectRoot, "src", "utils", "noteNormalization.ts"));

const content = [
  { type: "heading", text: "志愿服务" },
  { type: "paragraph", text: "参加社区服务 4 小时" },
  { type: "image", url: "https://example.com/a.jpg", alt: "服务照片" },
  { type: "other", data: { tag: "labor" } }
];

assertEqual(
  getNotePlainText(content),
  '志愿服务 参加社区服务 4 小时 服务照片 {"tag":"labor"}',
  "正文提取应合并标题、段落、图片 alt 和扩展块"
);
assertEqual(parseNoteTime(123), 123, "数字时间应原样保留");
assertEqual(
  parseNoteTime("2026-07-09T08:00:00.000Z"),
  Date.parse("2026-07-09T08:00:00.000Z"),
  "字符串时间应解析为时间戳"
);
const fallbackStart = Date.now();
const fallbackTime = parseNoteTime("bad-date");
const fallbackEnd = Date.now();
assert(fallbackTime >= fallbackStart && fallbackTime <= fallbackEnd, "非法时间应回退为当前时间");

const normalized = normalizeNote({
  id: "note_1",
  title: "",
  content,
  tags: ["志愿服务", " 志愿服务 ", "劳动实践"],
  dimension_keys: ["labor", "invalid", "labor"],
  source: "remote",
  used_count: 2,
  recent_used_at: "2026-07-09T09:00:00.000Z",
  last_used_dimension_key: "labor",
  last_used_section_key: "base",
  last_used_item_id: "volunteer-hours",
  created_at: "2026-07-08T08:00:00.000Z",
  updated_at: "2026-07-09T08:00:00.000Z"
});

assertEqual(normalized.id, "note_1", "归一化应保留图文 ID");
assertEqual(normalized.title, "未命名图文材料", "空标题应回退为默认标题");
assertEqual(normalized.blockCount, 4, "blockCount 应统计内容块数量");
assertEqual(normalized.imageCount, 1, "imageCount 应统计图片块数量");
assertEqual(normalized.plainText.includes("社区服务"), true, "缺少 plainText 时应从内容块提取");
assertEqual(normalized.tags.join(","), "志愿服务,劳动实践", "标签应去空格并去重");
assertEqual(normalized.dimensionKeys.join(","), "labor", "关联维度应过滤非法值并去重");
assertEqual(normalized.source, "remote", "来源字段应归一化");
assertEqual(normalized.usedCount, 2, "使用次数应兼容蛇形字段");
assertEqual(
  normalized.recentUsedAt,
  Date.parse("2026-07-09T09:00:00.000Z"),
  "最近使用时间应兼容蛇形字段"
);
assertEqual(normalized.lastUsedItemId, "volunteer-hours", "最近使用条目应被保留");
assertEqual(normalized.createdAt, Date.parse("2026-07-08T08:00:00.000Z"), "蛇形 created_at 应被解析");
assertEqual(normalized.updatedAt, Date.parse("2026-07-09T08:00:00.000Z"), "蛇形 updated_at 应被解析");

const explicitPlainText = normalizeNote({
  id: "note_2",
  title: "运动会",
  content,
  plain_text: "后端摘要",
  updatedAt: 456
});
assertEqual(explicitPlainText.plainText, "后端摘要", "后端 plain_text 应优先于内容块提取");
assertEqual(explicitPlainText.createdAt, 456, "缺少 createdAt 时应使用 updatedAt 兜底");
assertEqual(explicitPlainText.source, "local", "旧数据缺少来源时应回退为本机创建");
assertEqual(explicitPlainText.usedCount, 0, "旧数据缺少使用次数时应回退为 0");
assertEqual(explicitPlainText.tags.length, 0, "旧数据缺少标签时应回退为空数组");

assertEqual(
  normalizeNoteTags(["A", "a", "超长标签需要被安全截断", "B", "C", "D", "E", "F", "G"]).length,
  6,
  "标签应忽略大小写重复并限制数量"
);
assertEqual(normalizeNoteTags("劳动, 志愿；实践").join(","), "劳动,志愿,实践", "字符串标签应按常见分隔符解析");
assertEqual(
  normalizeNoteDimensionKeys(["moral", "bad", "moral", "labor"]).join(","),
  "moral,labor",
  "维度归一化应保持有效值顺序"
);

const list = normalizeNoteList({
  data: [
    { id: "note_3", title: "科研竞赛", content: [], updatedAt: 1 },
    { id: "note_4", title: "德育活动", content: [], updatedAt: 2 }
  ],
  total: 2
});
assertEqual(list.length, 2, "包装格式列表应归一化 data 字段");
assertEqual(list[1].title, "德育活动", "列表归一化应保留条目顺序");

const filteredByTitle = filterNotes(list, "科研");
assertEqual(filteredByTitle.length, 1, "搜索应匹配标题");
assertEqual(filteredByTitle[0].id, "note_3", "搜索标题应返回匹配图文");

const filteredByText = filterNotes(
  [
    normalized,
    {
      ...explicitPlainText,
      plainText: "篮球训练"
    }
  ],
  "篮球"
);
assertEqual(filteredByText.length, 1, "搜索应匹配纯文本摘要");
assertEqual(filteredByText[0].id, "note_2", "搜索摘要应返回匹配图文");

const filteredByMetadata = filterNotes([normalized, explicitPlainText], "劳动与社会实践");
assertEqual(filteredByMetadata.length, 1, "搜索应匹配关联维度名称");
assertEqual(filteredByMetadata[0].id, "note_1", "维度名称搜索应返回匹配图文");
assertEqual(filterNotes([normalized, explicitPlainText], "志愿服务").length, 1, "搜索应匹配标签");

const merged = mergeNoteMetadata(
  normalizeNote({ id: "note_merge", title: "远端", content: [], updatedAt: 10 }, "remote"),
  {
    ...normalized,
    id: "note_merge",
    tags: ["本机标签"],
    dimensionKeys: ["labor"],
    usedCount: 3,
    recentUsedAt: 20
  }
);
assertEqual(merged.tags[0], "本机标签", "远端缺少元数据时应保留本机标签");
assertEqual(merged.usedCount, 3, "远端缺少使用次数时应保留本机统计");
assertEqual(merged.source, "remote", "合并本机元数据时不应覆盖远端来源");

console.log("图文材料归一化测试通过。");
