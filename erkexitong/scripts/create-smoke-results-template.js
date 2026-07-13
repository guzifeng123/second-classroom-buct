const fs = require("node:fs");
const path = require("node:path");
const { buildResultsTemplate, readChecklistFlows } = require("./utils/smoke-checklist");

const projectRoot = path.resolve(__dirname, "..");
const checklistByTarget = {
  h5: "h5-smoke-checklist.md",
  rn: "rn-smoke-checklist.md"
};

function parseArgs(argv) {
  const result = {
    target: "",
    out: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--target" && next) {
      result.target = next;
      index += 1;
    } else if (arg === "--out" && next) {
      result.out = next;
      index += 1;
    }
  }

  return result;
}

function assertTarget(target) {
  if (!checklistByTarget[target]) {
    throw new Error("请通过 --target h5 或 --target rn 指定 smoke 结果模板类型");
  }
}

const args = parseArgs(process.argv.slice(2));
assertTarget(args.target);

const template = buildResultsTemplate(readChecklistFlows(checklistByTarget[args.target]));
const content = `${JSON.stringify(template, null, 2)}\n`;

if (args.out) {
  const outputPath = path.isAbsolute(args.out) ? args.out : path.join(projectRoot, args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`${args.target.toUpperCase()} smoke 结果 JSON 模板已生成：${outputPath}`);
} else {
  process.stdout.write(content);
}
