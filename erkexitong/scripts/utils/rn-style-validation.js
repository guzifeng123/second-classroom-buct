const fs = require("node:fs");
const path = require("node:path");

const RN_STYLE_FILE_SUFFIX = ".rn.scss";
const SUPPORTED_FONT_WEIGHTS = new Set([
  "normal",
  "bold",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900"
]);
const UNSUPPORTED_TYPE_SELECTOR_PATTERN =
  /(^|[\s>+~])(?:\*|page|view|text|button|image|input|textarea|form|label|scroll-view|taro-[\w-]+)(?=[:.#\s>+~\[]|$)/i;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function getLineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function findRnStyleIssues(source, filePath = "<inline>") {
  const normalizedSource = stripComments(source);
  const issues = [];
  const selectorPattern = /([^{}]+)\{/g;
  const fontWeightPattern = /font-weight\s*:\s*([^;{}]+)\s*;/gi;
  let match;

  while ((match = selectorPattern.exec(normalizedSource))) {
    const selectorGroup = match[1].trim();

    if (!selectorGroup || selectorGroup.startsWith("@")) {
      continue;
    }

    for (const selector of selectorGroup.split(",")) {
      const normalizedSelector = selector.trim();

      if (UNSUPPORTED_TYPE_SELECTOR_PATTERN.test(normalizedSelector)) {
        issues.push({
          filePath,
          line: getLineNumber(normalizedSource, match.index),
          type: "unsupported-selector",
          value: normalizedSelector,
          message: `RN 样式不允许通配符或元素选择器：${normalizedSelector}`
        });
      }
    }
  }

  while ((match = fontWeightPattern.exec(normalizedSource))) {
    const fontWeight = match[1].trim().toLowerCase();

    if (!SUPPORTED_FONT_WEIGHTS.has(fontWeight)) {
      issues.push({
        filePath,
        line: getLineNumber(normalizedSource, match.index),
        type: "unsupported-font-weight",
        value: fontWeight,
        message: `RN font-weight 仅允许 normal、bold 或 100-900 整百值：${fontWeight}`
      });
    }
  }

  return issues;
}

function listRnStyleFiles(rootDir) {
  const files = [];

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listRnStyleFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(RN_STYLE_FILE_SUFFIX)) {
      files.push(entryPath);
    }
  }

  return files;
}

function validateRnStyleDirectory(rootDir) {
  return listRnStyleFiles(rootDir).flatMap((filePath) =>
    findRnStyleIssues(fs.readFileSync(filePath, "utf8"), filePath)
  );
}

module.exports = {
  findRnStyleIssues,
  listRnStyleFiles,
  validateRnStyleDirectory
};
