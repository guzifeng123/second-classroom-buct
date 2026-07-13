const fs = require("node:fs");
const path = require("node:path");
const { assert, describePageSpec, getPageMatrix, readProjectFile } = require("./utils/page-matrix");

const projectRoot = path.resolve(__dirname, "..");
const docsIndex = readProjectFile(projectRoot, path.join("docs", "00-index.md"));
const architecture = readProjectFile(projectRoot, path.join("docs", "01-framework-architecture.md"));
const h5Smoke = readProjectFile(projectRoot, path.join("docs", "h5-smoke-checklist.md"));
const rnSmoke = readProjectFile(projectRoot, path.join("docs", "rn-smoke-checklist.md"));
const { pages, pageEntries, h5DetailRoutes, pageSpecs } = getPageMatrix(projectRoot);
const expectedH5DetailRoutes = pageSpecs.filter((spec) => spec.h5Detail).map((spec) => spec.route);

assert(docsIndex.includes("## 当前页面入口"), "docs/00-index.md 缺少当前页面入口章节");
assert(docsIndex.includes("页面以 `src/app.config.ts` 为准"), "docs/00-index.md 应声明页面以 app.config.ts 为准");
assert(architecture.includes("## 页面结构"), "docs/01-framework-architecture.md 缺少页面结构章节");
assert(architecture.includes("页面由 `src/app.config.ts` 注册"), "docs/01-framework-architecture.md 应声明页面由 app.config.ts 注册");
assert(h5Smoke.includes("## 验收流程"), "docs/h5-smoke-checklist.md 缺少验收流程章节");
assert(rnSmoke.includes("## 验收流程"), "docs/rn-smoke-checklist.md 缺少验收流程章节");

pages.forEach((route) => {
  assert(pageEntries.some((entry) => entry.route === route), `docs/00-index.md 当前页面入口缺少路由：${route}`);
});

pageSpecs.forEach(({ route }) => {
  assert(pages.includes(route), `页面矩阵包含未注册页面：${route}`);
});

pages.forEach((route) => {
  assert(pageSpecs.some((spec) => spec.route === route), `页面矩阵缺少注册页面：${route}`);
});

h5DetailRoutes.forEach((route) => {
  const spec = pageSpecs.find((item) => item.route === route);
  assert(pages.includes(route), `H5 详情路由白名单包含未注册页面：/${route}`);
  assert(spec?.h5Detail, `H5 详情路由白名单包含非 detail 页面：${spec ? describePageSpec(spec) : `/${route}`}`);
});

expectedH5DetailRoutes.forEach((route) => {
  const spec = pageSpecs.find((item) => item.route === route);
  assert(h5DetailRoutes.includes(route), `H5 详情路由白名单缺少 detail 页面：${spec ? describePageSpec(spec) : `/${route}`}`);
});

pageEntries.forEach(({ name, route }) => {
  const spec = pageSpecs.find((item) => item.route === route);
  assert(pages.includes(route), `docs/00-index.md 当前页面入口包含未注册路由：${route}`);
  assert(spec, `页面矩阵缺少文档页面入口：${route}`);
  assert(spec.name === name, `页面矩阵名称与 docs/00-index.md 不一致：${route}`);
  assert(architecture.includes(name), `docs/01-framework-architecture.md 页面结构缺少页面名称：${name}`);
  if (spec.smoke) {
    assert(h5Smoke.includes(name), `docs/h5-smoke-checklist.md 验收流程缺少页面入口：${name}`);
    assert(rnSmoke.includes(name), `docs/rn-smoke-checklist.md 验收流程缺少页面入口：${name}`);
  }
});

pages.forEach((route) => {
  assert(docsIndex.includes(`\`${route}\``), `docs/00-index.md 当前页面入口缺少路由：${route}`);
  assert(architecture.includes(`\`${route}\``), `docs/01-framework-architecture.md 页面结构缺少路由：${route}`);

  const pageBasePath = path.join(projectRoot, "src", route);
  const pageTsxPath = `${pageBasePath}.tsx`;
  const pageScssPath = `${pageBasePath}.scss`;
  const pageRnScssPath = `${pageBasePath}.rn.scss`;

  assert(fs.existsSync(pageTsxPath), `注册页面缺少 TSX 文件：${path.relative(projectRoot, pageTsxPath)}`);
  assert(fs.existsSync(pageScssPath), `注册页面缺少 H5 样式文件：${path.relative(projectRoot, pageScssPath)}`);
  assert(fs.existsSync(pageRnScssPath), `注册页面缺少 RN 样式文件：${path.relative(projectRoot, pageRnScssPath)}`);
});

console.log("文档索引页面矩阵校验通过。");
