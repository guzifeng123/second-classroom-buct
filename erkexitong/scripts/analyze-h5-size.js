const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distRoot = process.env.H5_SIZE_DIST_ROOT
  ? path.resolve(projectRoot, process.env.H5_SIZE_DIST_ROOT)
  : path.join(projectRoot, "dist");
const recommendedLimitBytes = 244 * 1024;
const moduleReportLimit = 8;
const groupReportLimit = 8;
const jsonArgIndex = process.argv.indexOf("--json");
const shouldWriteJson = jsonArgIndex >= 0 || Boolean(process.env.H5_SIZE_JSON);
const jsonReportPath = resolveJsonReportPath();
const assetHintMarkers = [
  { label: "评定页", markers: ["evaluation-page", "evaluation-workspace", "evaluation-admin"] },
  { label: "图片库页", markers: ["image-library", "图片库", "图片与附件库"] },
  { label: "图文编辑页", markers: ["note-edit", "NoteContentRenderer", "图文"] },
  { label: "图文列表页", markers: ["note-list", "图文材料"] },
  { label: "提交历史页", markers: ["submission-history", "提交记录"] },
  { label: "提交结果页", markers: ["submission-result", "提交结果"] },
  { label: "登录页", markers: ["login-page", "login-card"] },
  { label: "证明材料编辑器", markers: ["proof-item", "UploadImageButton", "证明图片"] }
];

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function resolveJsonReportPath() {
  if (process.env.H5_SIZE_JSON) {
    return path.resolve(projectRoot, process.env.H5_SIZE_JSON);
  }

  if (jsonArgIndex < 0) {
    return "";
  }

  const nextArg = process.argv[jsonArgIndex + 1];
  const isExplicitPath = nextArg && !nextArg.startsWith("--");
  return path.resolve(projectRoot, isExplicitPath ? nextArg : "dist/h5-size-report.json");
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function getRelativeAssetPath(filePath) {
  return path.relative(distRoot, filePath).replace(/\\/g, "/");
}

function getAssetRows() {
  return walkFiles(distRoot)
    .filter((filePath) => /\.(js|css)$/.test(filePath))
    .map((filePath) => ({
      path: getRelativeAssetPath(filePath),
      size: fs.statSync(filePath).size,
      hints: getAssetHints(filePath),
      sourceMap: getSourceMapStats(filePath)
    }))
    .sort((left, right) => right.size - left.size);
}

function getAssetHints(filePath) {
  if (!filePath.endsWith(".js")) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  return assetHintMarkers
    .filter((hint) => hint.markers.some((marker) => content.includes(marker)))
    .map((hint) => hint.label);
}

function normalizeSourceName(source) {
  return source
    .replace(/^webpack:\/\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\?.*$/, "")
    .replace(/\\/g, "/");
}

function getSourceMapPath(filePath) {
  const inlineMapPath = `${filePath}.map`;

  if (fs.existsSync(inlineMapPath)) {
    return inlineMapPath;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/\/\/# sourceMappingURL=(.+)$/m);

  if (!match) {
    return "";
  }

  const mapPath = path.resolve(path.dirname(filePath), match[1]);
  return fs.existsSync(mapPath) ? mapPath : "";
}

function getSourceGroup(sourcePath) {
  const normalizedPath = sourcePath.replace(/^.*?node_modules\//, "node_modules/");
  const nodeModulesMatch = normalizedPath.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/);

  if (nodeModulesMatch) {
    return `npm:${nodeModulesMatch[1]}`;
  }

  const pageMatch = normalizedPath.match(/(?:^|\/)src\/pages\/([^/]+\/[^/]+)/);

  if (pageMatch) {
    return `page:${pageMatch[1]}`;
  }

  const componentMatch = normalizedPath.match(/(?:^|\/)src\/components\/([^/]+)/);

  if (componentMatch) {
    return `component:${componentMatch[1]}`;
  }

  const serviceMatch = normalizedPath.match(/(?:^|\/)src\/services\/([^/]+)/);

  if (serviceMatch) {
    return `service:${serviceMatch[1]}`;
  }

  const storeMatch = normalizedPath.match(/(?:^|\/)src\/stores\/([^/]+)/);

  if (storeMatch) {
    return `store:${storeMatch[1]}`;
  }

  const utilsMatch = normalizedPath.match(/(?:^|\/)src\/utils\/([^/]+)/);

  if (utilsMatch) {
    return `utils:${utilsMatch[1]}`;
  }

  return normalizedPath.includes("/src/") || normalizedPath.startsWith("src/") ? "app:other-src" : "other";
}

function sortBySize(left, right) {
  return right.size - left.size;
}

function getSourceMapStats(filePath) {
  if (!filePath.endsWith(".js")) {
    return { modules: [], groups: [] };
  }

  const mapPath = getSourceMapPath(filePath);

  if (!mapPath) {
    return { modules: [], groups: [] };
  }

  try {
    const sourceMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
    const sourcesContent = Array.isArray(sourceMap.sourcesContent) ? sourceMap.sourcesContent : [];

    const modules = sources
      .map((source, index) => ({
        path: normalizeSourceName(source),
        size: sourcesContent[index]?.length ?? 0
      }))
      .filter((module) => module.size > 0);

    const groupSizeMap = modules.reduce((groups, module) => {
      const group = getSourceGroup(module.path);
      groups.set(group, (groups.get(group) ?? 0) + module.size);
      return groups;
    }, new Map());

    return {
      modules: [...modules].sort(sortBySize).slice(0, moduleReportLimit),
      groups: [...groupSizeMap.entries()]
        .map(([group, size]) => ({ group, size }))
        .sort(sortBySize)
        .slice(0, groupReportLimit)
    };
  } catch (error) {
    return {
      modules: [{ path: `sourcemap 解析失败：${error.message}`, size: 0 }],
      groups: []
    };
  }
}

function getEntrypointAssets() {
  const indexPath = path.join(distRoot, "index.html");

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const assets = [];
  const assetPattern = /(?:src|href)="([^"]+\.(?:js|css))"/g;
  let match = assetPattern.exec(html);

  while (match) {
    const assetPath = match[1].replace(/^\//, "");
    const absolutePath = path.join(distRoot, assetPath);

    if (fs.existsSync(absolutePath)) {
      assets.push({
        path: assetPath,
        size: fs.statSync(absolutePath).size,
        hints: getAssetHints(absolutePath)
      });
    }

    match = assetPattern.exec(html);
  }

  return assets;
}

function sumSize(rows) {
  return rows.reduce((sum, row) => sum + row.size, 0);
}

function buildReport() {
  return {
    generatedAt: new Date().toISOString(),
    recommendedLimitBytes,
    totals: {
      entrypointBytes: sumSize(entrypointAssets),
      jsBytes: sumSize(jsRows),
      cssBytes: sumSize(cssRows)
    },
    entrypointAssets,
    assets: assetRows,
    oversizedAssets: oversizedRows
  };
}

function writeJsonReport() {
  if (!shouldWriteJson) {
    return;
  }

  fs.mkdirSync(path.dirname(jsonReportPath), { recursive: true });
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(buildReport(), null, 2)}\n`, "utf8");
  console.log(`\nJSON 报告：${path.relative(projectRoot, jsonReportPath).replace(/\\/g, "/")}`);
}

function printRows(title, rows) {
  console.log(`\n${title}`);

  if (rows.length === 0) {
    console.log("  无");
    return;
  }

  rows.forEach((row) => {
    const marker = row.size > recommendedLimitBytes ? " !" : "  ";
    const hints = row.hints?.length ? `  ${row.hints.join(" / ")}` : "";
    console.log(`${marker} ${row.path.padEnd(48)} ${formatKiB(row.size)}${hints}`);
  });
}

if (!fs.existsSync(distRoot)) {
  throw new Error("未找到 dist 目录，请先运行 npm.cmd run build:h5。");
}

if (!fs.existsSync(path.join(distRoot, "index.html"))) {
  throw new Error("当前 dist 不是 H5 构建产物，请先运行 npm.cmd run build:h5。");
}

const assetRows = getAssetRows();
const entrypointAssets = getEntrypointAssets();
const jsRows = assetRows.filter((row) => row.path.endsWith(".js"));
const cssRows = assetRows.filter((row) => row.path.endsWith(".css"));
const oversizedRows = assetRows.filter((row) => row.size > recommendedLimitBytes);

console.log("H5 构建体积分析");
console.log(`入口资源总量：${formatKiB(sumSize(entrypointAssets))}`);
console.log(`JS 总量：${formatKiB(sumSize(jsRows))}`);
console.log(`CSS 总量：${formatKiB(sumSize(cssRows))}`);
console.log(`推荐阈值：${formatKiB(recommendedLimitBytes)}`);

printRows("入口资源", entrypointAssets);
printRows("最大资源 Top 10", assetRows.slice(0, 10));
printRows("超过推荐阈值的资源", oversizedRows);
printModuleHints(assetRows);
printSourceGroupHints(assetRows);
writeJsonReport();

function printModuleHints(rows) {
  const rowsWithModules = rows.filter((row) => row.sourceMap.modules.length > 0);

  console.log("\n模块来源 Top");

  if (rowsWithModules.length === 0) {
    console.log("  未发现 sourcemap。需要模块级归因时，可先在 PowerShell 中运行：");
    console.log("  $env:H5_ANALYZE_SOURCEMAP='1'; npm.cmd run build:h5; npm.cmd run analyze:h5-size");
    return;
  }

  rowsWithModules.slice(0, 5).forEach((row) => {
    console.log(`  ${row.path}`);
    row.sourceMap.modules.forEach((module) => {
      const sizeLabel = module.size > 0 ? formatKiB(module.size) : "-";
      console.log(`    ${sizeLabel.padStart(10)}  ${module.path}`);
    });
  });
}

function printSourceGroupHints(rows) {
  const rowsWithGroups = rows.filter((row) => row.sourceMap.groups.length > 0);

  console.log("\n来源分组 Top");

  if (rowsWithGroups.length === 0) {
    console.log("  未发现 sourcemap。需要 package/page 归因时，可先开启 H5_ANALYZE_SOURCEMAP=1 重新构建。");
    return;
  }

  rowsWithGroups.slice(0, 5).forEach((row) => {
    console.log(`  ${row.path}`);
    row.sourceMap.groups.forEach((group) => {
      console.log(`    ${formatKiB(group.size).padStart(10)}  ${group.group}`);
    });
  });
}

if (oversizedRows.length > 0 && process.env.H5_SIZE_STRICT === "1") {
  process.exitCode = 1;
}
