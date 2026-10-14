import { useEffect, useLayoutEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import type { StableTextareaProps } from "./types";
import "./index.h5.scss";

function resizeToContent(textarea: HTMLTextAreaElement, autoHeight: boolean): void {
  if (!autoHeight) {
    textarea.style.removeProperty("height");
    textarea.style.removeProperty("overflow-y");
    return;
  }

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
  textarea.style.overflowY = "hidden";
}

export default function StableTextarea({
  autoHeight = false,
  className = "",
  disabled = false,
  focus = false,
  maxlength,
  name,
  placeholder,
  value,
  onValueChange
}: StableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      resizeToContent(textareaRef.current, autoHeight);
    }
  }, [autoHeight, value]);

  useEffect(() => {
    if (focus) {
      textareaRef.current?.focus();
    }
  }, [focus]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    resizeToContent(event.currentTarget, autoHeight);
    onValueChange(event.currentTarget.value);
  };

  const rootClassName = [
    "stable-textarea",
    autoHeight ? "stable-textarea--auto-height" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <textarea
        ref={textareaRef}
        className="stable-textarea__control"
        disabled={disabled}
        maxLength={maxlength}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}
