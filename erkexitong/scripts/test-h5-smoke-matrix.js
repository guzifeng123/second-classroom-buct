const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { readChecklistFlows } = require("./utils/smoke-checklist");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const tempRoot = path.join(projectRoot, "output", "playwright");
fs.mkdirSync(tempRoot, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tempRoot, "h5-smoke-matrix-test-"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createServer(handler) {
  const server = http.createServer(handler);

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve) => server.close(closeResolve))
      });
    });
  });
}

function runMatrix(baseUrl, caseName) {
  const outDir = path.join(tempDir, caseName, "results");
  const artifactRoot = path.join(tempDir, caseName, "artifacts");
  const args = [
    "scripts/run-h5-smoke-matrix.js",
    "--base-url",
    baseUrl,
    "--browsers",
    "chromium,msedge",
    "--static-only",
    "--out-dir",
    outDir,
    "--artifact-root",
    artifactRoot
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(nodeBin, args, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const summaryPath = path.join(outDir, "matrix-summary.json");
      try {
        assert(fs.existsSync(summaryPath), `${caseName} 应生成矩阵汇总。`);
        resolve({
          result: {
            status: code ?? -1,
            stdout,
            stderr
          },
          summary: JSON.parse(fs.readFileSync(summaryPath, "utf8")),
          outDir,
          artifactRoot
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function assertTargetEvidence(target, expectedFlowCount) {
  assert(target.resultsPath.endsWith(`${target.browser}-results.json`), `${target.browser} results 命名不正确。`);
  assert(target.artifactDir.endsWith(target.browser), `${target.browser} artifact 目录命名不正确。`);
  const resultsPath = path.join(projectRoot, target.resultsPath);
  const artifactDir = path.join(projectRoot, target.artifactDir);
  assert(fs.existsSync(resultsPath), `${target.browser} results 应存在。`);
  assert(fs.existsSync(path.join(artifactDir, "h5-static-checks.json")), `${target.browser} 静态检查证据应存在。`);
  assert(fs.existsSync(path.join(artifactDir, "h5-run-metadata.json")), `${target.browser} metadata 证据应存在。`);
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  assert(results.steps.length === expectedFlowCount, `${target.browser} steps 数量应与 checklist 一致。`);
  assert(results.steps.every((step) => step.log.endsWith("h5-static-checks.json")), `${target.browser} 应复用静态检查证据。`);
}

async function assertSuccessCase() {
  const server = await createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<html><head><title>学生综合素质评定系统</title></head><body><div id="app"></div></body></html>');
  });

  try {
    const flowCount = readChecklistFlows("h5-smoke-checklist.md").length;
    const { result, summary } = await runMatrix(server.baseUrl, "success");
    assert(result.status === 0, `矩阵静态预检成功时应返回 0：${result.stderr}`);
    assert(summary.runner === "h5-smoke-matrix", "汇总应记录 runner 名称。");
    assert(summary.baseUrl === server.baseUrl, "汇总应记录 baseUrl。");
    assert(summary.staticOnly === true, "汇总应记录 staticOnly。");
    assert(summary.targets.length === 2, "矩阵应包含两个浏览器通道。");
    assert(summary.targets.every((target) => target.ok), "成功矩阵每个通道都应通过。");
    summary.targets.forEach((target) => {
      assert(target.validationExitCode === 0, `${target.browser} 应通过严格 smoke results 校验。`);
      assert(target.validationStdout.includes("H5 smoke 结果 JSON 校验通过。"), `${target.browser} 应记录校验输出。`);
      assertTargetEvidence(target, flowCount);
    });
  } finally {
    await server.close();
  }
}

async function assertFailureCase() {
  const server = await createServer((request, response) => {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("");
  });

  try {
    const { result, summary } = await runMatrix(server.baseUrl, "entry-failure");
    assert(result.status !== 0, "入口失败时矩阵 runner 应返回非零。");
    assert(summary.targets.length === 2, "失败矩阵仍应记录全部通道。");
    assert(summary.targets.every((target) => !target.ok), "入口失败时每个通道都应失败。");
    summary.targets.forEach((target) => {
      assert(target.smokeExitCode !== 0, `${target.browser} smoke 进程应失败。`);
      assert(target.validationExitCode === 0, `${target.browser} 失败结果仍应符合 smoke results schema。`);
    });
  } finally {
    await server.close();
  }
}

async function main() {
  try {
    await assertSuccessCase();
    await assertFailureCase();
    console.log("H5 smoke 矩阵 runner 测试通过。");
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
