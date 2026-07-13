const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "erkexitong-h5-analyze-"));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function runAnalyze(distRoot, extraEnv = {}, args = []) {
  return spawnSync(process.execPath, ["scripts/analyze-h5-size.js", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      H5_SIZE_DIST_ROOT: distRoot,
      ...extraEnv
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  const h5Dist = path.join(tempRoot, "h5-dist");
  const jsonReport = path.join(tempRoot, "reports", "h5-size.json");
  const nonH5Dist = path.join(tempRoot, "weapp-dist");
  const oversizedSource = "a".repeat(245 * 1024);
  const appSource = "b".repeat(10 * 1024);

  writeFile(
    path.join(h5Dist, "index.html"),
    '<html><head><link href="/css/app.css" rel="stylesheet"></head><body><script src="/js/app.js"></script></body></html>'
  );
  writeFile(path.join(h5Dist, "css", "app.css"), ".app{color:#123456;}");
  writeFile(
    path.join(h5Dist, "js", "app.js"),
    `console.log("evaluation-page proof-item");\n${oversizedSource}\n//# sourceMappingURL=app.js.map\n`
  );
  writeFile(
    path.join(h5Dist, "js", "app.js.map"),
    JSON.stringify({
      version: 3,
      sources: [
        "webpack://./src/pages/evaluation/index.tsx",
        "webpack://./node_modules/@tarojs/components/dist/components/taro-swiper-core.js"
      ],
      sourcesContent: [appSource, oversizedSource],
      mappings: ""
    })
  );
  writeFile(path.join(h5Dist, "js", "feature.js"), "console.log('image-library');");
  writeFile(path.join(nonH5Dist, "app.js"), "console.log('mini');");

  const jsonResult = runAnalyze(h5Dist, { H5_SIZE_JSON: jsonReport }, ["--json"]);
  assert(jsonResult.status === 0, `H5 fixture 分析应通过：${jsonResult.stderr}`);
  assert(jsonResult.stdout.includes("H5 构建体积分析"), "应输出 H5 体积分析标题。");
  assert(jsonResult.stdout.includes("来源分组 Top"), "应输出 sourcemap 来源分组。");
  assert(fs.existsSync(jsonReport), "应写入 JSON 报告。");

  const report = JSON.parse(fs.readFileSync(jsonReport, "utf8"));
  assert(report.entrypointAssets.length === 2, "应识别 index.html 中的入口 JS/CSS。");
  assert(report.assets.some((asset) => asset.path === "js/app.js"), "JSON 应包含 app.js 资源。");
  assert(
    report.assets
      .find((asset) => asset.path === "js/app.js")
      ?.sourceMap.groups.some((group) => group.group === "npm:@tarojs/components"),
    "JSON 应包含 sourcemap npm 来源分组。"
  );
  assert(report.oversizedAssets.some((asset) => asset.path === "js/app.js"), "应识别超过推荐阈值的资源。");

  const strictResult = runAnalyze(h5Dist, { H5_SIZE_STRICT: "1" });
  assert(strictResult.status === 1, "严格模式遇到超阈值资源应失败。");

  const nonH5Result = runAnalyze(nonH5Dist);
  assert(nonH5Result.status !== 0, "非 H5 dist 应失败。");
  assert(nonH5Result.stderr.includes("当前 dist 不是 H5 构建产物"), "非 H5 dist 应提示先运行 H5 构建。");

  console.log("H5 体积分析测试通过。");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
