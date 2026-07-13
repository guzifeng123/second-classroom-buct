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

function assertThrows(fn, expectedMessage, message) {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error, `${message}：应抛出 Error`);
    assert(error.message.includes(expectedMessage), `${message}：错误信息应包含 ${expectedMessage}`);
    return;
  }

  throw new Error(`${message}：应抛出异常`);
}

const {
  formatFileSize,
  getSafeImageFileName,
  getPathExtension,
  localFilesToProofImages,
  normalizeUploadResponse,
  precheckLocalImages,
  uploadedToProofImage
} = loadTsModule(path.join(projectRoot, "src", "utils", "uploadNormalization.ts"));

assertEqual(formatFileSize(undefined), "未知大小", "缺少大小时应显示未知大小");
assertEqual(formatFileSize(512), "1KB", "小于 1KB 的文件应向上显示为 1KB");
assertEqual(formatFileSize(2048), "2KB", "KB 文件应按 KB 显示");
assertEqual(formatFileSize(5 * 1024 * 1024), "5.0MB", "MB 文件应按一位小数显示");

assertEqual(getPathExtension("tmp/photo.JPG?token=abc"), ".jpg", "扩展名应忽略 query 并转小写");
assertEqual(getPathExtension("tmp/photo"), "", "无扩展名路径应返回空字符串");
assertEqual(
  getSafeImageFileName("C:\\Users\\demo\\Pictures\\activity-proof.jpg"),
  "activity-proof.jpg",
  "安全文件名不应展示 Windows 本地目录"
);
assertEqual(
  getSafeImageFileName("/tmp/mobile/very-long-proof-image-name-20260710.png?token=abc"),
  "very-long…0710.png",
  "长文件名应截断并忽略 query"
);
assertEqual(getSafeImageFileName("", "图片 1"), "图片 1", "空路径应使用兜底名称");

const precheck = precheckLocalImages([
  { path: "tmp/a.jpg", size: 1024 },
  { path: "tmp/b.gif", size: 1024 },
  { path: "tmp/c.png", size: 6 * 1024 * 1024 },
  { path: "tmp/d.bmp", size: 7 * 1024 * 1024 }
]);
assertEqual(precheck.accepted.length, 4, "预检不应丢弃用户已选择文件");
assertEqual(precheck.issues.length, 4, "不支持格式和超大图片都应产生问题");
assert(precheck.issues.some((issue) => issue.filePath === "tmp/b.gif"), "GIF 应提示格式风险");
assert(precheck.issues.some((issue) => issue.filePath === "tmp/c.png"), "超 5MB 图片应提示大小风险");

const snakeCaseUpload = normalizeUploadResponse(
  JSON.stringify({
    id: "uploaded_1",
    original_url: "https://example.com/original.jpg",
    thumb_url: "https://example.com/thumb.jpg",
    width: 800,
    height: 600,
    size: 123456
  })
);
assertEqual(snakeCaseUpload.id, "uploaded_1", "上传响应应保留 ID");
assertEqual(snakeCaseUpload.originalUrl, "https://example.com/original.jpg", "蛇形 original_url 应归一化");
assertEqual(snakeCaseUpload.thumbUrl, "https://example.com/thumb.jpg", "蛇形 thumb_url 应归一化");
assertEqual(snakeCaseUpload.width, 800, "上传响应宽度应保留");

const camelCaseUpload = normalizeUploadResponse(
  JSON.stringify({
    originalUrl: "https://example.com/camel.jpg",
    thumbUrl: "https://example.com/camel-thumb.jpg"
  })
);
assert(camelCaseUpload.id.startsWith("uploaded_"), "缺少上传 ID 时应生成 uploaded 前缀 ID");
assertEqual(camelCaseUpload.originalUrl, "https://example.com/camel.jpg", "驼峰 originalUrl 应归一化");
assertThrows(
  () => normalizeUploadResponse(JSON.stringify({ id: "missing_url" })),
  "original_url",
  "缺少原图 URL 的上传响应应抛错"
);

const localProofImages = localFilesToProofImages([{ path: "tmp/local.png", size: 4096 }]);
assertEqual(localProofImages.length, 1, "本地文件应转换为证明图片");
assert(localProofImages[0].id.startsWith("image_"), "本地证明图片应生成 image 前缀 ID");
assertEqual(localProofImages[0].url, "tmp/local.png", "本地证明图片 URL 应使用本地路径");
assertEqual(localProofImages[0].uploaded, false, "本地证明图片应标记为未上传");

const proofImage = uploadedToProofImage(snakeCaseUpload);
assertEqual(proofImage.id, "uploaded_1", "已上传证明图片应保留 ID");
assertEqual(proofImage.url, snakeCaseUpload.originalUrl, "已上传证明图片 URL 应使用 originalUrl");
assertEqual(proofImage.thumbUrl, snakeCaseUpload.thumbUrl, "已上传证明图片应保留 thumbUrl");
assertEqual(proofImage.uploaded, true, "已上传证明图片应标记 uploaded");

console.log("上传响应归一化测试通过。");
