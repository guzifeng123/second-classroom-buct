const path = require("node:path");
const {
  PAGE_MATRIX,
  PAGE_TYPES,
  assert,
  getPageMatrix,
  normalizePageSpec,
  parseAppPages,
  parseDocsPageEntries,
  parseH5DetailRoutes
} = require("./utils/page-matrix");

const projectRoot = path.resolve(__dirname, "..");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：预期 ${expected}，实际 ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}：预期 ${expectedJson}，实际 ${actualJson}`);
  }
}

assertDeepEqual(
  parseAppPages(`
    export default defineAppConfig({
      pages: [
        "pages/login/index",
        "pages/evaluation/index"
      ]
    });
  `),
  ["pages/login/index", "pages/evaluation/index"],
  "应解析 app.config.ts 页面列表"
);

assertDeepEqual(
  parseDocsPageEntries(`
## 当前页面入口

| 页面 | 路径 |
| --- | --- |
| 登录页 | \`pages/login/index\` |
| 评定页 | \`pages/evaluation/index\` |

## 下一节
  `),
  [
    { name: "登录页", route: "pages/login/index" },
    { name: "评定页", route: "pages/evaluation/index" }
  ],
  "应解析文档页面入口表"
);

assertDeepEqual(
  parseH5DetailRoutes(`
const H5_DETAIL_ROUTES = new Set([
  "/pages/note/list/index",
  "/pages/note/edit/index"
]);
  `),
  ["pages/note/list/index", "pages/note/edit/index"],
  "应解析 H5 详情路由白名单"
);

const { pages, pageEntries, h5DetailRoutes, pageSpecs } = getPageMatrix(projectRoot);
const configuredRoutes = PAGE_MATRIX.map((spec) => spec.route);
const normalizedSpecs = PAGE_MATRIX.map(normalizePageSpec);
const validTypes = new Set(Object.values(PAGE_TYPES));
const detailRoutes = normalizedSpecs.filter((spec) => spec.h5Detail).map((spec) => spec.route);
const shellRoutes = normalizedSpecs.filter((spec) => spec.type === PAGE_TYPES.SHELL).map((spec) => spec.route);
const statusRoutes = normalizedSpecs.filter((spec) => spec.type === PAGE_TYPES.STATUS).map((spec) => spec.route);

assertDeepEqual(pageSpecs, normalizedSpecs, "getPageMatrix 应返回派生后的统一页面矩阵配置");
assertDeepEqual(configuredRoutes, pages, "页面矩阵顺序应与 app.config.ts 注册顺序一致");
assertEqual(new Set(configuredRoutes).size, configuredRoutes.length, "页面矩阵路由不应重复");
assertEqual(new Set(PAGE_MATRIX.map((spec) => spec.name)).size, PAGE_MATRIX.length, "页面矩阵页面名称不应重复");
assert(PAGE_MATRIX.every((spec) => validTypes.has(spec.type)), "页面矩阵 type 必须是 shell/detail/status");
assert(shellRoutes.every((route) => !detailRoutes.includes(route)), "shell 页面不应进入 H5 详情路由");
assert(statusRoutes.every((route) => !detailRoutes.includes(route)), "status 页面不应进入 H5 详情路由");
assertDeepEqual(
  pageEntries.map((entry) => entry.route),
  configuredRoutes,
  "文档页面入口顺序应与页面矩阵一致"
);
assertDeepEqual(h5DetailRoutes, detailRoutes, "H5 详情路由白名单应与页面矩阵 h5Detail 标记一致");
assert(PAGE_MATRIX.every((spec) => spec.smoke), "当前注册页面都应纳入 H5/RN smoke 入口覆盖");

console.log("页面矩阵测试通过。");
