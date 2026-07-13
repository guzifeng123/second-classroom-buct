const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "erkexitong-h5-size-"));

function writeReport(fileName, overrides = {}) {
  const report = {
    generatedAt: "2026-07-10T00:00:00.000Z",
    recommendedLimitBytes: 244 * 1024,
    totals: {
      entrypointBytes: 200 * 1024,
      jsBytes: 600 * 1024,
      cssBytes: 80 * 1024,
      ...overrides.totals
    },
    entrypointAssets: overrides.entrypointAssets ?? [],
    assets: overrides.assets ?? [
      {
        path: "js/app.js",
        size: 200 * 1024,
        hints: [],
        sourceMap: {
          modules: [],
          groups: [{ group: "npm:@tarojs/components", size: 120 * 1024 }]
        }
      }
    ],
    oversizedAssets: overrides.oversizedAssets ?? []
  };
  const reportPath = path.join(tempRoot, fileName);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function runCompare(baseReport, currentReport, env = {}) {
  return spawnSync(process.execPath, ["scripts/compare-h5-size.js", baseReport, currentReport], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  const baseReport = writeReport("base.json");
  const sameReport = writeReport("same.json");
  const grownReport = writeReport("grown.json", {
    totals: {
      entrypointBytes: 230 * 1024,
      jsBytes: 640 * 1024
    },
    assets: [
      {
        path: "js/app.js",
        size: 230 * 1024,
        hints: [],
        sourceMap: {
          modules: [],
          groups: [{ group: "npm:@tarojs/components", size: 145 * 1024 }]
        }
      },
      {
        path: "js/feature.js",
        size: 30 * 1024,
        hints: ["评定页"],
        sourceMap: {
          modules: [],
          groups: [{ group: "page:evaluation/index", size: 30 * 1024 }]
        }
      }
    ],
    oversizedAssets: [{ path: "js/app.js", size: 230 * 1024, hints: [] }]
  });

  const sameResult = runCompare(baseReport, sameReport);
  assert(sameResult.status === 0, `无变化对比应通过：${sameResult.stderr}`);
  assert(sameResult.stdout.includes("无变化"), "无变化对比应输出无变化提示。");

  const grownResult = runCompare(baseReport, grownReport);
  assert(grownResult.status === 0, `非严格增长对比应通过：${grownResult.stderr}`);
  assert(grownResult.stdout.includes("资源 js/app.js 增长 +30.0 KiB"), "增长对比应输出资源增长提示。");
  assert(
    grownResult.stdout.includes("来源分组 npm:@tarojs/components 增长 +25.0 KiB"),
    "增长对比应输出来源分组增长提示。"
  );

  const strictResult = runCompare(baseReport, grownReport, { H5_SIZE_COMPARE_STRICT: "1" });
  assert(strictResult.status === 1, "严格模式下超过增长阈值应失败。");

  console.log("H5 体积对比测试通过。");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
