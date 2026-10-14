import type { ReactNode } from "react";

export interface ImagePreviewTriggerProps {
  ariaLabel: string;
  children: ReactNode;
  className: string;
  enabled?: boolean;
  onActivate: () => void;
}
