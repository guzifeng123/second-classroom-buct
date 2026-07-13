const fs = require("node:fs");
const path = require("node:path");
const { PAGE_MATRIX } = require("./page-matrix");

const projectRoot = path.resolve(__dirname, "..", "..");
const ALLOWED_RESULTS = new Set(["未执行", "通过", "失败", "跳过"]);

function readChecklistFlows(fileName) {
  const checklistPath = path.join(projectRoot, "docs", fileName);
  const checklist = fs.readFileSync(checklistPath, "utf8");
  const lines = checklist.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === "## 验收流程");

  if (startIndex < 0) {
    throw new Error(`${fileName} 缺少验收流程章节`);
  }

  const flows = [];

  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      break;
    }

    if (!trimmed.startsWith("|")) {
      continue;
    }

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 2 || cells[0] === "步骤" || /^-+$/.test(cells[0])) {
      continue;
    }

    flows.push(cells[1]);
  }

  if (flows.length === 0) {
    throw new Error(`${fileName} 未解析到验收流程`);
  }

  return flows;
}

function readChecklistVisualChecks(fileName) {
  const checklistPath = path.join(projectRoot, "docs", fileName);
  const checklist = fs.readFileSync(checklistPath, "utf8");
  const lines = checklist.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === "## 视觉检查");

  if (startIndex < 0) {
    throw new Error(`${fileName} 缺少视觉检查章节`);
  }

  const checks = [];

  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      break;
    }

    if (!trimmed.startsWith("- ")) {
      continue;
    }

    checks.push(trimmed.slice(2).replace(/[。；;]+$/, ""));
  }

  if (checks.length === 0) {
    throw new Error(`${fileName} 未解析到视觉检查项`);
  }

  return checks;
}

function getFlowType(flow) {
  return PAGE_MATRIX.find((page) => flow === page.name || flow.startsWith(page.name))?.type ?? "flow";
}

function escapeTableCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, "<br>")
    .replace(/\|/g, "\\|")
    .trim();
}

function normalizeStepResult(step) {
  if (!step || typeof step !== "object") {
    return null;
  }

  const flow = typeof step.flow === "string" ? step.flow.trim() : "";
  if (!flow) {
    return null;
  }

  return {
    flow,
    result: typeof step.result === "string" && step.result.trim() ? step.result.trim() : "未执行",
    note: typeof step.note === "string" ? step.note.trim() : "",
    screenshot: typeof step.screenshot === "string" ? step.screenshot.trim() : "",
    log: typeof step.log === "string" ? step.log.trim() : ""
  };
}

function normalizeSmokeResults(rawResults) {
  const steps = Array.isArray(rawResults?.steps) ? rawResults.steps : [];

  return steps.reduce((resultMap, step) => {
    const normalized = normalizeStepResult(step);
    if (normalized) {
      resultMap.set(normalized.flow, normalized);
    }
    return resultMap;
  }, new Map());
}

function readSmokeResults(projectRoot, resultPath) {
  return readSmokeResultPayload(projectRoot, resultPath).resultsByFlow;
}

function readSmokeResultPayload(projectRoot, resultPath) {
  if (!resultPath) {
    return {
      meta: null,
      resultsByFlow: new Map()
    };
  }

  const resolvedPath = path.isAbsolute(resultPath) ? resultPath : path.join(projectRoot, resultPath);
  const rawContent = fs.readFileSync(resolvedPath, "utf8");
  const rawResults = JSON.parse(rawContent);

  return {
    meta: rawResults?.meta && typeof rawResults.meta === "object" ? rawResults.meta : null,
    resultsByFlow: normalizeSmokeResults(rawResults)
  };
}

function buildStepRows(flows, resultsByFlow = new Map()) {
  return flows
    .map((flow, index) => {
      const stepResult = resultsByFlow.get(flow);
      const result = stepResult?.result ?? "未执行";
      const note = stepResult?.note ?? "";

      return `| ${index + 1} | ${escapeTableCell(flow)} | ${getFlowType(flow)} | ${escapeTableCell(result)} | ${escapeTableCell(note)} |`;
    })
    .join("\n");
}

function buildChecklistLines(items) {
  return items.map((item) => `- ${item}：`).join("\n");
}

