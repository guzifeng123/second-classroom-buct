import { getErrorMessage } from "../services/api";

export const feedbackTitles = {
  draftLocalSaved: "已本地暂存",
  draftRemoteSaved: "已同步保存",
  remoteDraftFailed: "远端未同步",
  offlineSubmitBlocked: "仅完成本地暂存",
  validationBlocked: "提交前请完善材料",
  submitFailed: "正式提交失败",
  uploadFailed: "图片上传失败",
  chooseImageFailed: "图片选择失败"
} as const;

export function buildRemoteDraftFailureMessage(error: unknown): string {
  return `本机草稿已保留，但远端同步失败。稍后可重新保存。\n\n原因：${getErrorMessage(
    error,
    "远端草稿保存失败"
  )}`;
}

export function buildSaveFailureMessage(error: unknown): string {
  return getErrorMessage(error, "保存失败，请稍后重试");
}

export function buildOfflineSubmitMessage(issueSummary?: string): string {
  const prefix = "当前仅完成本地暂存，没有进行正式提交。真实提交需配置后端接口。";
  return issueSummary ? `${prefix}\n\n提交前还需完善：\n${issueSummary}` : prefix;
}

export function buildSubmitFailureMessage(error: unknown, detail?: string): string {
  const detailText = detail ? `\n\n${detail}` : "";
  return `${getErrorMessage(error, "请稍后重试")}${detailText}\n\n本机草稿仍然保留，可修正后重新提交。`;
}

export function buildUploadFailureMessage(error: unknown): string {
  return getErrorMessage(error, "图片上传失败，可点击重试");
}

export function buildChooseImageFailureMessage(error: unknown): string {
  return getErrorMessage(error, "图片选择失败，请重新选择");
}
