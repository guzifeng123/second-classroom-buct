const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const reportSchemaVersion = 1;
const metricDefinitions = [
  {
    key: "rawBytes",
    label: "raw",
    envName: "H5_SIZE_GROWTH_LIMIT_RAW_BYTES",
    defaultLimitBytes: 20 * 1024
  },
  {
    key: "gzipBytes",
    label: "gzip",
    envName: "H5_SIZE_GROWTH_LIMIT_GZIP_BYTES",
    defaultLimitBytes: 6 * 1024
  },
  {
    key: "brotliBytes",
    label: "Brotli",
    envName: "H5_SIZE_GROWTH_LIMIT_BROTLI_BYTES",
    defaultLimitBytes: 5 * 1024
  }
];
const totalDefinitions = [
  { key: "entrypoint", label: "入口资源" },
  { key: "js", label: "JS 总量" },
  { key: "css", label: "CSS 总量" }
];

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatDeltaKiB(bytes) {
  const sign = bytes > 0 ? "+" : "";
  return `${sign}${(bytes / 1024).toFixed(1)} KiB`;
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNonNegativeInteger(value, fieldPath) {
  assertCondition(Number.isSafeInteger(value) && value >= 0, `${fieldPath} 必须是非负安全整数。`);
}

function assertRelativePosixPath(value, fieldPath) {
  assertCondition(typeof value === "string" && value.length > 0, `${fieldPath} 必须是非空字符串。`);
  assertCondition(!value.includes("\\"), `${fieldPath} 必须使用 POSIX 路径分隔符。`);
  assertCondition(!value.startsWith("/") && !/^[a-z]:\//i.test(value), `${fieldPath} 必须是相对路径。`);
  assertCondition(!value.split("/").includes(".."), `${fieldPath} 不得包含 .. 路径段。`);
}

function validateMetricSet(value, fieldPath) {
  assertCondition(isRecord(value), `${fieldPath} 必须是对象。`);

  metricDefinitions.forEach(({ key }) => {
    assertNonNegativeInteger(value[key], `${fieldPath}.${key}`);
  });
}

function metricSetsEqual(left, right) {
  return metricDefinitions.every(({ key }) => left[key] === right[key]);
}

function zeroMetrics() {
  return { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 };
}

function sumMetrics(rows) {
  return rows.reduce((totals, row) => {
    metricDefinitions.forEach(({ key }) => {
      totals[key] += row[key];
    });
    return totals;
  }, zeroMetrics());
}

function validateSourceMap(sourceMap, fieldPath) {
  assertCondition(isRecord(sourceMap), `${fieldPath} 必须是对象。`);
  assertCondition(Array.isArray(sourceMap.modules), `${fieldPath}.modules 必须是数组。`);
  assertCondition(Array.isArray(sourceMap.groups), `${fieldPath}.groups 必须是数组。`);

  sourceMap.modules.forEach((module, index) => {
    assertCondition(isRecord(module), `${fieldPath}.modules[${index}] 必须是对象。`);
    assertCondition(typeof module.path === "string" && module.path.length > 0, `${fieldPath}.modules[${index}].path 无效。`);
    assertNonNegativeInteger(module.size, `${fieldPath}.modules[${index}].size`);
  });

  sourceMap.groups.forEach((group, index) => {
    assertCondition(isRecord(group), `${fieldPath}.groups[${index}] 必须是对象。`);
    assertCondition(typeof group.group === "string" && group.group.length > 0, `${fieldPath}.groups[${index}].group 无效。`);
    assertNonNegativeInteger(group.size, `${fieldPath}.groups[${index}].size`);
  });
}

function validateAssetRows(rows, fieldPath, requireSourceMap) {
  assertCondition(Array.isArray(rows), `${fieldPath} 必须是数组。`);
  const logicalKeys = new Set();

  rows.forEach((row, index) => {
    const rowPath = `${fieldPath}[${index}]`;
    assertCondition(isRecord(row), `${rowPath} 必须是对象。`);
    assertRelativePosixPath(row.path, `${rowPath}.path`);
    assertRelativePosixPath(row.logicalKey, `${rowPath}.logicalKey`);
    assertCondition(row.type === "js" || row.type === "css", `${rowPath}.type 必须是 js 或 css。`);
    assertCondition(row.path.endsWith(`.${row.type}`), `${rowPath}.path 与 type 不一致。`);
    assertCondition(row.logicalKey.endsWith(`.${row.type}`), `${rowPath}.logicalKey 与 type 不一致。`);
    validateMetricSet(row, rowPath);
    assertCondition(Array.isArray(row.hints), `${rowPath}.hints 必须是数组。`);
    assertCondition(row.hints.every((hint) => typeof hint === "string"), `${rowPath}.hints 只能包含字符串。`);

    if (requireSourceMap) {
      validateSourceMap(row.sourceMap, `${rowPath}.sourceMap`);
    } else {
      assertCondition(row.sourceMap === undefined, `${rowPath} 不应包含 sourceMap。`);
    }

    assertCondition(!logicalKeys.has(row.logicalKey), `${fieldPath} 存在重复 logicalKey：${row.logicalKey}。`);
    logicalKeys.add(row.logicalKey);
  });

  return logicalKeys;
}

function validateCompression(compression, label) {
  assertCondition(isRecord(compression), `${label}.compression 必须是对象。`);
  assertCondition(compression.aggregation === "sum-of-assets", `${label}.compression.aggregation 不受支持。`);
  assertCondition(isRecord(compression.gzip), `${label}.compression.gzip 必须是对象。`);
  assertCondition(compression.gzip.algorithm === "gzip", `${label}.compression.gzip.algorithm 不受支持。`);
  assertNonNegativeInteger(compression.gzip.level, `${label}.compression.gzip.level`);
  assertCondition(compression.gzip.level <= 9, `${label}.compression.gzip.level 不得大于 9。`);
  assertCondition(isRecord(compression.brotli), `${label}.compression.brotli 必须是对象。`);
  assertCondition(compression.brotli.algorithm === "brotli", `${label}.compression.brotli.algorithm 不受支持。`);
  assertNonNegativeInteger(compression.brotli.quality, `${label}.compression.brotli.quality`);
  assertCondition(compression.brotli.quality <= 11, `${label}.compression.brotli.quality 不得大于 11。`);
  assertCondition(
    ["generic", "text", "font"].includes(compression.brotli.mode),
    `${label}.compression.brotli.mode 不受支持。`
  );
  assertCondition(isRecord(compression.runtime), `${label}.compression.runtime 必须是对象。`);
  ["node", "zlib", "brotli"].forEach((key) => {
    assertCondition(
      typeof compression.runtime[key] === "string" && compression.runtime[key].length > 0,
      `${label}.compression.runtime.${key} 无效。`
    );
  });
}

function validateReport(report, label) {
  assertCondition(isRecord(report), `${label}根节点必须是对象。`);
  assertCondition(
    report.schemaVersion === reportSchemaVersion,
    `${label}.schemaVersion 必须为 ${reportSchemaVersion}，当前为 ${String(report.schemaVersion)}。`
  );
  assertCondition(typeof report.generatedAt === "string" && report.generatedAt.length > 0, `${label}.generatedAt 无效。`);
  assertCondition(isRecord(report.build), `${label}.build 必须是对象。`);
  assertCondition(report.build.target === "h5", `${label}.build.target 必须为 h5。`);
  assertCondition(typeof report.build.mode === "string" && report.build.mode.length > 0, `${label}.build.mode 无效。`);
  assertCondition(
    typeof report.build.outputRoot === "string" && report.build.outputRoot.length > 0,
    `${label}.build.outputRoot 无效。`
  );
  assertCondition(typeof report.build.sourceMaps === "boolean", `${label}.build.sourceMaps 必须是布尔值。`);
  assertCondition(
    typeof report.build.environmentProfile === "string" && report.build.environmentProfile.length > 0,
    `${label}.build.environmentProfile 无效。`
  );
  validateCompression(report.compression, label);
  assertNonNegativeInteger(report.recommendedLimitBytes, `${label}.recommendedLimitBytes`);
  assertCondition(report.recommendedLimitBytes > 0, `${label}.recommendedLimitBytes 必须大于 0。`);
  assertCondition(isRecord(report.totals), `${label}.totals 必须是对象。`);
  totalDefinitions.forEach(({ key }) => validateMetricSet(report.totals[key], `${label}.totals.${key}`));

  const assetKeys = validateAssetRows(report.assets, `${label}.assets`, true);
  validateAssetRows(report.entrypointAssets, `${label}.entrypointAssets`, false);
  validateAssetRows(report.oversizedAssets, `${label}.oversizedAssets`, true);
  const assetsByKey = new Map(report.assets.map((asset) => [asset.logicalKey, asset]));

  report.entrypointAssets.forEach((entrypointAsset) => {
    const asset = assetsByKey.get(entrypointAsset.logicalKey);
    assertCondition(assetKeys.has(entrypointAsset.logicalKey), `${label}入口资源未出现在 assets：${entrypointAsset.logicalKey}。`);
    assertCondition(
      asset.path === entrypointAsset.path && asset.type === entrypointAsset.type && metricSetsEqual(asset, entrypointAsset),
      `${label}入口资源与 assets 数据不一致：${entrypointAsset.logicalKey}。`
    );
  });

  const expectedOversizedKeys = new Set(
    report.assets.filter((asset) => asset.rawBytes > report.recommendedLimitBytes).map((asset) => asset.logicalKey)
  );
  assertCondition(
    expectedOversizedKeys.size === report.oversizedAssets.length,
    `${label}.oversizedAssets 与 recommendedLimitBytes 不一致。`
  );
  report.oversizedAssets.forEach((oversizedAsset) => {
    const asset = assetsByKey.get(oversizedAsset.logicalKey);
    assertCondition(expectedOversizedKeys.has(oversizedAsset.logicalKey), `${label}包含无效超限资源：${oversizedAsset.logicalKey}。`);
    assertCondition(
      asset.path === oversizedAsset.path && asset.type === oversizedAsset.type && metricSetsEqual(asset, oversizedAsset),
      `${label}超限资源与 assets 数据不一致：${oversizedAsset.logicalKey}。`
    );
  });

  const expectedTotals = {
    entrypoint: sumMetrics(report.entrypointAssets),
    js: sumMetrics(report.assets.filter((asset) => asset.type === "js")),
    css: sumMetrics(report.assets.filter((asset) => asset.type === "css"))
  };

  totalDefinitions.forEach(({ key }) => {
    assertCondition(metricSetsEqual(report.totals[key], expectedTotals[key]), `${label}.totals.${key} 与资源明细之和不一致。`);
  });

  return report;
}

function readReport(reportPath, label) {
  const absolutePath = path.resolve(projectRoot, reportPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`未找到${label}：${reportPath}`);
  }

  let report;

  try {
    report = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`${label}不是有效 JSON：${error.message}`);
  }

  return validateReport(report, label);
}

