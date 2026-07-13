const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { buildResultsTemplate, getFlowType, readChecklistFlows } = require("./utils/smoke-checklist");

const projectRoot = path.resolve(__dirname, "..");
const checklistFileName = "h5-smoke-checklist.md";
const H5_SHELL_MARKERS = ['id="app"', "id='app'", "学生综合素质评定系统"];

function createDefaultArtifactDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join("output", "smoke", "h5-artifacts", timestamp);
}

function parseArgs(argv) {
  const result = {
    baseUrl: "http://localhost:10086",
    artifactDir: createDefaultArtifactDir(),
    out: "",
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
    } else if (arg === "--out" && next) {
      result.out = next;
      index += 1;
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

async function buildH5SmokeResults({ artifactDir, baseUrl, out, startedAt, timeoutMs }) {
  const flows = readChecklistFlows(checklistFileName);
  const baseTemplate = buildResultsTemplate(flows);
  const probe = await requestUrl(baseUrl, timeoutMs);
  const entryLog = writeEntryArtifact(artifactDir, probe);
  const completedAt = new Date().toISOString();
  const metadata = {
    runner: "h5-smoke-runner",
    baseUrl,
    timeoutMs,
    startedAt,
    completedAt,
    durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
    artifactDir: toProjectRelativePath(resolveArtifactDir(artifactDir)),
    resultsPath: out ? toProjectRelativePath(path.isAbsolute(out) ? out : path.join(projectRoot, out)) : "",
    entryResponseLog: entryLog,
    entryStatusCode: probe.statusCode,
    entryOk: probe.ok,
    entryError: probe.error
  };
  const metadataLog = writeMetadataArtifact(artifactDir, metadata);
  const skippedNote = probe.ok
    ? "自动化步骤尚未接入；当前脚本仅确认 H5 入口可访问且返回应用壳"
    : `H5 入口不可访问，后续步骤未执行：${probe.error || `HTTP ${probe.statusCode}`}`;

  return {
    meta: {
      ...metadata,
      metadataLog
    },
    steps: baseTemplate.steps.map((step, index) => {
      if (index === 0) {
        return {
          ...step,
          result: probe.ok ? "通过" : "失败",
          note: probe.ok ? `H5 入口可访问且返回应用壳：${baseUrl}（HTTP ${probe.statusCode}）` : skippedNote,
          log: entryLog
        };
      }

      return buildSkippedStep(step.flow, skippedNote);
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
}

void main();
