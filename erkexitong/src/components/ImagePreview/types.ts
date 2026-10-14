export interface ImagePreviewRequest {
  current: string;
  urls: string[];
}

export interface ImagePreviewProps {
  request: ImagePreviewRequest | null;
  onClose: () => void;
}
