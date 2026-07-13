const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const [baseReportArg, currentReportArg] = process.argv.slice(2);
const growthLimitBytes = Number(process.env.H5_SIZE_GROWTH_LIMIT_BYTES ?? 20 * 1024);
const strictMode = process.env.H5_SIZE_COMPARE_STRICT === "1";

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatDeltaKiB(bytes) {
  const sign = bytes > 0 ? "+" : "";
  return `${sign}${(bytes / 1024).toFixed(1)} KiB`;
}

function readReport(reportPath) {
  const absolutePath = path.resolve(projectRoot, reportPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`未找到报告文件：${reportPath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function toSizeMap(rows, keyName) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row[keyName], row.size]));
}

function collectGroups(report) {
  const groups = new Map();

  (Array.isArray(report.assets) ? report.assets : []).forEach((asset) => {
    (asset.sourceMap?.groups ?? []).forEach((group) => {
      groups.set(group.group, (groups.get(group.group) ?? 0) + group.size);
    });
  });

  return groups;
}

function diffMaps(baseMap, currentMap, nameKey) {
  const keys = new Set([...baseMap.keys(), ...currentMap.keys()]);
  return [...keys]
    .map((key) => ({
      [nameKey]: key,
      before: baseMap.get(key) ?? 0,
      current: currentMap.get(key) ?? 0,
      delta: (currentMap.get(key) ?? 0) - (baseMap.get(key) ?? 0)
    }))
    .sort((left, right) => right.delta - left.delta);
}

function printDiffRows(title, rows, nameKey) {
  console.log(`\n${title}`);

  const visibleRows = rows.filter((row) => row.delta !== 0).slice(0, 10);

  if (visibleRows.length === 0) {
    console.log("  无变化");
    return;
  }

  visibleRows.forEach((row) => {
    console.log(
      `  ${formatDeltaKiB(row.delta).padStart(10)}  ${formatKiB(row.before).padStart(10)} -> ${formatKiB(
        row.current
      ).padStart(10)}  ${row[nameKey]}`
    );
  });
}

function printTotalDelta(label, before, current) {
  console.log(`${label}：${formatKiB(before)} -> ${formatKiB(current)} (${formatDeltaKiB(current - before)})`);
}

if (!baseReportArg || !currentReportArg) {
  console.error("用法：node scripts/compare-h5-size.js <base-report.json> <current-report.json>");
  process.exit(1);
}

const baseReport = readReport(baseReportArg);
const currentReport = readReport(currentReportArg);
const assetDiffs = diffMaps(toSizeMap(baseReport.assets, "path"), toSizeMap(currentReport.assets, "path"), "path");
const groupDiffs = diffMaps(collectGroups(baseReport), collectGroups(currentReport), "group");
const oversizedAssets = Array.isArray(currentReport.oversizedAssets) ? currentReport.oversizedAssets : [];
const riskyAssetGrowth = assetDiffs.filter((row) => row.delta > growthLimitBytes);
const riskyGroupGrowth = groupDiffs.filter((row) => row.delta > growthLimitBytes);

console.log("H5 体积趋势对比");
printTotalDelta("入口资源", baseReport.totals?.entrypointBytes ?? 0, currentReport.totals?.entrypointBytes ?? 0);
printTotalDelta("JS 总量", baseReport.totals?.jsBytes ?? 0, currentReport.totals?.jsBytes ?? 0);
printTotalDelta("CSS 总量", baseReport.totals?.cssBytes ?? 0, currentReport.totals?.cssBytes ?? 0);
console.log(`增长提示阈值：${formatKiB(growthLimitBytes)}`);

printDiffRows("资源增长 Top", assetDiffs, "path");
printDiffRows("来源分组增长 Top", groupDiffs, "group");

if (oversizedAssets.length > 0) {
  console.log("\n当前超推荐阈值资源");
  oversizedAssets.forEach((asset) => {
    console.log(`  ${formatKiB(asset.size).padStart(10)}  ${asset.path}`);
  });
}

if (riskyAssetGrowth.length > 0 || riskyGroupGrowth.length > 0) {
  console.log("\n增长提示");
  riskyAssetGrowth.slice(0, 5).forEach((row) => {
    console.log(`  资源 ${row.path} 增长 ${formatDeltaKiB(row.delta)}`);
  });
  riskyGroupGrowth.slice(0, 5).forEach((row) => {
    console.log(`  来源分组 ${row.group} 增长 ${formatDeltaKiB(row.delta)}`);
  });

  if (strictMode) {
    process.exitCode = 1;
  }
}
