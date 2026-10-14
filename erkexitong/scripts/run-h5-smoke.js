const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { buildResultsTemplate, getFlowType, readChecklistFlows } = require("./utils/smoke-checklist");
const { runH5SmokeBrowserFlow } = require("./utils/h5-smoke-browser-flow");
const { PAGE_MATRIX, parseAppPages, parseH5DetailRoutes } = require("./utils/page-matrix");

const projectRoot = path.resolve(__dirname, "..");
const checklistFileName = "h5-smoke-checklist.md";
const H5_SHELL_MARKERS = ['id="app"', "id='app'", "学生综合素质评定系统"];
const STATIC_FLOW_CHECKS = {
  登录页: {
    route: "pages/login/index",
    files: ["src/pages/login/index.tsx"],
    keywords: ["登录", "离线模式", "在线模式", "API"]
  },
  评定页首页: {
    route: "pages/evaluation/index",
    files: [
      "src/pages/evaluation/index.tsx",
      "src/pages/evaluation/components/EvaluationHero.tsx",
      "src/pages/evaluation/components/EvaluationStatusBar.tsx"
    ],
    keywords: ["综合素质评价平台", "提交记录", "离线演示", "预览"]
  },
  评定页填报: {
    route: "pages/evaluation/index",
    files: [
      "src/pages/evaluation/components/EvaluationWorkspace.tsx",
      "src/components/EvaluationPanel/index.tsx",
      "src/components/ProofItem/index.tsx"
    ],
    keywords: ["添加", "图片库", "图文库", "保存"]
  },
  保存草稿: {
    route: "pages/evaluation/index",
    files: ["src/stores/useEvaluationStore.ts", "src/utils/feedbackMessages.ts"],
    keywords: ["saveDraft", "本地暂存", "远端同步失败"]
  },
  图片上传区域: {
    route: "pages/evaluation/index",
    files: ["src/components/UploadImageButton/index.tsx", "src/services/upload.ts", "src/utils/uploadNormalization.ts"],
    keywords: ["重试", "取消", "失败", "progress"]
  },
  图片库页: {
    route: "pages/image/library/index",
    files: ["src/pages/image/library/index.tsx", "src/services/imageLibraryService.ts"],
    keywords: ["筛选", "排序", "重置", "图片库"]
  },
  图文材料列表页: {
    route: "pages/note/list/index",
    files: ["src/pages/note/list/index.tsx", "src/services/noteService.ts"],
    keywords: ["搜索", "新建图文材料", "图文材料读取失败"]
  },
  图文编辑页: {
    route: "pages/note/edit/index",
    files: ["src/pages/note/edit/index.tsx", "src/stores/useNoteStore.ts"],
    keywords: ["图文材料草稿", "预览", "已保存草稿", "清空图文草稿"]
  },
  图文快照页: {
    route: "pages/note/snapshot/index",
    files: ["src/pages/note/snapshot/index.tsx", "src/services/noteSnapshotService.ts"],
    keywords: ["snapshotKey", "图文材料快照", "提交时保留的内容", "enableImagePreview"]
  },
  图文材料引用: {
    route: "pages/evaluation/index",
    files: ["src/components/ProofItem/index.tsx", "src/utils/noteSnapshot.ts"],
    keywords: ["已引用图文材料", "原图文", "快照"]
  },
  提交前预览页: {
    route: "pages/evaluation/preview/index",
    files: ["src/pages/evaluation/preview/index.tsx", "src/utils/evaluationValidation.ts"],
    keywords: ["待完善", "材料明细", "buildIssueFocusUrl", "提交"]
  },
  定位校验问题: {
    route: "pages/evaluation/index",
    files: ["src/utils/evaluationIssueFocus.ts", "src/pages/evaluation/index.tsx", "src/components/ProofItem/index.tsx"],
    keywords: ["focusItem", "focusImageIndex", "focused", "focusUpload"]
  },
  提交失败提示: {
    route: "pages/evaluation/index",
    files: ["src/pages/evaluation/hooks/useEvaluationActions.ts", "src/utils/feedbackMessages.ts", "src/services/evaluationService.ts"],
    keywords: ["定位修改", "离线模式不能提交", "本机草稿仍然保留"]
  },
  提交结果页: {
    route: "pages/submission/result/index",
    files: ["src/pages/submission/result/index.tsx", "src/services/submissionService.ts"],
    keywords: ["提交结果", "评分规则", "提交材料快照"]
  },
  提交历史页: {
    route: "pages/submission/history/index",
    files: ["src/pages/submission/history/index.tsx", "src/utils/reviewStatus.ts"],
    keywords: ["提交记录", "退回原因", "去补充"]
  },
  状态说明页: {
    route: "pages/error/index",
    files: ["src/pages/error/index.tsx"],
    keywords: ["返回", "离线", "同步"]
  }
};

function createDefaultArtifactDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join("output", "playwright", "h5-smoke-runner", timestamp);
}

function parseArgs(argv) {
  const result = {
    baseUrl: "http://localhost:10086",
    artifactDir: createDefaultArtifactDir(),
    browser: "msedge",
    headed: false,
    out: "",
    staticOnly: false,
    timeoutMs: 5000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--base-url" && next) {
      result.baseUrl = next;
      index += 1;
    } else if (arg === "--artifact-dir" && next) {
      result.artifactDir = next;
      index += 1;
    } else if (arg === "--browser" && next) {
      result.browser = next;
      index += 1;
    } else if (arg === "--headed") {
      result.headed = true;
    } else if (arg === "--out" && next) {
      result.out = next;
      index += 1;
    } else if (arg === "--static-only") {
      result.staticOnly = true;
    } else if (arg === "--timeout-ms" && next) {
      result.timeoutMs = Number(next);
      index += 1;
    }
  }

  return result;
}

function requestUrl(url, timeoutMs) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, { timeout: timeoutMs }, (response) => {
      const chunks = [];
      let bodyLength = 0;

      response.on("data", (chunk) => {
        if (bodyLength < 4096) {
          chunks.push(chunk);
        }
        bodyLength += chunk.length;
      });

      response.on("end", () => {
        const statusCode = response.statusCode ?? 0;
        const body = Buffer.concat(chunks).toString("utf8").trim();
        const hasBody = body.length > 0 || bodyLength > 0;
        const statusOk = statusCode >= 200 && statusCode < 400;
        const hasShellMarker = H5_SHELL_MARKERS.some((marker) => body.includes(marker));

        resolve({
          ok: statusOk && hasBody && hasShellMarker,
          statusCode,
          error: statusOk ? (hasBody ? (hasShellMarker ? "" : "响应正文缺少 H5 应用根节点或标题") : "响应正文为空") : `HTTP ${statusCode}`,
          bodyPreview: body
        });
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error(`请求超时 ${timeoutMs}ms`));
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        statusCode: 0,
        error: error.message,
        bodyPreview: ""
      });
    });
  });
}

function toProjectRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function writeEntryArtifact(artifactDir, probe) {
  if (!artifactDir) {
    return "";
  }

  const resolvedDir = path.isAbsolute(artifactDir) ? artifactDir : path.join(projectRoot, artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const artifactPath = path.join(resolvedDir, "h5-entry-response.txt");
  const content = [
    `statusCode=${probe.statusCode}`,
    `ok=${probe.ok ? "true" : "false"}`,
    `error=${probe.error}`,
    "",
    probe.bodyPreview || "<empty response body>"
  ].join("\n");

  fs.writeFileSync(artifactPath, content, "utf8");
  return toProjectRelativePath(artifactPath);
}

function resolveArtifactDir(artifactDir) {
  return path.isAbsolute(artifactDir) ? artifactDir : path.join(projectRoot, artifactDir);
}

function writeMetadataArtifact(artifactDir, metadata) {
  const resolvedDir = resolveArtifactDir(artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const metadataPath = path.join(resolvedDir, "h5-run-metadata.json");
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return toProjectRelativePath(metadataPath);
}

function writeStaticChecksArtifact(artifactDir, staticChecks) {
  const resolvedDir = resolveArtifactDir(artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const artifactPath = path.join(resolvedDir, "h5-static-checks.json");
  fs.writeFileSync(artifactPath, `${JSON.stringify(staticChecks, null, 2)}\n`, "utf8");
  return toProjectRelativePath(artifactPath);
}

function writeBrowserDiagnosticsArtifact(artifactDir, diagnostics) {
  const resolvedDir = resolveArtifactDir(artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const artifactPath = path.join(resolvedDir, "h5-browser-diagnostics.json");
  fs.writeFileSync(artifactPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  return toProjectRelativePath(artifactPath);
}

function createSmokeImageFixture(artifactDir) {
  const fixturePath = path.join(artifactDir, "smoke-image.png");
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
    "base64"
  );
  fs.writeFileSync(fixturePath, onePixelPng);
  return fixturePath;
}

function normalizeBrowserScreenshot(filePath, artifactDir) {
  if (!filePath) {
    return "";
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(resolveArtifactDir(artifactDir), filePath);
  return toProjectRelativePath(resolvedPath);
}

async function runBrowserSmoke({ artifactDir, baseUrl, browser, headed, timeoutMs }) {
  const resolvedDir = resolveArtifactDir(artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });
  const tracePath = path.join(resolvedDir, "h5-browser-trace.zip");
  const imageFixturePath = createSmokeImageFixture(resolvedDir);
  const launchOptions = {
    headless: !headed
  };
  if (browser && browser !== "chromium") {
    launchOptions.channel = browser;
  }
  let browserInstance;
  let context;
  let payload;
  let phase = "启动浏览器";

  try {
    browserInstance = await chromium.launch(launchOptions);
    phase = "创建浏览器上下文";
    context = await browserInstance.newContext();
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    phase = "打开 H5 入口";
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    phase = "执行 H5 交互流程";
    payload = await runH5SmokeBrowserFlow(page, {
      artifactDir: resolvedDir,
      baseUrl,
      imageFixturePath,
      timeoutMs
    });
    phase = "写入浏览器 trace";
    await context.tracing.stop({ path: tracePath });
    phase = "关闭浏览器";
    await browserInstance.close();
    context = undefined;
    browserInstance = undefined;
    const diagnosticsLog = writeBrowserDiagnosticsArtifact(artifactDir, payload.diagnostics ?? {});

    return {
      ok: true,
      completed: true,
      fatalError: payload.diagnostics?.fatalError ?? "",
      steps: payload.steps ?? {},
      diagnosticsLog,
      traceLog: toProjectRelativePath(tracePath),
      mobileScreenshots: (payload.diagnostics?.mobileScreenshots ?? []).map((filePath) =>
        normalizeBrowserScreenshot(filePath, artifactDir)
      )
    };
  } catch (error) {
    if (context) {
      try {
        await context.tracing.stop({ path: tracePath });
      } catch {
        // Preserve the original browser failure.
      }
    }
    if (browserInstance) {
      try {
        await browserInstance.close();
      } catch {
        // Preserve the original browser failure.
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    const diagnosticsLog = writeBrowserDiagnosticsArtifact(artifactDir, {
      ...(payload?.diagnostics ?? {}),
      browserErrorPhase: phase,
      browserError: message
    });
    return {
      ok: false,
      completed: false,
      error: message,
      fatalError: payload?.diagnostics?.fatalError ?? "",
      steps: payload?.steps ?? {},
      diagnosticsLog,
      traceLog: fs.existsSync(tracePath) ? toProjectRelativePath(tracePath) : "",
      mobileScreenshots: []
    };
  }
}

function readProjectFile(relativePath) {
  const filePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function buildStaticFlowChecks(flows) {
  const appConfig = readProjectFile(path.join("src", "app.config.ts")) ?? "";
  const detailNavigation = readProjectFile(path.join("src", "utils", "detailNavigation.ts")) ?? "";
  const registeredPages = parseAppPages(appConfig);
  const h5DetailRoutes = parseH5DetailRoutes(detailNavigation);
  const smokeRoutes = new Set(PAGE_MATRIX.filter((page) => page.smoke).map((page) => page.route));

  return flows.reduce((checks, flow) => {
    const spec = STATIC_FLOW_CHECKS[flow];

    if (!spec) {
      checks[flow] = {
        ok: false,
        note: "未配置静态覆盖检查"
      };
      return checks;
    }

    const missingFiles = spec.files.filter((file) => !fs.existsSync(path.join(projectRoot, file)));
    const contents = spec.files.map((file) => readProjectFile(file) ?? "").join("\n");
    const missingKeywords = spec.keywords.filter((keyword) => !contents.includes(keyword));
    const routeRegistered = registeredPages.includes(spec.route);
    const detailRouteOk = getFlowType(flow) !== "detail" || h5DetailRoutes.includes(spec.route);
    const smokeRouteOk = smokeRoutes.has(spec.route);
    const errors = [
      routeRegistered ? "" : `路由未注册：${spec.route}`,
      detailRouteOk ? "" : `H5 详情白名单缺少：${spec.route}`,
      smokeRouteOk ? "" : `页面矩阵未标记 smoke：${spec.route}`,
      ...missingFiles.map((file) => `缺少文件：${file}`),
      ...missingKeywords.map((keyword) => `缺少关键词：${keyword}`)
    ].filter(Boolean);

    checks[flow] = {
      ok: errors.length === 0,
      route: spec.route,
      files: spec.files,
      keywords: spec.keywords,
      errors
    };

    return checks;
  }, {});
}

function buildSkippedStep(flow, note) {
  return {
    flow,
    type: getFlowType(flow),
    result: "跳过",
    note,
    screenshot: "",
    log: ""
  };
}

async function buildH5SmokeResults({
  artifactDir,
  baseUrl,
  browser,
  headed,
  out,
  startedAt,
  staticOnly,
  timeoutMs
}) {
  const flows = readChecklistFlows(checklistFileName);
  const baseTemplate = buildResultsTemplate(flows);
  const probe = await requestUrl(baseUrl, timeoutMs);
  const entryLog = writeEntryArtifact(artifactDir, probe);
  const staticChecks = buildStaticFlowChecks(flows);
  const staticChecksLog = writeStaticChecksArtifact(artifactDir, staticChecks);
  const browserResult = probe.ok && !staticOnly
    ? await runBrowserSmoke({ artifactDir, baseUrl, browser, headed, timeoutMs })
    : null;
  const browserStepFailures = Object.values(browserResult?.steps ?? {}).filter((step) => step.status === "failed").length;
  const browserFatalError = browserResult?.fatalError ?? "";
  const completedAt = new Date().toISOString();
  const metadata = {
    runner: "h5-smoke-runner",
    baseUrl,
    browserChannel: staticOnly ? "未启动（static-only）" : browser,
    browserMode: !staticOnly,
    headed,
    timeoutMs,
    startedAt,
    completedAt,
    durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
    artifactDir: toProjectRelativePath(resolveArtifactDir(artifactDir)),
    resultsPath: out ? toProjectRelativePath(path.isAbsolute(out) ? out : path.join(projectRoot, out)) : "",
    entryResponseLog: entryLog,
    staticChecksLog,
    browserDiagnosticsLog: browserResult?.diagnosticsLog ?? "",
    browserTraceLog: browserResult?.traceLog ?? "",
    mobileScreenshots: browserResult?.mobileScreenshots ?? [],
    entryStatusCode: probe.statusCode,
    entryOk: probe.ok,
    entryError: probe.error,
    browserCompleted: browserResult?.completed ?? false,
    browserOk: Boolean(browserResult?.ok && !browserFatalError && browserStepFailures === 0),
    browserStepFailures,
    browserFatalError,
    browserError: browserResult?.error ?? ""
  };
  const metadataLog = writeMetadataArtifact(artifactDir, metadata);
  const probeFailureNote = `H5 入口不可访问，后续步骤未执行：${probe.error || `HTTP ${probe.statusCode}`}`;
  const staticOnlyNote = "已完成入口和源码静态预检；--static-only 未启动浏览器，不能标记真实交互通过";
  const browserFailureNote = `真实浏览器 smoke 未启动或中断：${browserResult?.error || "未知错误"}`;
  const fatalFailureFlow = browserFatalError
    ? baseTemplate.steps.find((step) => !browserResult?.steps?.[step.flow])?.flow ?? baseTemplate.steps[0]?.flow
    : "";

  return {
    meta: {
      ...metadata,
      metadataLog
    },
    steps: baseTemplate.steps.map((step, index) => {
      const staticCheck = staticChecks[step.flow];

      if (!probe.ok) {
        if (index === 0) {
          return {
            ...step,
            result: "失败",
            note: probeFailureNote,
            log: entryLog
          };
        }

        return buildSkippedStep(step.flow, probeFailureNote);
      }

      if (staticOnly) {
        return {
          ...step,
          result: "跳过",
          note: `${staticOnlyNote}；当前流程静态检查${staticCheck?.ok ? "通过" : "失败"}`,
          log: staticChecksLog
        };
      }

      if (!browserResult?.ok) {
        if (index === 0) {
          return {
            ...step,
            result: "失败",
            note: browserFailureNote,
            log: browserResult?.diagnosticsLog ?? entryLog
          };
        }

        return buildSkippedStep(step.flow, browserFailureNote);
      }

      const browserStep = browserResult.steps?.[step.flow];
      if (step.flow === fatalFailureFlow) {
        return {
          ...step,
          result: "失败",
          note: `${browserStep?.note ? `${browserStep.note}；` : ""}真实浏览器流程中断：${browserFatalError}`,
          screenshot: normalizeBrowserScreenshot(browserStep?.screenshot, artifactDir),
          log: browserResult.diagnosticsLog
        };
      }

      if (!browserStep) {
        return {
          ...step,
          result: "跳过",
          note: browserFatalError
            ? `真实浏览器流程已中断，当前步骤未执行：${browserFatalError}`
            : "当前真实浏览器 runner 尚未覆盖此流程",
          log: browserResult.diagnosticsLog
        };
      }

      const resultByStatus = {
        passed: "通过",
        failed: "失败",
        skipped: "跳过"
      };
      const staticFailure = !staticCheck?.ok;
      return {
        ...step,
        result: staticFailure ? "失败" : resultByStatus[browserStep.status] ?? "失败",
        note: staticFailure
          ? `${browserStep.note || "浏览器步骤已执行"}；静态预检失败：${staticCheck?.errors?.join("；") || staticCheck?.note || "未知原因"}`
          : browserStep.note,
        screenshot: normalizeBrowserScreenshot(browserStep.screenshot, artifactDir),
        log: browserResult.diagnosticsLog
      };
    })
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = await buildH5SmokeResults({
    ...args,
    startedAt: new Date().toISOString()
  });
  const content = `${JSON.stringify(results, null, 2)}\n`;

  if (args.out) {
    const outputPath = path.isAbsolute(args.out) ? args.out : path.join(projectRoot, args.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf8");
    console.log(`H5 smoke 自动化结果已生成：${outputPath}`);
  } else {
    process.stdout.write(content);
  }

  if (results.steps.some((step) => step.result === "失败")) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
