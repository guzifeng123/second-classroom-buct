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
  normalizeNote,
  normalizeNoteList,
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
  created_at: "2026-07-08T08:00:00.000Z",
  updated_at: "2026-07-09T08:00:00.000Z"
});

assertEqual(normalized.id, "note_1", "归一化应保留图文 ID");
assertEqual(normalized.title, "未命名图文材料", "空标题应回退为默认标题");
assertEqual(normalized.blockCount, 4, "blockCount 应统计内容块数量");
assertEqual(normalized.imageCount, 1, "imageCount 应统计图片块数量");
assertEqual(normalized.plainText.includes("社区服务"), true, "缺少 plainText 时应从内容块提取");
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

console.log("图文材料归一化测试通过。");
