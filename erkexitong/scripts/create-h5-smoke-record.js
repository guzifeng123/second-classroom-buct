const fs = require("node:fs");
const path = require("node:path");
const {
  buildEvidenceLines,
  buildChecklistLines,
  buildMetadataLines,
  buildStepRows,
  readSmokeResultPayload,
  readChecklistFlows,
  readChecklistVisualChecks
} = require("./utils/smoke-checklist");

const projectRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const result = {
    date: new Date().toISOString().slice(0, 10),
    browser: "",
    out: "",
    results: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--date" && next) {
      result.date = next;
      index += 1;
    } else if (arg === "--browser" && next) {
      result.browser = next;
      index += 1;
    } else if (arg === "--out" && next) {
      result.out = next;
      index += 1;
    } else if (arg === "--results" && next) {
      result.results = next;
      index += 1;
    }
  }

  return result;
}

function buildRecord({ date, browser, results }) {
  const checklistFileName = "h5-smoke-checklist.md";
  const { meta, resultsByFlow } = readSmokeResultPayload(projectRoot, results);
  const stepRows = buildStepRows(readChecklistFlows(checklistFileName), resultsByFlow);
  const visualCheckLines = buildChecklistLines(readChecklistVisualChecks(checklistFileName));
  const evidenceLines = buildEvidenceLines(resultsByFlow);
  const metadataLines = buildMetadataLines(meta);

  return `# H5 Smoke Record

日期：${date}
浏览器/视口：${browser}
构建命令：npm.cmd run build:h5
API 状态：
WebSocket 状态：
离线模式：

## 步骤结果

| 步骤 | 页面或流程 | 类型 | 结果 | 备注 |
| --- | --- | --- | --- | --- |
${stepRows}

## 视觉检查

${visualCheckLines}

${metadataLines}
## 证据

通过步骤：
失败步骤：
${evidenceLines}
后续处理：
`;
}

const args = parseArgs(process.argv.slice(2));
const content = buildRecord(args);

if (args.out) {
  const outputPath = path.isAbsolute(args.out) ? args.out : path.join(projectRoot, args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`H5 smoke 记录模板已生成：${outputPath}`);
} else {
  process.stdout.write(content);
}
