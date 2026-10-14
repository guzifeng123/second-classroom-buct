"use strict";

const path = require("node:path");
const {
  compareH5ReproducibilityReports,
  readH5SizeReport,
  requiredLazyLogicalKeys
} = require("./utils/h5-reproducibility");

const args = process.argv.slice(2);

if (args.length !== 2 || args.some((arg) => arg.startsWith("--"))) {
  console.error("用法：node scripts/compare-h5-reproducibility.js <第一次报告.json> <第二次报告.json>");
  process.exitCode = 1;
} else {
  try {
    const firstPath = path.resolve(args[0]);
    const secondPath = path.resolve(args[1]);
    const result = compareH5ReproducibilityReports(
      readH5SizeReport(firstPath, "第一次 H5 报告"),
      readH5SizeReport(secondPath, "第二次 H5 报告")
    );

    console.log("H5 构建复现性检查通过：连续两次报告除 generatedAt 外完全一致。");
    console.log(`资源数量：${result.assetCount}`);
    console.log(`稳定懒加载 logicalKey：${requiredLazyLogicalKeys.join("、")}`);
  } catch (error) {
    console.error(`H5 构建复现性检查失败：${error.message}`);
    process.exitCode = 1;
  }
}
