const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  forbiddenMarkers,
  imageLibraryRouteRawLimitBytes,
  requiredMarker
} = require("./validate-h5-preview-bundle");

const projectRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "erkexitong-h5-preview-bundle-"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function buildRouteRegistration(chunkId = "383") {
  return `Object.assign({"path":"pages/image/library/index","load":function load(){return[s.e(${JSON.stringify(
    chunkId
  )}).then(s.bind(s,6383))]}});`;
}

function createFixture(name, options = {}) {
  const distRoot = path.join(tempRoot, name);
  const chunkId = options.chunkId ?? "383";
  const appContent = options.appContent ?? buildRouteRegistration(chunkId);
  const routeContent = options.routeContent ?? `console.log(${JSON.stringify(requiredMarker)});`;

  writeFile(path.join(distRoot, "js", "app.aaaaaaaa.js"), appContent);

  if (options.writeRoute !== false) {
    writeFile(path.join(distRoot, "js", `${chunkId}.bbbbbbbb.js`), routeContent);
  }

  for (const [relativePath, content] of Object.entries(options.extraFiles ?? {})) {
    writeFile(path.join(distRoot, relativePath), content);
  }

  return distRoot;
}

function runValidator(distRoot) {
  return spawnSync(process.execPath, ["scripts/validate-h5-preview-bundle.js"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      H5_PREVIEW_BUNDLE_DIST_ROOT: distRoot
    }
  });
}

function assertFailed(result, expectedMessage, label) {
  assert(result.status !== 0, `${label} 应返回非零。`);
  assert(
    result.stderr.includes(expectedMessage),
    `${label} 应提示 ${expectedMessage}，实际 stderr：${result.stderr}`
  );
}

try {
  const validResult = runValidator(createFixture("成功 fixture 中文"));
  assert(validResult.status === 0, `合法 fixture 应通过：${validResult.stderr}`);
  assert(validResult.stdout.includes("H5 图片预览 bundle 校验通过"), "成功时应输出明确结论。");
  assert(validResult.stdout.includes(requiredMarker), "成功输出应标记轻量预览实现所在资源。");
  assert(validResult.stdout.includes("raw"), "成功输出应包含图片库 route chunk raw 尺寸。");

  const missingJsRoot = path.join(tempRoot, "缺少 js 目录");
  fs.mkdirSync(missingJsRoot, { recursive: true });
  assertFailed(runValidator(missingJsRoot), "未找到 H5 JS 目录", "缺少 JS 目录");

  const emptyJsRoot = path.join(tempRoot, "空 js 目录");
  fs.mkdirSync(path.join(emptyJsRoot, "js"), { recursive: true });
  assertFailed(runValidator(emptyJsRoot), "没有找到 .js 产物", "空 JS 目录");

  for (const [index, marker] of forbiddenMarkers.entries()) {
    const fixture = createFixture(`禁用标记-${index}`, {
      extraFiles: {
        "js/vendor.cccccccc.js": `console.log(${JSON.stringify(marker)});`
      }
    });
    const result = runValidator(fixture);
    assertFailed(result, marker, `禁用标记 ${marker}`);
    assert(result.stderr.includes("vendor.cccccccc.js"), `禁用标记 ${marker} 应报告命中文件。`);
  }

  const missingRequiredMarker = createFixture("缺少轻量预览标记", {
    routeContent: "console.log('image-library');"
  });
  assertFailed(runValidator(missingRequiredMarker), requiredMarker, "缺少轻量预览标记");

  const missingRouteMap = createFixture("缺少路由映射", {
    appContent: "console.log('app');"
  });
  assertFailed(runValidator(missingRouteMap), "未从 H5 JS 产物解析到图片库路由", "缺少路由映射");

  const multipleRouteMaps = createFixture("多个路由映射", {
    appContent: `${buildRouteRegistration("383")}\n${buildRouteRegistration("384")}`,
    extraFiles: {
      "js/384.cccccccc.js": `console.log(${JSON.stringify(requiredMarker)});`
    }
  });
  assertFailed(runValidator(multipleRouteMaps), "映射到多个 chunk", "多个路由映射");

  const missingRouteFile = createFixture("缺少路由文件", {
    writeRoute: false,
    extraFiles: {
      "js/preview-host.cccccccc.js": `console.log(${JSON.stringify(requiredMarker)});`
    }
  });
  assertFailed(runValidator(missingRouteFile), "没有对应的 JS 文件", "缺少路由文件");

  const duplicateRouteFiles = createFixture("重复路由文件", {
    extraFiles: {
      "js/383.cccccccc.js": `console.log(${JSON.stringify(requiredMarker)});`
    }
  });
  assertFailed(runValidator(duplicateRouteFiles), "对应多个 JS 文件", "重复路由文件");

  const exactLimitContent = `${requiredMarker}${"x".repeat(
    imageLibraryRouteRawLimitBytes - Buffer.byteLength(requiredMarker)
  )}`;
  assert(Buffer.byteLength(exactLimitContent) === imageLibraryRouteRawLimitBytes, "边界 fixture 尺寸应精确。");
  const exactLimitRoute = createFixture("达到 raw 上限", { routeContent: exactLimitContent });
  const exactLimitResult = runValidator(exactLimitRoute);
  assertFailed(exactLimitResult, `必须小于 ${imageLibraryRouteRawLimitBytes} B`, "达到 raw 上限");
  assert(
    exactLimitResult.stderr.includes(`raw 为 ${imageLibraryRouteRawLimitBytes} B`),
    "达到上限时应报告精确 raw 尺寸。"
  );

  console.log("H5 图片预览 bundle 校验测试通过。");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
