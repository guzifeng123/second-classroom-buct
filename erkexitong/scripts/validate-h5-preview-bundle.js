const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const defaultDistRoot = path.join(projectRoot, "dist", "h5");
const imageLibraryRoute = "pages/image/library/index";
const imageLibraryRouteRawLimitBytes = 249856;
const requiredMarker = "image-preview__dialog";
const forbiddenMarkers = [
  "taro-swiper-core",
  "defineCustomElementTaroSwiper",
  "swiper-container-",
  "data-swiper-slide-index"
];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function walkFiles(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directoryPath, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

function getRouteChunkIds(jsAssets) {
  const escapedRoute = imageLibraryRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const routeChunkPattern = new RegExp(
    `["']path["']\\s*:\\s*["']${escapedRoute}["'][\\s\\S]{0,600}?\\.e\\(\\s*(?:["']([^"']+)["']|(\\d+))\\s*\\)`,
    "g"
  );
  const chunkIds = new Set();

  for (const asset of jsAssets) {
    let match = routeChunkPattern.exec(asset.content);

    while (match) {
      chunkIds.add(match[1] ?? match[2]);
      match = routeChunkPattern.exec(asset.content);
    }

    routeChunkPattern.lastIndex = 0;
  }

  return [...chunkIds];
}

function findChunkAssets(jsAssets, chunkId) {
  return jsAssets.filter((asset) => {
    const fileName = path.basename(asset.filePath);
    return fileName === `${chunkId}.js` || fileName.startsWith(`${chunkId}.`);
  });
}

function validateH5PreviewBundle(distRoot = defaultDistRoot) {
  const resolvedDistRoot = path.resolve(distRoot);
  const jsRoot = path.join(resolvedDistRoot, "js");

  if (!fs.existsSync(jsRoot) || !fs.statSync(jsRoot).isDirectory()) {
    throw new Error(`未找到 H5 JS 目录：${normalizePath(jsRoot)}。请先运行 npm.cmd run build:h5。`);
  }

  const jsFiles = walkFiles(jsRoot).filter((filePath) => filePath.endsWith(".js"));

  if (jsFiles.length === 0) {
    throw new Error(`H5 JS 目录中没有找到 .js 产物：${normalizePath(jsRoot)}。`);
  }

  const jsAssets = jsFiles.map((filePath) => ({
    filePath,
    relativePath: normalizePath(path.relative(resolvedDistRoot, filePath)),
    rawBytes: fs.statSync(filePath).size,
    content: fs.readFileSync(filePath, "utf8")
  }));
  const forbiddenHits = [];

  for (const asset of jsAssets) {
    for (const marker of forbiddenMarkers) {
      if (asset.content.includes(marker)) {
        forbiddenHits.push(`${marker}（${asset.relativePath}）`);
      }
    }
  }

  if (forbiddenHits.length > 0) {
    throw new Error(`H5 图片预览 bundle 仍包含禁用的 Taro Swiper 标记：\n- ${forbiddenHits.join("\n- ")}`);
  }

  const requiredMarkerAsset = jsAssets.find((asset) => asset.content.includes(requiredMarker));

  if (!requiredMarkerAsset) {
    throw new Error(`H5 JS 产物缺少轻量图片预览标记：${requiredMarker}。`);
  }

  const routeChunkIds = getRouteChunkIds(jsAssets);

  if (routeChunkIds.length === 0) {
    throw new Error(`未从 H5 JS 产物解析到图片库路由 ${imageLibraryRoute} 的 chunk。`);
  }

  if (routeChunkIds.length > 1) {
    throw new Error(`图片库路由映射到多个 chunk：${routeChunkIds.join(", ")}。请清理旧产物或检查路由构建。`);
  }

  const [routeChunkId] = routeChunkIds;
  const routeChunkAssets = findChunkAssets(jsAssets, routeChunkId);

  if (routeChunkAssets.length === 0) {
    throw new Error(`图片库路由 chunk ${routeChunkId} 没有对应的 JS 文件。`);
  }

  if (routeChunkAssets.length > 1) {
    throw new Error(
      `图片库路由 chunk ${routeChunkId} 对应多个 JS 文件：${routeChunkAssets
        .map((asset) => asset.relativePath)
        .join(", ")}。`
    );
  }

  const [routeChunkAsset] = routeChunkAssets;

  if (routeChunkAsset.rawBytes >= imageLibraryRouteRawLimitBytes) {
    throw new Error(
      `图片库路由 chunk ${routeChunkAsset.relativePath} raw 为 ${routeChunkAsset.rawBytes} B，必须小于 ${imageLibraryRouteRawLimitBytes} B。`
    );
  }

  return {
    distRoot: resolvedDistRoot,
    jsAssetCount: jsAssets.length,
    requiredMarkerAsset: requiredMarkerAsset.relativePath,
    routeChunk: routeChunkAsset.relativePath,
    routeChunkRawBytes: routeChunkAsset.rawBytes,
    routeChunkRawLimitBytes: imageLibraryRouteRawLimitBytes
  };
}

function runCli() {
  const distRoot = process.env.H5_PREVIEW_BUNDLE_DIST_ROOT
    ? path.resolve(projectRoot, process.env.H5_PREVIEW_BUNDLE_DIST_ROOT)
    : defaultDistRoot;

  try {
    const result = validateH5PreviewBundle(distRoot);
    console.log("H5 图片预览 bundle 校验通过。");
    console.log(`扫描 JS：${result.jsAssetCount} 个`);
    console.log(`轻量预览标记 ${requiredMarker}：${result.requiredMarkerAsset}`);
    console.log(
      `图片库路由 chunk：${result.routeChunk}，raw ${result.routeChunkRawBytes} B < ${result.routeChunkRawLimitBytes} B`
    );
  } catch (error) {
    console.error(`H5 图片预览 bundle 校验失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  forbiddenMarkers,
  imageLibraryRoute,
  imageLibraryRouteRawLimitBytes,
  requiredMarker,
  validateH5PreviewBundle
};
