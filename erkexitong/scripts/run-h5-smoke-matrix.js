const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nodeBin = process.execPath;

function createDefaultRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const result = {
    artifactRoot: "",
    baseUrl: "http://localhost:10086",
    browsers: ["msedge"],
    headed: false,
    outDir: "",
    staticOnly: false,
    timeoutMs: 5000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--artifact-root" && next) {
      result.artifactRoot = next;
      index += 1;
    } else if (arg === "--base-url" && next) {
      result.baseUrl = next;
      index += 1;
    } else if (arg === "--browsers" && next) {
      result.browsers = next.split(",").map((browser) => browser.trim()).filter(Boolean);
      index += 1;
    } else if (arg === "--headed") {
      result.headed = true;
    } else if (arg === "--out-dir" && next) {
      result.outDir = next;
      index += 1;
    } else if (arg === "--static-only") {
      result.staticOnly = true;
    } else if (arg === "--timeout-ms" && next) {
      result.timeoutMs = Number(next);
      index += 1;
    }
  }

  if (result.browsers.length === 0) {
    throw new Error("请通过 --browsers 指定至少一个浏览器通道，例如 chromium,msedge。");
  }

  if (!Number.isFinite(result.timeoutMs) || result.timeoutMs <= 0) {
    throw new Error("--timeout-ms 必须是正数。");
  }

  const runId = createDefaultRunId();
  result.outDir = result.outDir || path.join("output", "smoke", "h5-matrix", runId);
  result.artifactRoot = result.artifactRoot || path.join("output", "playwright", "h5-smoke-matrix", runId);
  return result;
}

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
}

function sanitizeName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "browser";
}

function runCommand(label, args) {
  const result = spawnSync(nodeBin, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    label,
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runBrowserTarget(options, browser) {
  const browserName = sanitizeName(browser);
  const outPath = resolveProjectPath(path.join(options.outDir, `${browserName}-results.json`));
  const artifactDir = resolveProjectPath(path.join(options.artifactRoot, browserName));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  const smokeArgs = [
    "scripts/run-h5-smoke.js",
    "--base-url",
    options.baseUrl,
    "--browser",
    browser,
    "--out",
    outPath,
    "--artifact-dir",
    artifactDir,
    "--timeout-ms",
    String(options.timeoutMs)
  ];

  if (options.headed) {
    smokeArgs.push("--headed");
  }

  if (options.staticOnly) {
    smokeArgs.push("--static-only");
  }

  const smokeRun = runCommand(`H5 smoke ${browser}`, smokeArgs);
  const validationRun = fs.existsSync(outPath)
    ? runCommand(`H5 smoke 结果校验 ${browser}`, [
      "scripts/validate-smoke-results.js",
      "--target",
      "h5",
      "--results",
      outPath
    ])
    : {
      label: `H5 smoke 结果校验 ${browser}`,
      status: 1,
      stdout: "",
      stderr: "结果 JSON 未生成。"
    };

  return {
    browser,
    ok: smokeRun.status === 0 && validationRun.status === 0,
    resultsPath: toProjectPath(outPath),
    artifactDir: toProjectPath(artifactDir),
    smokeExitCode: smokeRun.status,
    validationExitCode: validationRun.status,
    smokeStdout: smokeRun.stdout.trim(),
    smokeStderr: smokeRun.stderr.trim(),
    validationStdout: validationRun.stdout.trim(),
    validationStderr: validationRun.stderr.trim()
  };
}

function buildSummary(options, targets) {
  return {
    runner: "h5-smoke-matrix",
    baseUrl: options.baseUrl,
    browsers: options.browsers,
    staticOnly: options.staticOnly,
    headed: options.headed,
    timeoutMs: options.timeoutMs,
    outDir: toProjectPath(resolveProjectPath(options.outDir)),
    artifactRoot: toProjectPath(resolveProjectPath(options.artifactRoot)),
    targets
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const resolvedOutDir = resolveProjectPath(options.outDir);
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const targets = options.browsers.map((browser) => runBrowserTarget(options, browser));
  const summary = buildSummary(options, targets);
  const summaryPath = path.join(resolvedOutDir, "matrix-summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  targets.forEach((target) => {
    console.log(
      `[h5-smoke-matrix] ${target.browser}: ${target.ok ? "通过" : "失败"}；results=${target.resultsPath}；artifacts=${target.artifactDir}`
    );
  });
  console.log(`[h5-smoke-matrix] 汇总：${toProjectPath(summaryPath)}`);

  if (targets.some((target) => !target.ok)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