function getComparableCompression(report) {
  return {
    aggregation: report.compression.aggregation,
    gzip: {
      algorithm: report.compression.gzip.algorithm,
      level: report.compression.gzip.level
    },
    brotli: {
      algorithm: report.compression.brotli.algorithm,
      quality: report.compression.brotli.quality,
      mode: report.compression.brotli.mode
    }
  };
}

function assertCompatibleReports(baseReport, currentReport) {
  assertCondition(baseReport.build.target === currentReport.build.target, "两份报告的构建目标不一致，不能比较。");
  assertCondition(baseReport.build.mode === currentReport.build.mode, "两份报告的构建模式不一致，不能比较。");
  assertCondition(
    baseReport.build.sourceMaps === currentReport.build.sourceMaps,
    "两份报告的 sourcemap 构建状态不一致，不能比较。"
  );
  assertCondition(
    baseReport.build.environmentProfile === currentReport.build.environmentProfile,
    "两份报告的构建环境 profile 不一致，不能比较。"
  );
  assertCondition(
    JSON.stringify(getComparableCompression(baseReport)) === JSON.stringify(getComparableCompression(currentReport)),
    "两份报告的压缩参数不一致，不能比较。"
  );

  const runtimeKeys = ["node", "zlib", "brotli"];
  const runtimeDiffers = runtimeKeys.some(
    (key) => baseReport.compression.runtime[key] !== currentReport.compression.runtime[key]
  );

  if (runtimeDiffers) {
    console.warn("警告：两份报告的 Node/zlib/Brotli 运行时不同，压缩尺寸可能存在实现差异。");
  }
}

