const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "erkexitong-h5-size-"));
const cleanEnv = { ...process.env };

Object.keys(cleanEnv)
  .filter((key) => key.startsWith("H5_SIZE_"))
  .forEach((key) => delete cleanEnv[key]);

function metrics(rawBytes, gzipBytes, brotliBytes) {
  return { rawBytes, gzipBytes, brotliBytes };
}

function makeAsset({
  path: assetPath = "js/app.aaaaaaaa.js",
  logicalKey = "js/app.js",
  type = "js",
  rawBytes = 200 * 1024,
  gzipBytes = 50 * 1024,
  brotliBytes = 40 * 1024,
  groups = [{ group: "npm:@tarojs/components", size: 120 * 1024 }]
} = {}) {
  return {
    path: assetPath,
    logicalKey,
    type,
    rawBytes,
    gzipBytes,
    brotliBytes,
    hints: [],
    sourceMap: {
      modules: [],
      groups
    }
  };
}

function sumMetrics(rows) {
  return rows.reduce(
    (total, row) => ({
      rawBytes: total.rawBytes + row.rawBytes,
      gzipBytes: total.gzipBytes + row.gzipBytes,
      brotliBytes: total.brotliBytes + row.brotliBytes
    }),
    metrics(0, 0, 0)
  );
}

function toEntrypointAsset(asset) {
  const { sourceMap: _sourceMap, ...entrypointAsset } = asset;
  return entrypointAsset;
}

function createReport({ assets = [makeAsset()], entrypointKeys, mutate } = {}) {
  const selectedEntrypointKeys = entrypointKeys ?? [assets[0]?.logicalKey].filter(Boolean);
  const entrypointAssets = assets
    .filter((asset) => selectedEntrypointKeys.includes(asset.logicalKey))
    .map(toEntrypointAsset);
  const recommendedLimitBytes = 244 * 1024;
  const report = {
    schemaVersion: 1,
    generatedAt: "2026-07-14T00:00:00.000Z",
    build: {
      target: "h5",
      mode: "production",
      outputRoot: "dist/h5",
      sourceMaps: false,
      environmentProfile: "test"
    },
    compression: {
      aggregation: "sum-of-assets",
      runtime: {
        node: process.version,
        zlib: process.versions.zlib ?? "unknown",
        brotli: process.versions.brotli ?? "unknown"
      },
      gzip: {
        algorithm: "gzip",
        level: 9
      },
      brotli: {
        algorithm: "brotli",
        quality: 11,
        mode: "generic"
      }
    },
    recommendedLimitBytes,
    totals: {
      entrypoint: sumMetrics(entrypointAssets),
      js: sumMetrics(assets.filter((asset) => asset.type === "js")),
      css: sumMetrics(assets.filter((asset) => asset.type === "css"))
    },
    entrypointAssets,
    assets,
    oversizedAssets: assets.filter((asset) => asset.rawBytes > recommendedLimitBytes)
  };

  mutate?.(report);
  return report;
}

