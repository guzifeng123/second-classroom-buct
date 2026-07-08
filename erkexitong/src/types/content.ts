export interface UploadedImage {
  id: string;
  originalUrl: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
}

export type ContentBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | {
      type: "image";
      url: string;
      thumbUrl?: string;
      width?: number;
      height?: number;
      alt?: string;
    }
  | { type: "other"; data: Record<string, unknown> };
