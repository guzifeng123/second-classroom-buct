"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { validateReport } = require("../compare-h5-size");

const requiredLazyLogicalKeys = Object.freeze([
  "js/lazy-image-library-grid.js",
  "js/lazy-upload-image-button.js",
  "css/lazy-upload-image-button.css"
]);

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readH5SizeReport(reportPath, label) {
  assertCondition(fs.existsSync(reportPath), `未找到${label}：${reportPath}`);

  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (error) {
    throw new Error(`${label}不是有效 JSON：${error.message}`);
  }
}

function getLogicalKeys(report, label) {
  assertCondition(report && typeof report === "object" && !Array.isArray(report), `${label}根节点必须是对象。`);
  assertCondition(
    typeof report.generatedAt === "string" && report.generatedAt.length > 0,
    `${label}.generatedAt 必须是非空字符串。`
  );
  assertCondition(Array.isArray(report.assets), `${label}.assets 必须是数组。`);
  const logicalKeys = new Set();

  report.assets.forEach((asset, index) => {
    assertCondition(asset && typeof asset === "object" && !Array.isArray(asset), `${label}.assets[${index}] 必须是对象。`);
    assertCondition(
      typeof asset.logicalKey === "string" && asset.logicalKey.length > 0,
      `${label}.assets[${index}].logicalKey 必须是非空字符串。`
    );
    assertCondition(!logicalKeys.has(asset.logicalKey), `${label}.assets 存在重复 logicalKey：${asset.logicalKey}。`);
    logicalKeys.add(asset.logicalKey);
  });

  return logicalKeys;
}

function assertRequiredLazyLogicalKeys(report, label) {
  const logicalKeys = getLogicalKeys(report, label);

  requiredLazyLogicalKeys.forEach((logicalKey) => {
    assertCondition(logicalKeys.has(logicalKey), `${label}缺少稳定懒加载 logicalKey：${logicalKey}。`);
  });

  return logicalKeys;
}

function toComparableReport(report, label) {
  validateReport(report, label);
  assertRequiredLazyLogicalKeys(report, label);
  const { generatedAt: _generatedAt, ...comparableReport } = report;
  return comparableReport;
}

function compareH5ReproducibilityReports(firstReport, secondReport) {
  const firstComparable = toComparableReport(firstReport, "第一次 H5 报告");
  const secondComparable = toComparableReport(secondReport, "第二次 H5 报告");

  try {
    assert.deepStrictEqual(secondComparable, firstComparable);
  } catch (error) {
    throw new Error(`连续两次 H5 构建报告除 generatedAt 外不一致：${error.message}`);
  }

  return {
    assetCount: firstReport.assets.length,
    logicalKeys: [...getLogicalKeys(firstReport, "第一次 H5 报告")].sort()
  };
}

module.exports = {
  assertRequiredLazyLogicalKeys,
  compareH5ReproducibilityReports,
  readH5SizeReport,
  requiredLazyLogicalKeys,
  toComparableReport
};