function writeReport(fileName, options) {
  const reportPath = path.join(tempRoot, fileName);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(createReport(options), null, 2)}\n`, "utf8");
  return reportPath;
}

function runCompare(args, env = {}) {
  return spawnSync(process.execPath, ["scripts/compare-h5-size.js", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...cleanEnv,
      ...env
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  const baseReport = writeReport(path.join("中文 空格", "base report.json"));
  const hashRenamedReport = writeReport("hash-renamed.json", {
    assets: [makeAsset({ path: "js/app.bbbbbbbb.js" })]
  });
  const rawGrowthReport = writeReport("raw-growth.json", {
    assets: [makeAsset({ path: "js/app.cccccccc.js", rawBytes: 221 * 1024 })]
  });
  const gzipGrowthReport = writeReport("gzip-growth.json", {
    assets: [makeAsset({ path: "js/app.dddddddd.js", gzipBytes: 57 * 1024 })]
  });
  const brotliGrowthReport = writeReport("brotli-growth.json", {
    assets: [makeAsset({ path: "js/app.eeeeeeee.js", brotliBytes: 46 * 1024 })]
  });
  const exactLimitReport = writeReport("exact-limit.json", {
    assets: [
      makeAsset({
        path: "js/app.ffffffff.js",
        rawBytes: 220 * 1024,
        gzipBytes: 56 * 1024,
        brotliBytes: 45 * 1024
      })
    ]
  });
  const groupOnlyGrowthReport = writeReport("group-only-growth.json", {
    assets: [makeAsset({ groups: [{ group: "npm:@tarojs/components", size: 200 * 1024 }] })]
  });

  const sameResult = runCompare([baseReport, hashRenamedReport, "--strict"]);
  assert(sameResult.status === 0, `hash 改名且尺寸相同时严格对比应通过：${sameResult.stderr}`);
  assert(sameResult.stdout.includes("资源变化 Top\n  无变化"), "hash 改名不应产生资源体积变化。");

  const nonStrictGrowthResult = runCompare([baseReport, rawGrowthReport]);
  assert(nonStrictGrowthResult.status === 0, `非严格增长对比应通过：${nonStrictGrowthResult.stderr}`);
  assert(nonStrictGrowthResult.stdout.includes("raw 增长 +21.0 KiB"), "增长对比应输出 raw 风险提示。");

  const rawStrictResult = runCompare([baseReport, rawGrowthReport, "--strict"]);
  assert(rawStrictResult.status === 1, "严格模式下 raw 超过增长阈值应失败。");
  assert(rawStrictResult.stdout.includes("raw 增长 +21.0 KiB"), "raw 严格失败应标明指标。");

  const gzipStrictResult = runCompare([baseReport, gzipGrowthReport, "--strict"]);
  assert(gzipStrictResult.status === 1, "严格模式下 gzip 超过增长阈值应失败。");
  assert(gzipStrictResult.stdout.includes("gzip 增长 +7.0 KiB"), "gzip 严格失败应标明指标。");

  const brotliStrictResult = runCompare([baseReport, brotliGrowthReport, "--strict"]);
  assert(brotliStrictResult.status === 1, "严格模式下 Brotli 超过增长阈值应失败。");
  assert(brotliStrictResult.stdout.includes("Brotli 增长 +6.0 KiB"), "Brotli 严格失败应标明指标。");

  const exactLimitResult = runCompare([baseReport, exactLimitReport, "--strict"]);
  assert(exactLimitResult.status === 0, "增长量等于阈值时应通过，只有大于阈值才失败。");

  const groupOnlyResult = runCompare([baseReport, groupOnlyGrowthReport, "--strict"]);
  assert(groupOnlyResult.status === 0, "sourcemap 来源分组变化只作诊断，不应触发严格门禁。");
  assert(groupOnlyResult.stdout.includes("来源分组变化 Top（仅诊断，不参与严格门禁）"), "应解释来源分组语义。");

  const distributedBase = writeReport("distributed-base.json", {
    assets: [
      makeAsset({ logicalKey: "js/app.js", rawBytes: 100 * 1024, gzipBytes: 20 * 1024, brotliBytes: 15 * 1024 }),
      makeAsset({
        path: "js/feature.aaaaaaaa.js",
        logicalKey: "js/feature.js",
        rawBytes: 100 * 1024,
        gzipBytes: 20 * 1024,
        brotliBytes: 15 * 1024,
        groups: []
      })
    ]
  });
  const distributedCurrent = writeReport("distributed-current.json", {
    assets: [
      makeAsset({ logicalKey: "js/app.js", rawBytes: 100 * 1024, gzipBytes: 24 * 1024, brotliBytes: 15 * 1024 }),
      makeAsset({
        path: "js/feature.bbbbbbbb.js",
        logicalKey: "js/feature.js",
        rawBytes: 100 * 1024,
        gzipBytes: 24 * 1024,
        brotliBytes: 15 * 1024,
        groups: []
      })
    ]
  });
  const distributedResult = runCompare([distributedBase, distributedCurrent, "--strict"]);
  assert(distributedResult.status === 1, "单资源未越线但 JS 汇总越线时严格模式应失败。");
  assert(distributedResult.stdout.includes("汇总 JS 总量 gzip 增长 +8.0 KiB"), "汇总风险应明确输出。");

  const defaultPathsResult = runCompare([], {
    H5_SIZE_BASELINE_PATH: baseReport,
    H5_SIZE_CURRENT_REPORT_PATH: hashRenamedReport,
    H5_SIZE_COMPARE_STRICT: "1"
  });
  assert(defaultPathsResult.status === 0, "无位置参数时应使用默认/环境指定的 baseline 与当前报告。");

  const invalidLimitResult = runCompare([baseReport, hashRenamedReport, "--strict"], {
    H5_SIZE_GROWTH_LIMIT_GZIP_BYTES: "NaN"
  });
  assert(invalidLimitResult.status === 1, "无效增长阈值必须 fail closed。");
  assert(invalidLimitResult.stderr.includes("必须是非负整数"), "无效阈值应给出明确错误。");

  const invalidSchemaReport = writeReport("invalid-schema.json", {
    mutate(report) {
      report.schemaVersion = 99;
    }
  });
  const invalidSchemaResult = runCompare([baseReport, invalidSchemaReport]);
  assert(invalidSchemaResult.status === 1, "不支持的 schemaVersion 应失败。");
  assert(invalidSchemaResult.stderr.includes("schemaVersion 必须为 1"), "schema 错误应明确说明期望版本。");

  const missingMetricReport = writeReport("missing-metric.json", {
    mutate(report) {
      delete report.assets[0].gzipBytes;
    }
  });
  const missingMetricResult = runCompare([baseReport, missingMetricReport]);
  assert(missingMetricResult.status === 1, "缺失三尺寸字段时应失败。");
  assert(missingMetricResult.stderr.includes("gzipBytes 必须是非负安全整数"), "缺失字段应定位到具体指标。");

  const duplicateLogicalKeyReport = writeReport("duplicate-logical-key.json", {
    assets: [
      makeAsset(),
      makeAsset({ path: "js/app.bbbbbbbb.js", rawBytes: 10 * 1024, gzipBytes: 5 * 1024, brotliBytes: 4 * 1024 })
    ]
  });
  const duplicateLogicalKeyResult = runCompare([baseReport, duplicateLogicalKeyReport]);
  assert(duplicateLogicalKeyResult.status === 1, "重复 logicalKey 报告应失败。");
  assert(duplicateLogicalKeyResult.stderr.includes("存在重复 logicalKey：js/app.js"), "应报告重复 logicalKey。");

  const incompatibleCompressionReport = writeReport("incompatible-compression.json", {
    mutate(report) {
      report.compression.brotli.quality = 10;
    }
  });
  const incompatibleCompressionResult = runCompare([baseReport, incompatibleCompressionReport]);
  assert(incompatibleCompressionResult.status === 1, "压缩参数不一致时应拒绝比较。");
  assert(incompatibleCompressionResult.stderr.includes("压缩参数不一致"), "应解释压缩参数不兼容。");

  console.log("H5 体积对比测试通过。");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
