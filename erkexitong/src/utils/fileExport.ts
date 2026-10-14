import Taro from "@tarojs/taro";

export interface TextExportResult {
  method: "clipboard" | "download";
  fileName: string;
}

export async function exportTextFile(fileName: string, content: string): Promise<TextExportResult> {
  await Taro.setClipboardData({ data: content });
  return {
    method: "clipboard",
    fileName
  };
}
