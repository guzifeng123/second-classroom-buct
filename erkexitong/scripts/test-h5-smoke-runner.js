const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const {
  H5_SWIPER_MARKERS,
  IMAGE_LIBRARY_FIXTURE_URLS,
  IMAGE_LIBRARY_STORAGE_KEY,
  createImageLibraryFixtures,
  hasSwiperRuntimeMarkers
} = require("./utils/h5-smoke-browser-flow");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const tempRoot = path.join(projectRoot, "output", "playwright");
fs.mkdirSync(tempRoot, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tempRoot, "h5-smoke-runner-test-"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertImageLibraryPreviewContract() {
  const uploadedAt = 1784000000000;
  const fixtures = createImageLibraryFixtures(uploadedAt);

  assert(IMAGE_LIBRARY_STORAGE_KEY === "erkexitong-image-library", "图片库 smoke 应写入正式本地缓存 key");
  assert(IMAGE_LIBRARY_FIXTURE_URLS.length >= 2, "图片库预览至少需要两张 data URL fixture");
  assert(fixtures.length === IMAGE_LIBRARY_FIXTURE_URLS.length, "fixture 构造结果数量不正确");
  assert(new Set(fixtures.map((fixture) => fixture.originalUrl)).size === fixtures.length, "fixture URL 必须互不相同");
  fixtures.forEach((fixture, index) => {
    assert(/^data:image\/[a-z0-9.+-]+;base64,/i.test(fixture.originalUrl), `fixture ${index + 1} 必须是图片 data URL`);
    assert(fixture.thumbUrl === fixture.originalUrl, `fixture ${index + 1} 缩略图应复用 data URL`);
    assert(fixture.uploadedAt === uploadedAt - index, `fixture ${index + 1} 上传时间应保持稳定顺序`);
    assert(fixture.usedCount === 0, `fixture ${index + 1} 应是未引用图片`);
  });

  assert(H5_SWIPER_MARKERS.length > 0, "Swiper 运行时标记不能为空");
  H5_SWIPER_MARKERS.forEach((marker) => {
    assert(hasSwiperRuntimeMarkers(`prefix:${marker}:suffix`), `应识别 Swiper 标记 ${marker}`);
  });
  assert(!hasSwiperRuntimeMarkers("image-preview__dialog"), "轻量图片预览标记不应被误判为 Swiper");

  const flowSource = fs.readFileSync(path.join(projectRoot, "scripts", "utils", "h5-smoke-browser-flow.js"), "utf8");
  [
    "smokeDirect=image-library",
    "JSON.stringify({ data: images })",
    "initialLoadJavaScriptUrls",
    "initialLoadHasSwiperMarkers",
    ".image-preview__dialog",
    ".image-preview__counter",
    ".image-preview__next",
    "图片资产预览入口不是原生按钮",
    'firstAsset.getAttribute("aria-label")',
    'firstAsset.press("Enter")',
    'firstAsset.press("Space")',
    "06-image-library-preview-desktop",
    "06-image-library-preview-mobile",
    "layoutShellCount",
    "layoutMasterCount",
    "desktopResponsiveChecks",
    "breakpointResponsiveChecks",
    "breakpointRoutes",
    "desktopRoutes",
    "layoutDetailCount",
    "inlineDetailCount",
    '["图片库页", "pages/image/library/index"]',
    '["图文编辑页", "pages/note/edit/index"]',
    '["提交前预览页", "pages/evaluation/preview/index"]',
    "viewportWidth: width",
    "width: 1179",
    "width: 1180",
    "shouldMountMaster: false",
    "shouldMountMaster: true",
    "layoutPresence.layoutShellCount === 0",
    "layoutPresence.layoutMasterCount === 0",
    "layoutPresence.layoutShellCount === 1",
    "layoutPresence.layoutMasterCount === 1",
    "layoutPresence.layoutDetailCount === 1",
    "layoutPresence.inlineDetailCount === expectedInlineDetailCount",
    "${flow} 在 1280px 视口未挂载评定页 master",
    "${flow} 在 ${width}px 视口 master 数量不符合断点预期",
    ".web-split-layout__master",
    "mobilePreviewNoOverflow",
    'page.keyboard.press("Escape")',
    "focusRestored"
  ].forEach((marker) => {
    assert(flowSource.includes(marker), `图片库预览 runner 缺少契约：${marker}`);
  });
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
      resolve({
        code: code ?? -1,
        stdout,
        stderr
      });
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

async function runSmokeAgainst(baseUrl, caseName) {
  const fileName = `${caseName}-results.json`;
  const resultsPath = path.join(tempDir, fileName);
  const artifactDir = path.join(tempDir, `${caseName}-artifacts`);
  const args = [
    "--base-url",
    baseUrl,
    "--out",
    resultsPath,
    "--artifact-dir",
    artifactDir,
    "--static-only"
  ];

  const execution = await runScriptAsync("scripts/run-h5-smoke.js", args);
  assert(fs.existsSync(resultsPath), `${caseName} 应在退出前写入结果 JSON`);

  return {
    execution,
    results: JSON.parse(fs.readFileSync(resultsPath, "utf8")),
    resultsPath
  };
}

async function assertSuccessCase() {
  const server = await createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<html><head><title>学生综合素质评定系统</title></head><body><div id="app"></div></body></html>');
  });

  try {
    const { execution, results, resultsPath } = await runSmokeAgainst(server.baseUrl, "static-success");

    assert(execution.code === 0, `静态预检成功时进程应返回 0，实际为 ${execution.code}：${execution.stderr}`);
    assert(Array.isArray(results.steps), "H5 smoke runner 应输出 steps 数组");
    assert(results.steps[0]?.flow === "登录页", "第一步应为登录页");
    assert(results.steps.every((step) => step.result === "跳过"), "--static-only 下所有流程都只能标记跳过");
    assert(!results.steps.some((step) => step.result === "通过"), "静态命中不得冒充真实浏览器交互通过");
    assert(
      results.steps.every((step) => step.note.includes("--static-only")),
      "每个静态预检步骤都应明确说明未启动浏览器"
    );
    assert(results.meta?.runner === "h5-smoke-runner", "结果 JSON 应包含 runner 元信息");
    assert(results.meta?.baseUrl === server.baseUrl, "结果元信息应记录 baseUrl");
    assert(results.meta?.browserMode === false, "--static-only 元信息应记录未运行浏览器");
    assert(results.meta?.browserChannel === "未启动（static-only）", "元信息应明确浏览器未启动");
    assert(typeof results.meta?.durationMs === "number", "结果元信息应记录耗时");
    assert(results.meta?.metadataLog?.endsWith("h5-run-metadata.json"), "结果元信息应记录 metadata artifact 路径");
    assert(results.meta?.staticChecksLog?.endsWith("h5-static-checks.json"), "结果元信息应记录静态覆盖检查 artifact 路径");
    assert(results.meta?.entryResponseLog?.endsWith("h5-entry-response.txt"), "元信息应记录入口响应片段日志路径");
    const entryArtifactPath = path.join(projectRoot, results.meta.entryResponseLog);
    assert(fs.existsSync(entryArtifactPath), "响应片段日志文件应存在");
    const artifactContent = fs.readFileSync(entryArtifactPath, "utf8");
    assert(artifactContent.includes("statusCode=200"), "响应片段日志应记录状态码");
    assert(artifactContent.includes('id="app"'), "响应片段日志应记录入口 HTML 片段");
    const metadataPath = path.join(projectRoot, results.meta.metadataLog);
    assert(fs.existsSync(metadataPath), "metadata artifact 文件应存在");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    assert(metadata.baseUrl === server.baseUrl, "metadata artifact 应记录 baseUrl");
    assert(metadata.entryResponseLog === results.meta.entryResponseLog, "metadata artifact 应关联入口响应日志");
    const staticChecksPath = path.join(projectRoot, results.meta.staticChecksLog);
    assert(fs.existsSync(staticChecksPath), "静态覆盖检查 artifact 文件应存在");
    const staticChecks = JSON.parse(fs.readFileSync(staticChecksPath, "utf8"));
    assert(staticChecks["评定页首页"]?.ok === true, "评定页首页静态覆盖检查应通过");
    assert(staticChecks["提交前预览页"]?.ok === true, "提交前预览页静态覆盖检查应通过");
    assert(
      results.steps.every((step) => step.log.endsWith("h5-static-checks.json")),
      "静态覆盖步骤应记录静态检查 artifact 路径"
    );

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
    const { execution, results } = await runSmokeAgainst(server.baseUrl, "entry-404");

    assert(execution.code !== 0, "H5 入口失败时 runner 必须返回非零退出码");
    assert(results.steps[0]?.result === "失败", "H5 入口 404 或空正文时登录页步骤应标记失败");
    assert(results.steps[0]?.note.includes("H5 入口不可访问"), "失败备注应说明入口不可访问");
    assert(results.steps[0]?.log.endsWith("h5-entry-response.txt"), "入口失败应关联入口响应日志");
    assert(results.steps.slice(1).every((step) => step.result === "跳过"), "入口失败时后续步骤应标记跳过");
    assert(results.steps.slice(1).every((step) => step.note.includes("H5 入口不可访问")), "跳过步骤应记录原因");
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
    const { execution, results } = await runSmokeAgainst(server.baseUrl, "missing-shell");

    assert(execution.code !== 0, "入口缺少应用壳时 runner 必须返回非零退出码");
    assert(results.steps[0]?.result === "失败", "缺少 H5 应用壳时登录页步骤应标记失败");
    assert(results.steps[0]?.note.includes("缺少 H5 应用根节点或标题"), "失败备注应说明缺少 H5 应用壳标记");
    assert(results.steps.slice(1).every((step) => step.result === "跳过"), "缺少应用壳时后续步骤应标记跳过");
  } finally {
    await server.close();
  }
}

async function main() {
  try {
    assertImageLibraryPreviewContract();
    await assertSuccessCase();
    await assertFailureCase();
    await assertMissingShellCase();
    console.log("H5 smoke runner 测试通过。");
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
