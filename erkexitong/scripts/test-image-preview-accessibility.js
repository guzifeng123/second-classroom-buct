const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(...segments) {
  return fs.readFileSync(path.join(projectRoot, ...segments), "utf8");
}

const triggerSource = readProjectFile("src", "components", "ImagePreviewTrigger", "index.h5.tsx");
const imageLibraryStyle = readProjectFile("src", "pages", "image", "library", "index.scss");
const imagePreviewSource = readProjectFile("src", "components", "ImagePreview", "index.h5.tsx");
const smokeFlowSource = readProjectFile("scripts", "utils", "h5-smoke-browser-flow.js");

assert.ok(triggerSource.includes('<button type="button"'), "H5 图片预览触发器应使用原生 button");
assert.ok(triggerSource.includes("aria-label={ariaLabel}"), "H5 图片预览触发器应提供可访问名称");
assert.ok(
  imageLibraryStyle.includes(".image-library__asset:focus-visible"),
  "图片库预览触发器应提供可见键盘焦点样式"
);
assert.ok(imagePreviewSource.includes("const PRELOAD_RADIUS = 1"), "H5 图片预览应只预取邻近图片");
assert.ok(imagePreviewSource.includes("preloadedImagesRef"), "H5 图片预览应复用受限预取缓存");
assert.ok(imagePreviewSource.includes("new window.Image()"), "H5 图片预览应通过浏览器图片对象预取");
assert.ok(
  imagePreviewSource.includes("preloadedImagesRef.current.delete"),
  "H5 图片预览应清理非邻近预取缓存"
);
assert.ok(smokeFlowSource.includes('firstAsset.press("Enter")'), "H5 smoke 应验证 Enter 打开图片预览");
assert.ok(smokeFlowSource.includes('firstAsset.press("Space")'), "H5 smoke 应验证 Space 打开图片预览");
assert.ok(
  smokeFlowSource.includes('firstAsset.getAttribute("aria-label")'),
  "H5 smoke 应验证图片预览触发器可访问名称"
);

console.log("图片预览加载与可访问性测试通过。");
