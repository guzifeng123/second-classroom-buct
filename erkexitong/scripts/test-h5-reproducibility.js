"use strict";

const assert = require("node:assert/strict");
const {
  compareH5ReproducibilityReports,
  requiredLazyLogicalKeys,
  toComparableReport
} = require("./utils/h5-reproducibility");

function createMetrics(rawBytes) {
  if (rawBytes === 0) {
    return {
      rawBytes: 0,
      gzipBytes: 0,
      brotliBytes: 0
    };
  }

  return {
    rawBytes,
    gzipBytes: Math.max(1, Math.floor(rawBytes / 2)),
    brotliBytes: Math.max(1, Math.floor(rawBytes / 3))
  };
}

function sumMetrics(rows) {
  return rows.reduce(
    (totals, row) => ({
      rawBytes: totals.rawBytes + row.rawBytes,
      gzipBytes: totals.gzipBytes + row.gzipBytes,
      brotliBytes: totals.brotliBytes + row.brotliBytes
    }),
    createMetrics(0)
  );
}

function createReport(generatedAt = "2026-07-14T00:00:00.000Z") {
  const assets = requiredLazyLogicalKeys.map((logicalKey, index) => ({
    path: logicalKey.replace(/\.(js|css)$/, `.fixture0${index + 1}.$1`),
    logicalKey,
    type: logicalKey.endsWith(".css") ? "css" : "js",
    ...createMetrics(1000 + index),
    hints: [],
    sourceMap: {
      modules: [],
      groups: []
    }
  }));

  return {
    schemaVersion: 1,
    generatedAt,
    build: {
      target: "h5",
      mode: "production",
      outputRoot: "dist/h5",
      sourceMaps: false,
      environmentProfile: "default-no-api"
    },
    compression: {
      aggregation: "sum-of-assets",
      runtime: {
        node: "v24.14.1",
        zlib: "fixture-zlib",
        brotli: "fixture-brotli"
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
    recommendedLimitBytes: 249856,
    totals: {
      entrypoint: createMetrics(0),
      js: sumMetrics(assets.filter((asset) => asset.type === "js")),
      css: sumMetrics(assets.filter((asset) => asset.type === "css"))
    },
    entrypointAssets: [],
    assets,
    oversizedAssets: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function refreshAssetTotals(report) {
  report.totals.js = sumMetrics(report.assets.filter((asset) => asset.type === "js"));
  report.totals.css = sumMetrics(report.assets.filter((asset) => asset.type === "css"));
}

const firstReport = createReport();
const secondReport = createReport("2026-07-14T00:01:00.000Z");
const result = compareH5ReproducibilityReports(firstReport, secondReport);
assert.equal(result.assetCount, requiredLazyLogicalKeys.length);
assert.equal(toComparableReport(firstReport, "fixture").generatedAt, undefined);

for (const field of ["path", "logicalKey", "rawBytes", "gzipBytes", "brotliBytes"]) {
  const changedReport = clone(secondReport);
  changedReport.assets[0][field] =
    typeof changedReport.assets[0][field] === "number"
      ? changedReport.assets[0][field] + 1
      : `${changedReport.assets[0][field]}.changed`;
  assert.throws(() => compareH5ReproducibilityReports(firstReport, changedReport));
}

const missingLazyChunkReport = clone(secondReport);
missingLazyChunkReport.assets = missingLazyChunkReport.assets.slice(1);
refreshAssetTotals(missingLazyChunkReport);
assert.throws(
  () => compareH5ReproducibilityReports(firstReport, missingLazyChunkReport),
  /缺少稳定懒加载 logicalKey/
);

const duplicateLogicalKeyReport = clone(secondReport);
duplicateLogicalKeyReport.assets.push(clone(duplicateLogicalKeyReport.assets[0]));
assert.throws(
  () => compareH5ReproducibilityReports(firstReport, duplicateLogicalKeyReport),
  /存在重复 logicalKey/
);

const invalidGeneratedAtReport = clone(secondReport);
invalidGeneratedAtReport.generatedAt = "";
assert.throws(
  () => compareH5ReproducibilityReports(firstReport, invalidGeneratedAtReport),
  /generatedAt 无效/
);

const malformedReport = {
  generatedAt: "2026-07-14T00:01:00.000Z",
  assets: requiredLazyLogicalKeys.map((logicalKey) => ({ logicalKey }))
};
assert.throws(
  () => compareH5ReproducibilityReports(malformedReport, clone(malformedReport)),
  /schemaVersion 必须为 1/
);

console.log("H5 构建复现报告比较测试通过。");
