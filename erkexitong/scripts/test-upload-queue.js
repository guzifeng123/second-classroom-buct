const path = require("node:path");
const { loadTsModule, projectRoot } = require("./utils/load-ts-module");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}：期望 ${expected}，实际 ${actual}`);
  }
}

const {
  createUploadQueue,
  markUploadQueueInterrupted,
  markUploadQueueThumbFailed,
  removeUploadQueueItem,
  shouldShowUploadQueue,
  updateUploadQueueStatus,
  uploadQueueStatusText
} = loadTsModule(path.join(projectRoot, "src", "utils", "uploadQueue.ts"));

const firstPath = "C:/temp/活动现场照片-这是一个很长的文件名称-第一张.jpg";
const secondPath = "C:/temp/第二张.png";
const thirdPath = "C:/temp/第三张.webp";
const initialQueue = createUploadQueue([firstPath, secondPath, thirdPath]);

assertEqual(initialQueue.length, 3, "选择三张图片时应生成三条队列记录");
assertEqual(initialQueue[0].label, "图片 1", "队列应保留稳定序号标签");
assert(initialQueue[0].safeName.length <= 18, "长文件名应缩短到安全长度");
assert(initialQueue[0].safeName.endsWith("一张.jpg"), "短文件名应保留可识别后缀");
assertEqual(initialQueue[0].thumbUrl, firstPath, "队列缩略图应使用本地文件路径");

const uploadingQueue = updateUploadQueueStatus(initialQueue, firstPath, "uploading");
const successQueue = updateUploadQueueStatus(uploadingQueue, firstPath, "success");
const interruptedQueue = markUploadQueueInterrupted(
  successQueue,
  [secondPath, thirdPath],
  secondPath,
  "failed",
  "图片上传失败：网络超时"
);

assertEqual(interruptedQueue[0].status, "success", "已成功图片不应被后续失败回滚");
assertEqual(interruptedQueue[1].status, "failed", "真实失败图片应标为失败");
assertEqual(interruptedQueue[1].message, "图片上传失败：网络超时", "失败图片应保留独立原因");
assertEqual(interruptedQueue[2].status, "waiting-retry", "尚未尝试的后续图片应标为待重试");
assertEqual(interruptedQueue[2].message, "前序图片未完成，尚未上传", "待重试图片应说明未上传原因");
assertEqual(uploadQueueStatusText["waiting-retry"], "待重试", "待重试状态文案应稳定");
assertEqual(
  shouldShowUploadQueue(interruptedQueue, new Set([secondPath, thirdPath])),
  true,
  "存在失败或待重试图片时应展示逐张队列"
);

const thumbFailedQueue = markUploadQueueThumbFailed(interruptedQueue, secondPath);
assertEqual(thumbFailedQueue[1].thumbFailed, true, "缩略图加载失败应切换占位状态");
const removedQueue = removeUploadQueueItem(thumbFailedQueue, secondPath);
assertEqual(removedQueue.length, 2, "移除失败图片后应同步移除队列记录");
assert(!removedQueue.some((item) => item.filePath === secondPath), "被移除图片不应残留在队列");

console.log("图片上传逐张队列状态测试通过。");