function toMetricMap(rows) {
  return new Map(rows.map((row) => [row.logicalKey, row]));
}

function subtractMetrics(before, current) {
  return metricDefinitions.reduce((delta, { key }) => {
    delta[key] = current[key] - before[key];
    return delta;
  }, {});
}

function diffMetricMaps(baseMap, currentMap) {
  const keys = new Set([...baseMap.keys(), ...currentMap.keys()]);
  return [...keys]
    .map((logicalKey) => {
      const beforeRow = baseMap.get(logicalKey);
      const currentRow = currentMap.get(logicalKey);
      const before = beforeRow ?? zeroMetrics();
      const current = currentRow ?? zeroMetrics();

      return {
        logicalKey,
        before,
        current,
        beforePath: beforeRow?.path ?? "-",
        currentPath: currentRow?.path ?? "-",
        delta: subtractMetrics(before, current)
      };
    })
    .sort(
      (left, right) =>
        right.delta.rawBytes - left.delta.rawBytes ||
        right.delta.gzipBytes - left.delta.gzipBytes ||
        left.logicalKey.localeCompare(right.logicalKey)
    );
}

function hasMetricChange(row) {
  return metricDefinitions.some(({ key }) => row.delta[key] !== 0);
}

function printMetricComparison(label, before, current) {
  const details = metricDefinitions
    .map(
      ({ key, label: metricLabel }) =>
        `${metricLabel} ${formatKiB(before[key])} -> ${formatKiB(current[key])} (${formatDeltaKiB(
          current[key] - before[key]
        )})`
    )
    .join("；");
  console.log(`${label}：${details}`);
}

