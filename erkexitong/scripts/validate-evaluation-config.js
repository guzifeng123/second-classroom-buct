const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

const configPath = path.join(projectRoot, "src", "data", "evaluationConfig.ts");
const expectedDimensionKeys = new Set(["moral", "academic", "sports", "aesthetic", "labor"]);
const expectedSectionKeys = new Set(["base", "extension"]);
const expectedTotalScore = 600;

function loadEvaluationConfig() {
  const moduleExports = loadTsModule(configPath);
  return {
    config: moduleExports.evaluationConfig,
    ruleVersion: moduleExports.EVALUATION_RULE_VERSION
  };
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validateItem(item, context, seenItemIds, errors) {
  if (!item.id || typeof item.id !== "string") {
    errors.push(`${context}: item.id 不能为空`);
    return;
  }

  if (seenItemIds.has(item.id)) {
    errors.push(`${context}: 条目 ID "${item.id}" 重复`);
  }
  seenItemIds.add(item.id);

  if (!isPositiveNumber(item.maxScore)) {
    errors.push(`${context}/${item.id}: maxScore 必须是正数`);
  }

  if (!["fixed", "select", "count", "number", "deduction"].includes(item.scoreType)) {
    errors.push(`${context}/${item.id}: scoreType "${item.scoreType}" 不受支持`);
  }

  if (!["single", "multi"].includes(item.mode)) {
    errors.push(`${context}/${item.id}: mode "${item.mode}" 不受支持`);
  }

  if (!Number.isInteger(item.imageLimit) || item.imageLimit < 0) {
    errors.push(`${context}/${item.id}: imageLimit 必须是非负整数`);
  }

  if (item.scoreType === "fixed") {
    if (!isPositiveNumber(item.fixedScore)) {
      errors.push(`${context}/${item.id}: fixed 类型必须配置 fixedScore`);
    } else if (item.fixedScore > item.maxScore) {
      errors.push(`${context}/${item.id}: fixedScore 不能超过 maxScore`);
    }
  }

  if (item.scoreType === "select") {
    if (!Array.isArray(item.options) || item.options.length === 0) {
      errors.push(`${context}/${item.id}: select 类型必须配置 options`);
    } else {
      const seenValues = new Set();
      item.options.forEach((option, optionIndex) => {
        const optionContext = `${context}/${item.id}/options[${optionIndex}]`;
        if (!option.label || typeof option.label !== "string") {
          errors.push(`${optionContext}: label 不能为空`);
        }
        if (!option.value || typeof option.value !== "string") {
          errors.push(`${optionContext}: value 不能为空`);
        }
        if (seenValues.has(option.value)) {
          errors.push(`${optionContext}: value "${option.value}" 重复`);
        }
        seenValues.add(option.value);
        if (typeof option.score !== "number" || !Number.isFinite(option.score) || option.score < 0) {
          errors.push(`${optionContext}: score 必须是非负数字`);
        } else if (option.score > item.maxScore) {
          errors.push(`${optionContext}: score 不能超过条目 maxScore`);
        }
      });
    }
  }

  if (item.scoreType === "count" && !isPositiveNumber(item.scorePerRecord)) {
    errors.push(`${context}/${item.id}: count 类型必须配置正数 scorePerRecord`);
  }

  if (item.scoreType === "number" && !isPositiveNumber(item.scorePerUnit)) {
    errors.push(`${context}/${item.id}: number 类型必须配置正数 scorePerUnit`);
  }

  if (item.scoreType === "deduction" && !isPositiveNumber(item.maxScore)) {
    errors.push(`${context}/${item.id}: deduction 类型必须配置正数 maxScore`);
  }
}

function validateEvaluationConfig(config) {
  const errors = [];
  const seenDimensionKeys = new Set();
  const seenItemIds = new Set();

  if (!Array.isArray(config) || config.length === 0) {
    return ["evaluationConfig 必须是非空数组"];
  }

  config.forEach((dimension) => {
    const dimensionContext = `dimension:${dimension.key ?? "<empty>"}`;
    if (!expectedDimensionKeys.has(dimension.key)) {
      errors.push(`${dimensionContext}: 未知维度 key`);
    }
    if (seenDimensionKeys.has(dimension.key)) {
      errors.push(`${dimensionContext}: 维度 key 重复`);
    }
    seenDimensionKeys.add(dimension.key);

    if (!isPositiveNumber(dimension.maxScore)) {
      errors.push(`${dimensionContext}: maxScore 必须是正数`);
    }
    if (!isPositiveNumber(dimension.baseMax)) {
      errors.push(`${dimensionContext}: baseMax 必须是正数`);
    }
    if (!isPositiveNumber(dimension.extensionMax)) {
      errors.push(`${dimensionContext}: extensionMax 必须是正数`);
    }
    if (dimension.baseMax + dimension.extensionMax !== dimension.maxScore) {
      errors.push(`${dimensionContext}: baseMax + extensionMax 必须等于 maxScore`);
    }

    if (!Array.isArray(dimension.sections) || dimension.sections.length === 0) {
      errors.push(`${dimensionContext}: sections 必须是非空数组`);
      return;
    }

    const seenSectionKeys = new Set();
    let sectionMaxTotal = 0;
    dimension.sections.forEach((section) => {
      const sectionContext = `${dimensionContext}/section:${section.key ?? "<empty>"}`;
      if (!expectedSectionKeys.has(section.key)) {
        errors.push(`${sectionContext}: 未知分区 key`);
      }
      if (seenSectionKeys.has(section.key)) {
        errors.push(`${sectionContext}: 分区 key 重复`);
      }
      seenSectionKeys.add(section.key);

      if (!isPositiveNumber(section.maxScore)) {
        errors.push(`${sectionContext}: maxScore 必须是正数`);
      }
      sectionMaxTotal += section.maxScore ?? 0;

      const expectedSectionMax = section.key === "base" ? dimension.baseMax : dimension.extensionMax;
      if (expectedSectionMax !== undefined && section.maxScore !== expectedSectionMax) {
        errors.push(`${sectionContext}: section.maxScore 必须等于维度对应分区上限`);
      }

      if (!Array.isArray(section.items) || section.items.length === 0) {
        errors.push(`${sectionContext}: items 必须是非空数组`);
        return;
      }

      section.items.forEach((item) => {
        validateItem(item, sectionContext, seenItemIds, errors);
        if (item.maxScore > section.maxScore) {
          errors.push(`${sectionContext}/${item.id}: 条目 maxScore 不能超过分区上限`);
        }
      });
    });

    if (sectionMaxTotal !== dimension.maxScore) {
      errors.push(`${dimensionContext}: 所有分区 maxScore 之和必须等于维度 maxScore`);
    }

    expectedSectionKeys.forEach((sectionKey) => {
      if (!seenSectionKeys.has(sectionKey)) {
        errors.push(`${dimensionContext}: 缺少 ${sectionKey} 分区`);
      }
    });
  });

  expectedDimensionKeys.forEach((dimensionKey) => {
    if (!seenDimensionKeys.has(dimensionKey)) {
      errors.push(`evaluationConfig: 缺少 ${dimensionKey} 维度`);
    }
  });

  const totalScore = config.reduce((sum, dimension) => sum + (dimension.maxScore ?? 0), 0);
  if (totalScore !== expectedTotalScore) {
    errors.push(`evaluationConfig: 五维总分必须为 ${expectedTotalScore}，当前为 ${totalScore}`);
  }

  return errors;
}

function validateRuleVersion(ruleVersion) {
  if (typeof ruleVersion !== "string" || !/^\d{4}\.\d{2}\.v\d+$/.test(ruleVersion)) {
    return ['EVALUATION_RULE_VERSION 必须使用 "YYYY.MM.vN" 格式，例如 "2026.07.v1"'];
  }

  return [];
}

const { config, ruleVersion } = loadEvaluationConfig();
const errors = [...validateRuleVersion(ruleVersion), ...validateEvaluationConfig(config)];

if (errors.length > 0) {
  console.error("评分配置校验失败：");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("评分配置校验通过。");