function buildEvidenceLines(resultsByFlow) {
  const evidenceRows = Array.from(resultsByFlow.values()).filter((step) => step.screenshot || step.log);

  if (evidenceRows.length === 0) {
    return "截图或日志：";
  }

  return [
    "截图或日志：",
    ...evidenceRows.map((step) => {
      const evidence = [
        step.screenshot ? `截图 ${step.screenshot}` : "",
        step.log ? `日志 ${step.log}` : ""
      ].filter(Boolean).join("；");

      return `- ${step.flow}：${evidence}`;
    })
  ].join("\n");
}

function buildMetadataLines(meta) {
  if (!meta) {
    return "";
  }

  const rows = [
    ["Runner", meta.runner],
    ["Base URL", meta.baseUrl],
    ["开始时间", meta.startedAt],
    ["结束时间", meta.completedAt],
    ["耗时", typeof meta.durationMs === "number" ? `${meta.durationMs}ms` : ""],
    ["Artifact 目录", meta.artifactDir],
    ["Results", meta.resultsPath],
    ["Metadata", meta.metadataLog],
    ["入口响应", meta.entryResponseLog],
    ["入口状态", typeof meta.entryStatusCode === "number" ? `HTTP ${meta.entryStatusCode}` : ""],
    ["入口探测", typeof meta.entryOk === "boolean" ? (meta.entryOk ? "通过" : "失败") : ""],
    ["入口错误", meta.entryError]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  if (rows.length === 0) {
    return "";
  }

  return [
    "## Runner 元信息",
    "",
    "| 字段 | 内容 |",
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label)} | ${escapeTableCell(value)} |`),
    ""
  ].join("\n");
}

function buildResultsTemplate(flows) {
  return {
    steps: flows.map((flow) => ({
      flow,
      type: getFlowType(flow),
      result: "未执行",
      note: "",
      screenshot: "",
      log: ""
    }))
  };
}

function isRelativeEvidencePath(value) {
  return !value || (!path.isAbsolute(value) && !/^[a-zA-Z]+:\/\//.test(value));
}

function validateSmokeResults(rawResults, flows) {
  const errors = [];
  const steps = Array.isArray(rawResults?.steps) ? rawResults.steps : null;

  if (!steps) {
    return ["结果 JSON 缺少 steps 数组"];
  }

  if (steps.length !== flows.length) {
    errors.push(`steps 数量应为 ${flows.length}，实际为 ${steps.length}`);
  }

  flows.forEach((flow, index) => {
    const step = steps[index];
    const prefix = `第 ${index + 1} 步（${flow}）`;

    if (!step || typeof step !== "object") {
      errors.push(`${prefix} 应为对象`);
      return;
    }

    if (step.flow !== flow) {
      errors.push(`${prefix} flow 应为 ${flow}，实际为 ${step.flow ?? ""}`);
    }

    const expectedType = getFlowType(flow);
    if (step.type !== expectedType) {
      errors.push(`${prefix} type 应为 ${expectedType}，实际为 ${step.type ?? ""}`);
    }

    if (!ALLOWED_RESULTS.has(step.result)) {
      errors.push(`${prefix} result 应为 ${Array.from(ALLOWED_RESULTS).join("/")}，实际为 ${step.result ?? ""}`);
    }

    ["note", "screenshot", "log"].forEach((field) => {
      if (typeof step[field] !== "string") {
        errors.push(`${prefix} ${field} 应为字符串`);
      }
    });

    if (typeof step.screenshot === "string" && !isRelativeEvidencePath(step.screenshot)) {
      errors.push(`${prefix} screenshot 应使用项目内相对路径`);
    }

    if (typeof step.log === "string" && !isRelativeEvidencePath(step.log)) {
      errors.push(`${prefix} log 应使用项目内相对路径`);
    }
  });

  return errors;
}

module.exports = {
  ALLOWED_RESULTS,
  buildEvidenceLines,
  buildChecklistLines,
  buildMetadataLines,
  buildResultsTemplate,
  buildStepRows,
  escapeTableCell,
  getFlowType,
  normalizeSmokeResults,
  readSmokeResultPayload,
  readSmokeResults,
  validateSmokeResults,
  readChecklistFlows,
  readChecklistVisualChecks
};
