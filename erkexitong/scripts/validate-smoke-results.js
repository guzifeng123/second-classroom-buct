const fs = require("node:fs");
const path = require("node:path");
const { readChecklistFlows, validateSmokeResults } = require("./utils/smoke-checklist");

const projectRoot = path.resolve(__dirname, "..");
const checklistByTarget = {
  h5: "h5-smoke-checklist.md",
  rn: "rn-smoke-checklist.md"
};

function parseArgs(argv) {
  const result = {
    target: "",
    results: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--target" && next) {
      result.target = next;
      index += 1;
    } else if (arg === "--results" && next) {
      result.results = next;
      index += 1;
    }
  }

  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const args = parseArgs(process.argv.slice(2));
assert(checklistByTarget[args.target], "请通过 --target h5 或 --target rn 指定 smoke 结果类型");
assert(args.results, "请通过 --results <json> 指定 smoke 结果 JSON 文件");

const resultsPath = path.isAbsolute(args.results) ? args.results : path.join(projectRoot, args.results);
assert(fs.existsSync(resultsPath), `缺少 smoke 结果 JSON：${args.results}`);

const rawResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
const errors = validateSmokeResults(rawResults, readChecklistFlows(checklistByTarget[args.target]));

if (errors.length > 0) {
  errors.forEach((error) => {
    console.error(`- ${error}`);
  });
  throw new Error(`${args.target.toUpperCase()} smoke 结果 JSON 校验失败`);
}

console.log(`${args.target.toUpperCase()} smoke 结果 JSON 校验通过。`);
