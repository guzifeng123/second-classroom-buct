const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const issues = [];

function walkDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkDirectory(entryPath);
      continue;
    }

    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const source = fs.readFileSync(entryPath, "utf8");
    const sourceFile = ts.createSourceFile(entryPath, source, ts.ScriptTarget.Latest, true);

    function inspect(node) {
      if (ts.isNumericLiteral(node) && node.getText(sourceFile).includes("_")) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        issues.push({
          filePath: entryPath,
          line: position.line + 1,
          value: node.getText(sourceFile),
          message: "Metro 0.72 压缩器不支持数字分隔符"
        });
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "at"
      ) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        issues.push({
          filePath: entryPath,
          line: position.line + 1,
          value: node.getText(sourceFile),
          message: "React Native 0.70/Hermes 运行时不保证支持 Array.prototype.at"
        });
      }
      ts.forEachChild(node, inspect);
    }

    inspect(sourceFile);
  }
}

walkDirectory(sourceRoot);

if (issues.length > 0) {
  console.error("RN 公共源码语法校验失败：");
  for (const issue of issues) {
    console.error(`- ${path.relative(projectRoot, issue.filePath)}:${issue.line} ${issue.message}：${issue.value}`);
  }
  process.exit(1);
}

console.log("RN 公共源码语法校验通过。");
