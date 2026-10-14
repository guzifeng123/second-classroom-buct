import { useEffect, useLayoutEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { Textarea } from "@tarojs/components";
import type { StableTextareaProps } from "./types";

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

function isH5Runtime(): boolean {
  return process.env.TARO_ENV === "h5" || typeof document !== "undefined";
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
  const isH5 = isH5Runtime();

  useLayoutEffect(() => {
    if (!isH5 || !textareaRef.current) {
      return;
    }

    resizeToContent(textareaRef.current, autoHeight);
  }, [autoHeight, isH5, value]);

  useEffect(() => {
    if (isH5 && focus) {
      textareaRef.current?.focus();
    }
  }, [focus, isH5]);

  if (isH5) {
    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      resizeToContent(event.currentTarget, autoHeight);
      onValueChange(event.currentTarget.value);
    };

    return (
      <textarea
        ref={textareaRef}
        className={className}
        disabled={disabled}
        maxLength={maxlength}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    );
  }

  return (
    <Textarea
      autoHeight={autoHeight}
      className={className}
      disabled={disabled}
      focus={focus}
      maxlength={maxlength}
      name={name}
      placeholder={placeholder}
      value={value}
      onInput={(event) => onValueChange(event.detail.value)}
    />
  );
}
