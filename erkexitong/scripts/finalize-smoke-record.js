const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const recordScriptByTarget = {
  h5: "scripts/create-h5-smoke-record.js",
  rn: "scripts/create-rn-smoke-record.js"
};

function parseArgs(argv) {
  const result = {
    target: "",
    results: "",
    out: "",
    date: "",
    browser: "",
    device: ""
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
    } else if (arg === "--out" && next) {
      result.out = next;
      index += 1;
    } else if (arg === "--date" && next) {
      result.date = next;
      index += 1;
    } else if (arg === "--browser" && next) {
      result.browser = next;
      index += 1;
    } else if (arg === "--device" && next) {
      result.device = next;
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

function runNodeScript(script, args) {
  const result = spawnSync(nodeBin, [script, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const args = parseArgs(process.argv.slice(2));
assert(recordScriptByTarget[args.target], "请通过 --target h5 或 --target rn 指定 smoke 记录类型");
assert(args.results, "请通过 --results <json> 指定 smoke 结果 JSON 文件");
assert(args.out, "请通过 --out <record.md> 指定 smoke 记录输出文件");

runNodeScript("scripts/validate-smoke-results.js", ["--target", args.target, "--results", args.results]);

const recordArgs = ["--results", args.results, "--out", args.out];
if (args.date) {
  recordArgs.push("--date", args.date);
}
if (args.target === "h5" && args.browser) {
  recordArgs.push("--browser", args.browser);
}
if (args.target === "rn" && args.device) {
  recordArgs.push("--device", args.device);
}

runNodeScript(recordScriptByTarget[args.target], recordArgs);
