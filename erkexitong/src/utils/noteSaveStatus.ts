export function getNoteSaveStatusText(isDirty: boolean, remoteEnabled: boolean): string {
  if (isDirty) {
    return "有修改";
  }

  return remoteEnabled ? "已同步" : "本地已保存";
}
