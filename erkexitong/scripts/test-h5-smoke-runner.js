const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "h5-smoke-runner-"));
const artifactDir = path.join("output", "smoke", `h5-runner-test-${Date.now()}`);
const defaultArtifactRoot = path.join(projectRoot, "output", "smoke", "h5-artifacts");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runScript(script, args) {
  return execFileSync(nodeBin, [script, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function runScriptAsync(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeBin, [script, ...args], {
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
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || stdout || `${script} exited with ${code}`));
    });
  });
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

async function runSmokeAgainst(baseUrl, fileName, options = {}) {
  const resultsPath = path.join(tempDir, fileName);
  const args = ["--base-url", baseUrl, "--out", resultsPath];

  if (options.artifactDir) {
    args.push("--artifact-dir", options.artifactDir);
  }

  await runScriptAsync("scripts/run-h5-smoke.js", args);
  return JSON.parse(fs.readFileSync(resultsPath, "utf8"));
}

async function assertSuccessCase() {
  const server = await createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<html><head><title>学生综合素质评定系统</title></head><body><div id="app"></div></body></html>');
  });

  try {
    const results = await runSmokeAgainst(server.baseUrl, "h5-success-results.json", { artifactDir });

    assert(Array.isArray(results.steps), "H5 smoke runner 应输出 steps 数组");
    assert(results.steps[0]?.flow === "登录页", "第一步应为登录页");
    assert(results.steps[0]?.result === "通过", "H5 入口可访问且返回应用壳时登录页步骤应标记通过");
    assert(results.steps[0]?.note.includes("返回应用壳"), "通过备注应说明入口返回应用壳");
    assert(results.meta?.runner === "h5-smoke-runner", "结果 JSON 应包含 runner 元信息");
    assert(results.meta?.baseUrl === server.baseUrl, "结果元信息应记录 baseUrl");
    assert(typeof results.meta?.durationMs === "number", "结果元信息应记录耗时");
    assert(results.meta?.metadataLog?.endsWith("h5-run-metadata.json"), "结果元信息应记录 metadata artifact 路径");
    assert(results.steps[0]?.log.endsWith("h5-entry-response.txt"), "入口步骤应记录响应片段日志路径");
    const artifactPath = path.join(projectRoot, results.steps[0].log);
    assert(fs.existsSync(artifactPath), "响应片段日志文件应存在");
    const artifactContent = fs.readFileSync(artifactPath, "utf8");
    assert(artifactContent.includes("statusCode=200"), "响应片段日志应记录状态码");
    assert(artifactContent.includes('id="app"'), "响应片段日志应记录入口 HTML 片段");
    const metadataPath = path.join(projectRoot, results.meta.metadataLog);
    assert(fs.existsSync(metadataPath), "metadata artifact 文件应存在");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    assert(metadata.baseUrl === server.baseUrl, "metadata artifact 应记录 baseUrl");
    assert(metadata.entryResponseLog === results.steps[0].log, "metadata artifact 应关联入口响应日志");
    assert(results.steps.slice(1).every((step) => step.result === "跳过"), "未接入自动化的后续步骤应标记跳过");

    const resultsPath = path.join(tempDir, "h5-success-results.json");
    const validateOutput = runScript("scripts/validate-smoke-results.js", [
      "--target",
      "h5",
      "--results",
      resultsPath
    ]);
    assert(validateOutput.includes("H5 smoke 结果 JSON 校验通过。"), "runner 输出应通过 smoke results 校验");
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
    const results = await runSmokeAgainst(server.baseUrl, "h5-failure-results.json", { artifactDir });

    assert(results.steps[0]?.result === "失败", "H5 入口 404 或空正文时登录页步骤应标记失败");
    assert(results.steps[0]?.note.includes("H5 入口不可访问"), "失败备注应说明入口不可访问");
    assert(results.steps.slice(1).every((step) => step.result === "跳过"), "入口失败时后续步骤应标记跳过");
  } finally {
    await server.close();
  }
}

async function assertMissingShellCase() {
  const server = await createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<html><body>plain html without app root</body></html>");
  });

  try {
    const results = await runSmokeAgainst(server.baseUrl, "h5-missing-shell-results.json", { artifactDir });

    assert(results.steps[0]?.result === "失败", "缺少 H5 应用壳时登录页步骤应标记失败");
    assert(results.steps[0]?.note.includes("缺少 H5 应用根节点或标题"), "失败备注应说明缺少 H5 应用壳标记");
    assert(results.steps.slice(1).every((step) => step.result === "跳过"), "缺少应用壳时后续步骤应标记跳过");
  } finally {
    await server.close();
  }
}

async function assertDefaultArtifactCase() {
  const server = await createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<html><head><title>学生综合素质评定系统</title></head><body><div id="app"></div></body></html>');
  });

  try {
    const results = await runSmokeAgainst(server.baseUrl, "h5-default-artifact-results.json");
    const logPath = results.steps[0]?.log ?? "";

    assert(logPath.startsWith("output/smoke/h5-artifacts/"), "未传 artifact-dir 时应使用默认 artifact 目录");
    assert(results.meta?.metadataLog?.startsWith("output/smoke/h5-artifacts/"), "默认 artifact 目录应记录 metadata 路径");
    assert(fs.existsSync(path.join(projectRoot, logPath)), "默认 artifact 日志文件应存在");
  } finally {
    await server.close();
  }
}

async function main() {
  try {
    await assertSuccessCase();
    await assertFailureCase();
    await assertMissingShellCase();
    await assertDefaultArtifactCase();
    console.log("H5 smoke runner 测试通过。");
  } finally {
    fs.rmSync(path.join(projectRoot, artifactDir), { force: true, recursive: true });
    fs.rmSync(defaultArtifactRoot, { force: true, recursive: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
