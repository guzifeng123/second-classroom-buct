import type { ImagePreviewTriggerProps } from "./types";

export default function ImagePreviewTrigger({
  ariaLabel,
  children,
  className,
  enabled = true,
  onActivate
}: ImagePreviewTriggerProps) {
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <button type="button" className={className} aria-label={ariaLabel} onClick={onActivate}>
      {children}
    </button>
  );
}
