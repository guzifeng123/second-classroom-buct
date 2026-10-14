const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const projectRoot = path.resolve(__dirname, "..");
const distRoot = process.env.H5_SIZE_DIST_ROOT
  ? path.resolve(projectRoot, process.env.H5_SIZE_DIST_ROOT)
  : path.join(projectRoot, "dist", "h5");
const baselineReportPath = path.resolve(
  projectRoot,
  process.env.H5_SIZE_BASELINE_PATH ?? "scripts/baselines/h5-size.json"
);
const reportSchemaVersion = 1;
const recommendedLimitBytes = 244 * 1024;
const moduleReportLimit = 8;
const groupReportLimit = 8;
const cliArgs = process.argv.slice(2);
const jsonArgIndex = cliArgs.indexOf("--json");
const shouldUpdateBaseline = cliArgs.includes("--update-baseline");
const shouldWriteJson = shouldUpdateBaseline || jsonArgIndex >= 0 || Boolean(process.env.H5_SIZE_JSON);
const environmentProfile =
  process.env.H5_SIZE_ENV_PROFILE ??
  (process.env.TARO_APP_API_BASE_URL || process.env.TARO_APP_WS_BASE_URL ? "custom-api" : "default-no-api");
const gzipOptions = { level: 9 };
const brotliOptions = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC
  }
};
const compression = {
  aggregation: "sum-of-assets",
  runtime: {
    node: process.version,
    zlib: process.versions.zlib ?? "unknown",
    brotli: process.versions.brotli ?? "unknown"
  },
  gzip: {
    algorithm: "gzip",
    level: gzipOptions.level
  },
  brotli: {
    algorithm: "brotli",
    quality: 11,
    mode: "generic"
  }
};
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

validateCliArgs();

if (shouldUpdateBaseline && (jsonArgIndex >= 0 || process.env.H5_SIZE_JSON)) {
  throw new Error("更新 H5 体积基线时不要同时传入 --json 或 H5_SIZE_JSON。");
}

const jsonReportPath = resolveJsonReportPath();

if (
  shouldWriteJson &&
  !shouldUpdateBaseline &&
  isSameOrInsideDirectory(path.resolve(jsonReportPath), path.dirname(path.resolve(baselineReportPath)))
) {
  throw new Error("普通体积分析不得写入受控 baseline 目录；请显式运行 npm.cmd run update:h5-size-baseline。");
}

function validateCliArgs() {
  const unknownFlags = cliArgs.filter(
    (arg) => arg.startsWith("--") && arg !== "--json" && arg !== "--update-baseline"
  );

  if (unknownFlags.length > 0) {
    throw new Error(`未知参数：${unknownFlags.join(", ")}。`);
  }

  if (shouldUpdateBaseline) {
    if (cliArgs.length !== 1) {
      throw new Error("用法：node scripts/analyze-h5-size.js --update-baseline");
    }
    return;
  }

  if (jsonArgIndex >= 0) {
    const nextArg = cliArgs[jsonArgIndex + 1];
    const expectedLength = nextArg && !nextArg.startsWith("--") ? 2 : 1;

    if (jsonArgIndex !== 0 || cliArgs.length !== expectedLength) {
      throw new Error("用法：node scripts/analyze-h5-size.js [--json [report.json]]");
    }
    return;
  }

  if (cliArgs.length > 0) {
    throw new Error("用法：node scripts/analyze-h5-size.js [--json [report.json]]");
  }
}

