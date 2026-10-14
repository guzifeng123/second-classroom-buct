const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const layoutPath = path.join(projectRoot, "src", "components", "WebSplitLayout", "index.tsx");
const appStylePath = path.join(projectRoot, "src", "app.scss");

const layoutSource = fs.readFileSync(layoutPath, "utf8");
const appStyleSource = fs.readFileSync(appStylePath, "utf8");

assert.ok(
  layoutSource.includes('WEB_SPLIT_LAYOUT_MEDIA_QUERY = "(min-width: 1180px)"'),
  "WebSplitLayout 应使用与 CSS 一致的 1180px 宽屏断点"
);
assert.ok(layoutSource.includes("window.matchMedia"), "WebSplitLayout 应通过 matchMedia 判断宽屏");
assert.ok(layoutSource.includes("query.addEventListener"), "WebSplitLayout 应监听 viewport 变化");
assert.ok(layoutSource.includes("query.addListener"), "WebSplitLayout 应兼容旧版 MediaQueryList 监听 API");
assert.ok(
  layoutSource.includes("shouldMountWebSplitMaster(routePath, isWideViewport)"),
  "WebSplitLayout 应同时满足详情路由和宽屏条件才挂载 master"
);
assert.ok(
  layoutSource.includes("web-split-layout-inline"),
  "窄屏详情页应使用不命中双栏选择器的稳定 inline 容器"
);
assert.ok(
  layoutSource.includes('key="detail"'),
  "详情 children 应放在稳定 key 的容器中，避免断点切换时重挂载"
);
assert.ok(
  layoutSource.includes('key="master"'),
  "宽屏 master 应使用稳定 key，避免影响详情容器保活"
);
assert.ok(
  layoutSource.includes("lazy(() => import(\"../../pages/evaluation\"))"),
  "评定页 master 应保持懒加载"
);
assert.ok(appStyleSource.includes("@media (min-width: 1180PX)"), "CSS 宽屏断点应保持 1180PX");

console.log("H5 双栏响应式按需加载测试通过。");
