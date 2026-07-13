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
  imageAssetToProofImage,
  mergeImageUsageMetadata,
  normalizeImageAsset,
  normalizeImageAssetList,
  normalizeStoredImageAsset,
  parseImageTime,
  parseOptionalImageTime
} = loadTsModule(path.join(projectRoot, "src", "utils", "imageLibraryNormalization.ts"));

assertEqual(parseImageTime(123), 123, "数字时间应原样保留");
assertEqual(
  parseImageTime("2026-07-09T08:00:00.000Z"),
  Date.parse("2026-07-09T08:00:00.000Z"),
  "字符串时间应解析为时间戳"
);
assertEqual(parseOptionalImageTime(undefined), undefined, "可选时间缺省时应保持 undefined");
const fallbackStart = Date.now();
const fallbackTime = parseImageTime("bad-date");
const fallbackEnd = Date.now();
assert(fallbackTime >= fallbackStart && fallbackTime <= fallbackEnd, "非法时间应回退为当前时间");

const normalized = normalizeImageAsset({
  id: "img_1",
  original_url: "https://example.com/original.jpg",
  thumb_url: "https://example.com/thumb.jpg",
  width: 800,
  height: 600,
  size: 123456,
  uploaded_at: "2026-07-09T08:00:00.000Z",
  recent_used_at: "2026-07-09T09:00:00.000Z",
  used_count: 2,
  last_used_dimension_key: "moral",
  last_used_section_key: "base",
  last_used_item_id: "student-code"
});

assertEqual(normalized.id, "img_1", "归一化应保留图片 ID");
assertEqual(normalized.originalUrl, "https://example.com/original.jpg", "蛇形 original_url 应归一化");
assertEqual(normalized.thumbUrl, "https://example.com/thumb.jpg", "蛇形 thumb_url 应归一化");
assertEqual(normalized.uploadedAt, Date.parse("2026-07-09T08:00:00.000Z"), "蛇形 uploaded_at 应解析");
assertEqual(normalized.recentUsedAt, Date.parse("2026-07-09T09:00:00.000Z"), "蛇形 recent_used_at 应解析");
assertEqual(normalized.usedCount, 2, "蛇形 used_count 应归一化");
assertEqual(normalized.lastUsedDimensionKey, "moral", "最近使用维度应归一化");

const urlFallback = normalizeImageAsset({
  url: "https://example.com/url-only.jpg",
  uploadedAt: 456
});
assertEqual(urlFallback.originalUrl, "https://example.com/url-only.jpg", "缺少 originalUrl 时应使用 url 兜底");
assertEqual(urlFallback.thumbUrl, "https://example.com/url-only.jpg", "缺少缩略图时应使用原图兜底");
assert(urlFallback.id.startsWith("image_"), "缺少图片 ID 时应生成 image 前缀 ID");

const list = normalizeImageAssetList({
  data: [
    { id: "img_valid", originalUrl: "https://example.com/valid.jpg", uploadedAt: 1 },
    { id: "img_invalid", uploadedAt: 2 },
    { id: "img_url", url: "https://example.com/url.jpg", uploadedAt: 3 }
  ],
  total: 3
});
assertEqual(list.length, 2, "列表归一化应过滤缺少图片 URL 的记录");
assertEqual(list[0].id, "img_valid", "列表应保留有效 originalUrl 记录");
assertEqual(list[1].id, "img_url", "列表应保留有效 url 兜底记录");

const stored = normalizeStoredImageAsset({
  id: "img_stored",
  originalUrl: "https://example.com/stored.jpg",
  uploadedAt: 1
});
assertEqual(stored.usedCount, 0, "本地旧图片缓存应补齐 usedCount");

const merged = mergeImageUsageMetadata(
  {
    id: "img_merge",
    originalUrl: "https://example.com/new.jpg",
    thumbUrl: "https://example.com/new-thumb.jpg",
    uploadedAt: 10,
    usedCount: 0
  },
  {
    id: "img_merge",
    originalUrl: "https://example.com/old.jpg",
    uploadedAt: 1,
    recentUsedAt: 9,
    usedCount: 4,
    lastUsedDimensionKey: "academic",
    lastUsedSectionKey: "extension",
    lastUsedItemId: "paper-patent"
  }
);
assertEqual(merged.originalUrl, "https://example.com/new.jpg", "合并时应保留新图片基础信息");
assertEqual(merged.recentUsedAt, 9, "新图片缺少最近使用时间时应沿用本地元信息");
assertEqual(merged.usedCount, 4, "新图片使用次数为 0 时应沿用本地使用次数");
assertEqual(merged.lastUsedItemId, "paper-patent", "新图片缺少最近使用条目时应沿用本地元信息");

const proofImage = imageAssetToProofImage(normalized);
assertEqual(proofImage.id, "img_1", "ProofImage 应保留图片 ID");
assertEqual(proofImage.url, normalized.originalUrl, "ProofImage url 应使用 originalUrl");
assertEqual(proofImage.thumbUrl, normalized.thumbUrl, "ProofImage thumbUrl 应使用图片缩略图");
assertEqual(proofImage.uploaded, true, "图片库复用图片应标记为已上传");

console.log("图片库归一化测试通过。");