function printDiffRows(title, rows) {
  console.log(`\n${title}`);
  const visibleRows = rows.filter(hasMetricChange).slice(0, 10);

  if (visibleRows.length === 0) {
    console.log("  无变化");
    return;
  }

  visibleRows.forEach((row) => {
    const deltas = metricDefinitions
      .map(({ key, label }) => `${label} ${formatDeltaKiB(row.delta[key])}`)
      .join(" / ");
    console.log(`  ${deltas}  ${row.logicalKey}`);
  });
}

function collectGroups(report) {
  const groups = new Map();

  report.assets.forEach((asset) => {
    asset.sourceMap.groups.forEach((group) => {
      groups.set(group.group, (groups.get(group.group) ?? 0) + group.size);
    });
  });

  return groups;
}

function diffScalarMaps(baseMap, currentMap) {
  const keys = new Set([...baseMap.keys(), ...currentMap.keys()]);
  return [...keys]
    .map((key) => ({
      key,
      before: baseMap.get(key) ?? 0,
      current: currentMap.get(key) ?? 0,
      delta: (currentMap.get(key) ?? 0) - (baseMap.get(key) ?? 0)
    }))
    .sort((left, right) => right.delta - left.delta || left.key.localeCompare(right.key));
}

function printGroupDiffs(rows) {
  console.log("\n来源分组变化 Top（仅诊断，不参与严格门禁）");
  const visibleRows = rows.filter((row) => row.delta !== 0).slice(0, 10);

  if (visibleRows.length === 0) {
    console.log("  无变化");
    return;
  }

  visibleRows.forEach((row) => {
    console.log(
      `  ${formatDeltaKiB(row.delta).padStart(10)}  ${formatKiB(row.before).padStart(10)} -> ${formatKiB(
        row.current
      ).padStart(10)}  ${row.key}`
    );
  });
}

function parseGrowthLimit(definition) {
  const legacyValue = process.env.H5_SIZE_GROWTH_LIMIT_BYTES;
  const configuredValue = process.env[definition.envName] ?? legacyValue;

  if (configuredValue === undefined) {
    return definition.defaultLimitBytes;
  }

  const normalizedValue = String(configuredValue).trim();
  assertCondition(/^\d+$/.test(normalizedValue), `${definition.envName} 必须是非负整数。`);
  const value = Number(normalizedValue);
  assertNonNegativeInteger(value, definition.envName);
  return value;
}

