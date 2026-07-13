import type { UploadedImage } from "../types/content";
import type { ProofImage } from "../types/evaluation";
import { createId } from "./id";

export interface LocalImageFile {
  path: string;
  size?: number;
}

export interface ImagePrecheckIssue {
  filePath: string;
  message: string;
}

export interface ImagePrecheckResult {
  issues: ImagePrecheckIssue[];
  accepted: LocalImageFile[];
}

export interface UploadResponseShape {
  id?: string;
  original_url?: string;
  originalUrl?: string;
  thumb_url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_SAFE_FILE_NAME_LENGTH = 18;

export function formatFileSize(size?: number): string {
  if (!size || size <= 0) {
    return "未知大小";
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)}KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export function getPathExtension(filePath: string): string {
  const cleanPath = filePath.split("?")[0] ?? filePath;
  const dotIndex = cleanPath.lastIndexOf(".");
  return dotIndex >= 0 ? cleanPath.slice(dotIndex).toLowerCase() : "";
}

export function getSafeImageFileName(filePath: string, fallback = "本地图片"): string {
  const cleanPath = (filePath.split("?")[0] ?? filePath).split("#")[0] ?? filePath;
  const segments = cleanPath.split(/[\\/]/).filter(Boolean);
  const rawName = segments.at(-1) ?? "";
  const fileName = rawName.trim() || fallback;

  if (fileName.length <= MAX_SAFE_FILE_NAME_LENGTH) {
    return fileName;
  }

  const extension = getPathExtension(fileName);
  const extensionLength = extension.length;
  const suffixLength = extensionLength > 0 ? Math.min(8, extensionLength + 4) : 6;
  const prefixLength = MAX_SAFE_FILE_NAME_LENGTH - suffixLength - 1;

  return `${fileName.slice(0, prefixLength)}…${fileName.slice(-suffixLength)}`;
}

export function precheckLocalImages(files: LocalImageFile[]): ImagePrecheckResult {
  const issues: ImagePrecheckIssue[] = [];

  files.forEach((file) => {
    const extension = getPathExtension(file.path);

    if (extension && !SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
      issues.push({
        filePath: file.path,
        message: `图片格式 ${extension} 可能不受支持，建议使用 JPG、PNG 或 WebP`
      });
    }

    if (file.size && file.size > MAX_IMAGE_SIZE) {
      issues.push({
        filePath: file.path,
        message: `图片大小 ${formatFileSize(file.size)}，建议压缩到 5MB 以内`
      });
    }
  });

  return {
    issues,
    accepted: files
  };
}

export function normalizeUploadResponse(raw: string): UploadedImage {
  const parsed = JSON.parse(raw) as UploadResponseShape;
  const originalUrl = parsed.originalUrl ?? parsed.original_url ?? "";

  if (!originalUrl) {
    throw new Error("Upload response missing original_url");
  }

  return {
    id: parsed.id ?? createId("uploaded"),
    originalUrl,
    thumbUrl: parsed.thumbUrl ?? parsed.thumb_url,
    width: parsed.width,
    height: parsed.height,
    size: parsed.size
  };
}

export function localFilesToProofImages(files: LocalImageFile[]): ProofImage[] {
  return files.map(({ path, size }) => ({
    id: createId("image"),
    url: path,
    thumbUrl: path,
    size,
    uploaded: false
  }));
}

export function uploadedToProofImage(image: UploadedImage): ProofImage {
  return {
    id: image.id,
    url: image.originalUrl,
    thumbUrl: image.thumbUrl ?? image.originalUrl,
    width: image.width,
    height: image.height,
    size: image.size,
    uploaded: true
  };
}
