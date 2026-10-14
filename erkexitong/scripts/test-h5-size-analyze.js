const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "erkexitong-h5-analyze-"));
const cleanEnv = { ...process.env };

Object.keys(cleanEnv)
  .filter((key) => key.startsWith("H5_SIZE_"))
  .forEach((key) => delete cleanEnv[key]);

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function runAnalyze(distRoot, extraEnv = {}, args = []) {
  return spawnSync(process.execPath, ["scripts/analyze-h5-size.js", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...cleanEnv,
      H5_SIZE_DIST_ROOT: distRoot,
      ...extraEnv
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getMetrics(content) {
  const buffer = Buffer.from(content);
  return {
    rawBytes: buffer.length,
    gzipBytes: zlib.gzipSync(buffer, { level: 9 }).length,
    brotliBytes: zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC
      }
    }).length
  };
}

function assertMetrics(actual, expected, message) {
  ["rawBytes", "gzipBytes", "brotliBytes"].forEach((key) => {
    assert(actual[key] === expected[key], `${message}：${key} 应为 ${expected[key]}，实际为 ${actual[key]}。`);
  });
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

try {
  const h5Dist = path.join(tempRoot, "h5 dist 中文");
  const jsonReport = path.join(tempRoot, "reports 中文", "h5 size.json");
  const baselineReport = path.join(tempRoot, "baseline", "h5-size.json");
  const nonH5Dist = path.join(tempRoot, "weapp-dist");
  const oversizedSource = "a".repeat(245 * 1024);
  const sourceMapModule = "b".repeat(10 * 1024);
  const appContent = [
    'Object.assign({"path":"pages/image/library/index","load":function load(){return[s.e(383).then(s.bind(s,6383))]}});',
    'console.log("evaluation-page proof-item");',
    oversizedSource,
    "//# sourceMappingURL=app.aaaaaaaa.js.map",
    ""
  ].join("\n");
  const routeContent = "console.log('image-library');";
  const featureContent = "console.log('feature');";
  const cssContent = ".app{color:#123456;}";

  writeFile(
    path.join(h5Dist, "index.html"),
    '<html><head><link href="/css/app.0123456789abcdef0123.css?build=1" rel="stylesheet"></head><body><script src="./js/app.aaaaaaaa.js#entry"></script></body></html>'
  );
  writeFile(path.join(h5Dist, "css", "app.0123456789abcdef0123.css"), cssContent);
  writeFile(path.join(h5Dist, "js", "app.aaaaaaaa.js"), appContent);
  writeFile(
    path.join(h5Dist, "js", "app.aaaaaaaa.js.map"),
    JSON.stringify({
      version: 3,
      sources: [
        "webpack://./src/pages/evaluation/index.tsx",
        "webpack://./node_modules/@tarojs/components/dist/components/taro-swiper-core.js"
      ],
      sourcesContent: [sourceMapModule, oversizedSource],
      mappings: ""
    })
  );
  writeFile(path.join(h5Dist, "js", "383.11111111.js"), routeContent);
  writeFile(path.join(h5Dist, "js", "feature.bbbbbbbb.js"), featureContent);
  writeFile(path.join(nonH5Dist, "app.js"), "console.log('mini');");

  const jsonResult = runAnalyze(h5Dist, { H5_SIZE_JSON: jsonReport }, ["--json"]);
  assert(jsonResult.status === 0, `H5 fixture 分析应通过：${jsonResult.stderr}`);
  assert(jsonResult.stdout.includes("H5 构建体积分析"), "应输出 H5 体积分析标题。");
  assert(jsonResult.stdout.includes("Brotli"), "控制台应同时输出 Brotli 尺寸。");
  assert(jsonResult.stdout.includes("来源分组 Top"), "应输出 sourcemap 来源分组。");
  assert(fs.existsSync(jsonReport), "应写入 JSON 报告。");

  const report = JSON.parse(fs.readFileSync(jsonReport, "utf8"));
  assert(report.schemaVersion === 1, "报告应写入 schemaVersion=1。");
  assert(report.build.target === "h5", "报告应记录 H5 构建目标。");
  assert(report.build.mode === "production", "报告应记录 production 构建模式。");
  assert(report.build.sourceMaps === true, "fixture 含 sourcemap 时应记录 sourceMaps=true。");
  assert(report.build.environmentProfile === "default-no-api", "报告应记录构建环境 profile。");
  assert(report.compression.aggregation === "sum-of-assets", "报告应声明逐资源压缩后求和。");
  assert(report.compression.gzip.level === 9, "报告应记录 gzip level=9。");
  assert(report.compression.brotli.quality === 11, "报告应记录 Brotli quality=11。");
  assert(report.compression.brotli.mode === "generic", "报告应记录 Brotli generic 模式。");
  assert(typeof report.compression.runtime.node === "string", "报告应记录 Node 运行时。");
  assert(typeof report.compression.runtime.zlib === "string", "报告应记录 zlib 运行时。");
  assert(typeof report.compression.runtime.brotli === "string", "报告应记录 Brotli 运行时。");
  assert(report.entrypointAssets.length === 2, "应识别带 query/hash 的入口 JS/CSS。");

  const appAsset = report.assets.find((asset) => asset.path === "js/app.aaaaaaaa.js");
  const cssAsset = report.assets.find((asset) => asset.type === "css");
  const routeAsset = report.assets.find((asset) => asset.path === "js/383.11111111.js");
  assert(appAsset?.logicalKey === "js/app.js", "8 位 JS content hash 应从 logicalKey 移除。");
  assert(cssAsset?.logicalKey === "css/app.css", "20 位 CSS content hash 应从 logicalKey 移除。");
  assert(
    routeAsset?.logicalKey === "route/pages/image/library/index.js",
    "数字路由 chunk 应映射为稳定路由 logicalKey。"
  );
  assertMetrics(appAsset, getMetrics(appContent), "app.js 三尺寸不正确");
  assertMetrics(cssAsset, getMetrics(cssContent), "app.css 三尺寸不正确");
  assertMetrics(routeAsset, getMetrics(routeContent), "路由 chunk 三尺寸不正确");
  assertMetrics(
    report.totals.entrypoint,
    sumMetrics([getMetrics(appContent), getMetrics(cssContent)]),
    "入口汇总三尺寸不正确"
  );
  assertMetrics(
    report.totals.js,
    sumMetrics([getMetrics(appContent), getMetrics(routeContent), getMetrics(featureContent)]),
    "JS 汇总三尺寸不正确"
  );
  assertMetrics(report.totals.css, getMetrics(cssContent), "CSS 汇总三尺寸不正确");
  assert(
    appAsset.sourceMap.groups.some((group) => group.group === "npm:@tarojs/components"),
    "JSON 应包含 sourcemap npm 来源分组。"
  );
  assert(report.oversizedAssets.some((asset) => asset.logicalKey === "js/app.js"), "应识别超过推荐阈值的资源。");

  const strictResult = runAnalyze(h5Dist, { H5_SIZE_STRICT: "1" });
  assert(strictResult.status === 1, "严格模式遇到 raw 超阈值资源应失败。");

  const protectedResult = runAnalyze(
    h5Dist,
    { H5_SIZE_BASELINE_PATH: baselineReport },
    ["--json", baselineReport]
  );
  assert(protectedResult.status !== 0, "普通 --json 不得覆盖受控 baseline。");
  assert(protectedResult.stderr.includes("普通体积分析不得写入受控 baseline 目录"), "应解释 baseline 保护规则。");
  assert(!fs.existsSync(baselineReport), "保护失败时不得创建 baseline。");

  const sourceMapBaselineResult = runAnalyze(
    h5Dist,
    { H5_SIZE_BASELINE_PATH: baselineReport },
    ["--update-baseline"]
  );
  assert(sourceMapBaselineResult.status !== 0, "含 sourcemap 的构建不得写入 production baseline。");
  assert(sourceMapBaselineResult.stderr.includes("必须来自不含 sourcemap"), "应解释 baseline 的 production 约束。");
  fs.rmSync(path.join(h5Dist, "js", "app.aaaaaaaa.js.map"));

  const updateBaselineResult = runAnalyze(
    h5Dist,
    { H5_SIZE_BASELINE_PATH: baselineReport },
    ["--update-baseline"]
  );
  assert(updateBaselineResult.status === 0, `显式 baseline 更新应通过：${updateBaselineResult.stderr}`);
  assert(fs.existsSync(baselineReport), "显式更新命令应创建 baseline。");
  assert(updateBaselineResult.stdout.includes("受控 baseline"), "显式更新应清楚标记受控 baseline。");
  const repeatUpdateBaselineResult = runAnalyze(
    h5Dist,
    { H5_SIZE_BASELINE_PATH: baselineReport },
    ["--update-baseline"]
  );
  assert(repeatUpdateBaselineResult.status === 0, "显式更新应能原子替换既有 baseline。");
  const baselineBeforeNormalAnalyze = fs.readFileSync(baselineReport, "utf8");
  const normalAnalyzeResult = runAnalyze(h5Dist, { H5_SIZE_BASELINE_PATH: baselineReport });
  assert(normalAnalyzeResult.status === 0, "普通只读分析应通过。");
  assert(
    fs.readFileSync(baselineReport, "utf8") === baselineBeforeNormalAnalyze,
    "普通分析不得隐式改写 baseline。"
  );

  writeFile(path.join(h5Dist, "js", "app.bbbbbbbb.js"), "console.log('duplicate logical key');");
  const duplicateKeyResult = runAnalyze(h5Dist);
  assert(duplicateKeyResult.status !== 0, "重复 logicalKey 应使分析失败。");
  assert(duplicateKeyResult.stderr.includes("资源 logicalKey 重复：js/app.js"), "应报告重复 logicalKey。");
  fs.rmSync(path.join(h5Dist, "js", "app.bbbbbbbb.js"));

  const nonH5Result = runAnalyze(nonH5Dist);
  assert(nonH5Result.status !== 0, "非 H5 dist 应失败。");
  assert(nonH5Result.stderr.includes("当前 dist 不是 H5 构建产物"), "非 H5 dist 应提示先运行 H5 构建。");

  console.log("H5 体积分析测试通过。");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