function isSameOrInsideDirectory(filePath, directoryPath) {
  const relativePath = path.relative(directoryPath, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatMetricSet(metrics) {
  return `${formatKiB(metrics.rawBytes)} raw / ${formatKiB(metrics.gzipBytes)} gzip / ${formatKiB(
    metrics.brotliBytes
  )} Brotli`;
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function resolveJsonReportPath() {
  if (shouldUpdateBaseline) {
    return baselineReportPath;
  }

  if (process.env.H5_SIZE_JSON) {
    return path.resolve(projectRoot, process.env.H5_SIZE_JSON);
  }

  if (jsonArgIndex < 0) {
    return "";
  }

  const nextArg = cliArgs[jsonArgIndex + 1];
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
  return normalizePath(path.relative(distRoot, filePath));
}

function getLogicalKey(assetPath) {
  const normalizedPath = normalizePath(assetPath).replace(/[?#].*$/, "");

  if (
    normalizedPath.startsWith("/") ||
    /^[a-z]:\//i.test(normalizedPath) ||
    normalizedPath.split("/").includes("..")
  ) {
    throw new Error(`资源路径必须是 dist 内的 POSIX 相对路径：${assetPath}`);
  }

  const extension = path.posix.extname(normalizedPath);
  const stem = normalizedPath.slice(0, -extension.length);
  const normalizedStem = stem.replace(/\.[a-f0-9]{8,64}$/i, "");
  const chunkName = path.posix.basename(normalizedStem);
  const routePath = routeChunkMap.get(chunkName);

  if (routePath) {
    return `route/${routePath}${extension}`;
  }

  return `${normalizedStem}${extension}`;
}

function getRouteChunkMap() {
  const routes = new Map();
  const routeChunkPattern = /["']path["']\s*:\s*["']([^"']+)["'][\s\S]{0,240}?\.e\((\d+)\)/g;

  walkFiles(distRoot)
    .filter((filePath) => filePath.endsWith(".js"))
    .forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      let match = routeChunkPattern.exec(content);

      while (match) {
        const [, routePath, chunkName] = match;
        const existingRoute = routes.get(chunkName);

        if (existingRoute && existingRoute !== routePath) {
          throw new Error(`路由 chunk ${chunkName} 同时映射到 ${existingRoute} 和 ${routePath}。`);
        }

        routes.set(chunkName, routePath);
        match = routeChunkPattern.exec(content);
      }

      routeChunkPattern.lastIndex = 0;
    });

  return routes;
}

function getAssetType(assetPath) {
  return assetPath.endsWith(".css") ? "css" : "js";
}

function getCompressedMetrics(content) {
  return {
    rawBytes: content.length,
    gzipBytes: zlib.gzipSync(content, gzipOptions).length,
    brotliBytes: zlib.brotliCompressSync(content, brotliOptions).length
  };
}

function getAssetRows() {
  const rows = walkFiles(distRoot)
    .filter((filePath) => /\.(js|css)$/.test(filePath))
    .map((filePath) => {
      const assetPath = getRelativeAssetPath(filePath);
      const content = fs.readFileSync(filePath);

      return {
        path: assetPath,
        logicalKey: getLogicalKey(assetPath),
        type: getAssetType(assetPath),
        ...getCompressedMetrics(content),
        hints: getAssetHints(filePath, content),
        sourceMap: getSourceMapStats(filePath)
      };
    })
    .sort((left, right) => right.rawBytes - left.rawBytes || left.path.localeCompare(right.path));

  const logicalKeys = new Set();

  rows.forEach((row) => {
    if (logicalKeys.has(row.logicalKey)) {
      throw new Error(`资源 logicalKey 重复：${row.logicalKey}。请清理旧构建产物或调整 logicalKey 规则。`);
    }

    logicalKeys.add(row.logicalKey);
  });

  return rows;
}

function getAssetHints(filePath, contentBuffer) {
  if (!filePath.endsWith(".js")) {
    return [];
  }

  const content = contentBuffer ? contentBuffer.toString("utf8") : fs.readFileSync(filePath, "utf8");
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

function getEntrypointAssets(rows) {
  const indexPath = path.join(distRoot, "index.html");

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const rowsByPath = new Map(rows.map((row) => [row.path, row]));
  const seenPaths = new Set();
  const assets = [];
  const assetPattern = /(?:src|href)=["']([^"']+)["']/g;
  let match = assetPattern.exec(html);

  while (match) {
    const assetPath = match[1].replace(/[?#].*$/, "").replace(/^\/+/, "").replace(/^\.\//, "");
    const row = rowsByPath.get(assetPath);

    if (row && !seenPaths.has(assetPath)) {
      const { sourceMap: _sourceMap, ...entrypointAsset } = row;
      assets.push(entrypointAsset);
      seenPaths.add(assetPath);
    }

    match = assetPattern.exec(html);
  }

  return assets;
}

function sumMetrics(rows) {
  return rows.reduce(
    (totals, row) => ({
      rawBytes: totals.rawBytes + row.rawBytes,
      gzipBytes: totals.gzipBytes + row.gzipBytes,
      brotliBytes: totals.brotliBytes + row.brotliBytes
    }),
    { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 }
  );
}

function buildReport() {
  return {
    schemaVersion: reportSchemaVersion,
    generatedAt: new Date().toISOString(),
    build: {
      target: "h5",
      mode: process.env.H5_SIZE_BUILD_MODE ?? "production",
      outputRoot: normalizePath(path.relative(projectRoot, distRoot)),
      sourceMaps: assetRows.some((row) => row.sourceMap.modules.length > 0),
      environmentProfile
    },
    compression,
    recommendedLimitBytes,
    totals: {
      entrypoint: sumMetrics(entrypointAssets),
      js: sumMetrics(jsRows),
      css: sumMetrics(cssRows)
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
  const temporaryPath = `${jsonReportPath}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(buildReport(), null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, jsonReportPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  const outputLabel = shouldUpdateBaseline ? "受控 baseline" : "JSON 报告";
  console.log(`\n${outputLabel}：${normalizePath(path.relative(projectRoot, jsonReportPath))}`);
}

function printRows(title, rows) {
  console.log(`\n${title}`);

  if (rows.length === 0) {
    console.log("  无");
    return;
  }

  rows.forEach((row) => {
    const marker = row.rawBytes > recommendedLimitBytes ? " !" : "  ";
    const hints = row.hints?.length ? `  ${row.hints.join(" / ")}` : "";
    const logicalKey = row.path === row.logicalKey ? "" : `  [${row.logicalKey}]`;
    console.log(`${marker} ${row.path.padEnd(48)} ${formatMetricSet(row)}${logicalKey}${hints}`);
  });
}

if (!fs.existsSync(distRoot)) {
  throw new Error("未找到 dist 目录，请先运行 npm.cmd run build:h5。");
}

if (!fs.existsSync(path.join(distRoot, "index.html"))) {
  throw new Error("当前 dist 不是 H5 构建产物（默认路径为 dist/h5），请先运行 npm.cmd run build:h5。");
}

const routeChunkMap = getRouteChunkMap();
const assetRows = getAssetRows();
const entrypointAssets = getEntrypointAssets(assetRows);
const jsRows = assetRows.filter((row) => row.type === "js");
const cssRows = assetRows.filter((row) => row.type === "css");
const oversizedRows = assetRows.filter((row) => row.rawBytes > recommendedLimitBytes);

if (shouldUpdateBaseline && assetRows.some((row) => row.sourceMap.modules.length > 0)) {
  throw new Error("受控 H5 体积 baseline 必须来自不含 sourcemap 的 production 构建。");
}

console.log("H5 构建体积分析");
console.log(`构建目标：h5 / ${process.env.H5_SIZE_BUILD_MODE ?? "production"} / ${environmentProfile}`);
console.log(`入口资源总量：${formatMetricSet(sumMetrics(entrypointAssets))}`);
console.log(`JS 总量：${formatMetricSet(sumMetrics(jsRows))}`);
console.log(`CSS 总量：${formatMetricSet(sumMetrics(cssRows))}`);
console.log(`单资源 raw 推荐阈值：${formatKiB(recommendedLimitBytes)}`);

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
