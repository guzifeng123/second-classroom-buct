export interface TextExportResult {
  method: "clipboard" | "download";
  fileName: string;
}

export async function exportTextFile(fileName: string, content: string): Promise<TextExportResult> {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);

  return {
    method: "download",
    fileName
  };
}
