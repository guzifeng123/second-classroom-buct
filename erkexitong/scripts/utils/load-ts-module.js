const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..", "..");
const moduleCache = new Map();

function resolveTsModule(request, parentFile) {
  if (request.startsWith(".")) {
    const basePath = path.resolve(path.dirname(parentFile), request);
    const candidates = [`${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, "index.ts")];
    const resolved = candidates.find((candidate) => fs.existsSync(candidate));
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function createCacheKey(filePath, mocks) {
  const mockKeys = mocks ? Object.keys(mocks).sort().join("|") : "";
  return `${path.normalize(filePath)}::${mockKeys}`;
}

function loadTsModule(filePath, options = {}) {
  const normalizedPath = path.normalize(filePath);
  const mocks = options.mocks ?? {};
  const cacheKey = createCacheKey(normalizedPath, mocks);

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey).exports;
  }

  const source = fs.readFileSync(normalizedPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: normalizedPath
  });

  const module = { exports: {} };
  moduleCache.set(cacheKey, module);

  const sandbox = {
    Date,
    Error,
    JSON,
    Math,
    Number,
    exports: module.exports,
    module,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(mocks, request)) {
        return mocks[request];
      }

      const resolvedTsModule = resolveTsModule(request, normalizedPath);
      if (resolvedTsModule) {
        return loadTsModule(resolvedTsModule, options);
      }
      return require(request);
    }
  };

  vm.runInNewContext(output.outputText, sandbox, { filename: normalizedPath });
  return module.exports;
}

module.exports = {
  loadTsModule,
  projectRoot
};
