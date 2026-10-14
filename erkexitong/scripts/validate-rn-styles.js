const path = require("node:path");
const { validateRnStyleDirectory } = require("./utils/rn-style-validation");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const issues = validateRnStyleDirectory(sourceRoot);

if (issues.length > 0) {
  console.error("RN 样式静态校验失败：");
  for (const issue of issues) {
    console.error(`- ${path.relative(projectRoot, issue.filePath)}:${issue.line} ${issue.message}`);
  }
  process.exit(1);
}

console.log("RN 样式静态校验通过。");
