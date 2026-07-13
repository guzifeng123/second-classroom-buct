const path = require("node:path");
const { assert, getPageMatrix, readProjectFile } = require("./utils/page-matrix");

const projectRoot = path.resolve(__dirname, "..");
const snapshotRoute = "pages/note/snapshot/index";

const { pages, h5DetailRoutes } = getPageMatrix(projectRoot);
const snapshotPage = readProjectFile(projectRoot, path.join("src", "pages", "note", "snapshot", "index.tsx"));
const h5Checklist = readProjectFile(projectRoot, path.join("docs", "h5-smoke-checklist.md"));
const rnChecklist = readProjectFile(projectRoot, path.join("docs", "rn-smoke-checklist.md"));

assert(pages.includes(snapshotRoute), "app.config.ts 未注册图文快照页路由");
assert(h5DetailRoutes.includes(snapshotRoute), "H5 详情路由白名单缺少图文快照页");
assert(snapshotPage.includes("snapshotKey"), "图文快照页应优先读取 URL snapshotKey");
assert(snapshotPage.includes("NOTE_SNAPSHOT_STORAGE_KEY"), "图文快照页应保留最近快照 key 兜底");
assert(snapshotPage.includes("enableImagePreview"), "图文快照页应开启图片预览能力");

["图文材料引用", "快照页", "图片预览", "固定占位"].forEach((keyword) => {
  assert(h5Checklist.includes(keyword), `H5 smoke 清单缺少图文快照验收关键词：${keyword}`);
});

["图文快照", "图片占位", "横向溢出"].forEach((keyword) => {
  assert(rnChecklist.includes(keyword), `RN smoke 清单缺少图文快照验收关键词：${keyword}`);
});

console.log("图文快照路由与验收校验通过。");