function collectRisks(scope, diffs, growthLimits) {
  return diffs.flatMap((row) =>
    metricDefinitions
      .filter(({ key }) => row.delta[key] > growthLimits[key])
      .map(({ key, label }) => ({
        scope,
        logicalKey: row.logicalKey,
        metricKey: key,
        metricLabel: label,
        delta: row.delta[key],
        limit: growthLimits[key]
      }))
  );
}

function main() {
  const cliArgs = process.argv.slice(2);
  const unknownFlags = cliArgs.filter((arg) => arg.startsWith("--") && arg !== "--strict");
  assertCondition(unknownFlags.length === 0, `未知参数：${unknownFlags.join(", ")}。`);
  const positionalArgs = cliArgs.filter((arg) => !arg.startsWith("--"));
  assertCondition(
    positionalArgs.length <= 2,
    "用法：node scripts/compare-h5-size.js [base-report.json] [current-report.json] [--strict]"
  );

  const baseReportArg =
    positionalArgs[0] ?? process.env.H5_SIZE_BASELINE_PATH ?? "scripts/baselines/h5-size.json";
  const currentReportArg =
    positionalArgs[1] ?? process.env.H5_SIZE_CURRENT_REPORT_PATH ?? "dist/h5-size-report.json";
  const strictMode = cliArgs.includes("--strict") || process.env.H5_SIZE_COMPARE_STRICT === "1";
  const growthLimits = Object.fromEntries(
    metricDefinitions.map((definition) => [definition.key, parseGrowthLimit(definition)])
  );
  const baseReport = readReport(baseReportArg, "基线报告");
  const currentReport = readReport(currentReportArg, "当前报告");
  assertCompatibleReports(baseReport, currentReport);

  const totalDiffs = totalDefinitions.map(({ key, label }) => ({
    logicalKey: label,
    before: baseReport.totals[key],
    current: currentReport.totals[key],
    delta: subtractMetrics(baseReport.totals[key], currentReport.totals[key])
  }));
  const entrypointDiffs = diffMetricMaps(
    toMetricMap(baseReport.entrypointAssets),
    toMetricMap(currentReport.entrypointAssets)
  );
  const assetDiffs = diffMetricMaps(toMetricMap(baseReport.assets), toMetricMap(currentReport.assets));
  const groupDiffs = diffScalarMaps(collectGroups(baseReport), collectGroups(currentReport));

  console.log("H5 体积趋势对比");
  console.log(`基线：${normalizePath(baseReportArg)}`);
  console.log(`当前：${normalizePath(currentReportArg)}`);
  totalDefinitions.forEach(({ key, label }) => {
    printMetricComparison(label, baseReport.totals[key], currentReport.totals[key]);
  });
  console.log(
    `增长提示阈值：raw ${formatKiB(growthLimits.rawBytes)} / gzip ${formatKiB(
      growthLimits.gzipBytes
    )} / Brotli ${formatKiB(growthLimits.brotliBytes)}`
  );

  printDiffRows("入口资源变化 Top", entrypointDiffs);
  printDiffRows("资源变化 Top", assetDiffs);
  printGroupDiffs(groupDiffs);

  if (currentReport.oversizedAssets.length > 0) {
    console.log("\n当前超过 raw 推荐阈值的资源");
    currentReport.oversizedAssets.forEach((asset) => {
      console.log(
        `  ${formatKiB(asset.rawBytes).padStart(10)} raw / ${formatKiB(asset.gzipBytes)} gzip / ${formatKiB(
          asset.brotliBytes
        )} Brotli  ${asset.logicalKey}`
      );
    });
  }

  const risks = [
    ...collectRisks("汇总", totalDiffs, growthLimits),
    ...collectRisks("入口资源", entrypointDiffs, growthLimits),
    ...collectRisks("资源", assetDiffs, growthLimits)
  ];

  if (risks.length > 0) {
    console.log("\n增长提示");
    risks.slice(0, 20).forEach((risk) => {
      console.log(
        `  ${risk.scope} ${risk.logicalKey} ${risk.metricLabel} 增长 ${formatDeltaKiB(risk.delta)}（阈值 ${formatKiB(
          risk.limit
        )}）`
      );
    });

    if (strictMode) {
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[h5-size] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  validateReport
};
