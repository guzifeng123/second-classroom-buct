const fs = require("node:fs");
const path = require("node:path");

const PAGE_TYPES = {
  SHELL: "shell",
  DETAIL: "detail",
  STATUS: "status"
};

const PAGE_MATRIX = [
  { route: "pages/login/index", name: "登录页", type: PAGE_TYPES.SHELL, smoke: true },
  { route: "pages/evaluation/index", name: "评定页", type: PAGE_TYPES.SHELL, smoke: true },
  { route: "pages/evaluation/preview/index", name: "提交前预览页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/note/list/index", name: "图文材料列表页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/note/edit/index", name: "图文编辑页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/note/snapshot/index", name: "图文快照页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/image/library/index", name: "图片库页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/submission/result/index", name: "提交结果页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/submission/history/index", name: "提交历史页", type: PAGE_TYPES.DETAIL, smoke: true },
  { route: "pages/error/index", name: "状态说明页", type: PAGE_TYPES.STATUS, smoke: true }
];

function normalizePageSpec(spec) {
  return {
    ...spec,
    h5Detail: spec.type === PAGE_TYPES.DETAIL
  };
}

function describePageSpec(spec) {
  return `${spec.name}（${spec.route}，${spec.type}）`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readProjectFile(projectRoot, relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  assert(fs.existsSync(filePath), `缺少文件：${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function parseAppPages(appConfig) {
  const pagesMatch = appConfig.match(/pages:\s*\[([\s\S]*?)\]/);
  assert(pagesMatch, "app.config.ts 缺少 pages 配置");

  return Array.from(pagesMatch[1].matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

function parseDocsPageEntries(docsIndex) {
  const sectionMatch = docsIndex.match(/## 当前页面入口([\s\S]*?)(?:\n## |$)/);
  assert(sectionMatch, "docs/00-index.md 缺少当前页面入口内容");

  const entries = Array.from(sectionMatch[1].matchAll(/\|\s*([^|\n]+?)\s*\|\s*`([^`]+)`\s*\|/g)).map((match) => ({
    name: match[1].trim(),
    route: match[2].trim()
  }));
  assert(entries.length > 0, "docs/00-index.md 当前页面入口表格为空");

  return entries;
}

function parseH5DetailRoutes(detailNavigation) {
  const routesMatch = detailNavigation.match(/H5_DETAIL_ROUTES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert(routesMatch, "detailNavigation.ts 缺少 H5_DETAIL_ROUTES 配置");

  return Array.from(routesMatch[1].matchAll(/"([^"]+)"/g)).map((match) => match[1].replace(/^\//, ""));
}

function getPageMatrix(projectRoot) {
  const appConfig = readProjectFile(projectRoot, path.join("src", "app.config.ts"));
  const docsIndex = readProjectFile(projectRoot, path.join("docs", "00-index.md"));
  const detailNavigation = readProjectFile(projectRoot, path.join("src", "utils", "detailNavigation.ts"));

  return {
    pages: parseAppPages(appConfig),
    pageEntries: parseDocsPageEntries(docsIndex),
    h5DetailRoutes: parseH5DetailRoutes(detailNavigation),
    pageSpecs: PAGE_MATRIX.map(normalizePageSpec)
  };
}

module.exports = {
  PAGE_MATRIX,
  PAGE_TYPES,
  assert,
  describePageSpec,
  getPageMatrix,
  normalizePageSpec,
  parseAppPages,
  parseDocsPageEntries,
  parseH5DetailRoutes,
  readProjectFile
};
