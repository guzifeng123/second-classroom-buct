import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { ImagePreviewProps } from "./types";
import "./index.h5.scss";

export type { ImagePreviewProps, ImagePreviewRequest } from "./types";

interface GestureStart {
  x: number;
  y: number;
}

const CONTROL_SELECTOR = "[data-image-preview-control]";
const PRELOAD_RADIUS = 1;

function getNeighborIndexes(activeIndex: number, total: number): number[] {
  if (total < 2) {
    return [];
  }

  const indexes = new Set<number>();
  for (let offset = 1; offset <= PRELOAD_RADIUS; offset += 1) {
    indexes.add((activeIndex - offset + total) % total);
    indexes.add((activeIndex + offset) % total);
  }

  indexes.delete(activeIndex);
  return Array.from(indexes);
}

export default function ImagePreview({ request, onClose }: ImagePreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [failedUrl, setFailedUrl] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const gestureStartRef = useRef<GestureStart | null>(null);
  const preloadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const urls = request?.urls ?? [];
  const currentUrl = urls[activeIndex] ?? "";

  const move = useCallback(
    (delta: number) => {
      if (urls.length < 2) {
        return;
      }

      setActiveIndex((index) => (index + delta + urls.length) % urls.length);
    },
    [urls.length]
  );

  useEffect(() => {
    if (!request) {
      return;
    }

    const requestedIndex = request.urls.indexOf(request.current);
    setActiveIndex(requestedIndex >= 0 ? requestedIndex : 0);
    setLoadedUrl("");
    setFailedUrl("");

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousDocumentWidth = document.documentElement.style.width;
    const previousDocumentMaxWidth = document.documentElement.style.maxWidth;
    const previousOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyWidth = document.body.style.width;
    const previousBodyMaxWidth = document.body.style.maxWidth;
    const previousBodyTop = document.body.style.top;
    const previousBodyRight = document.body.style.right;
    const previousBodyBottom = document.body.style.bottom;
    const previousBodyLeft = document.body.style.left;
    document.documentElement.classList.add("image-preview-open");
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.width = "100vw";
    document.documentElement.style.maxWidth = "100vw";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100vw";
    document.body.style.maxWidth = "100vw";
    document.body.style.top = "0";
    document.body.style.right = "0";
    document.body.style.bottom = "0";
    document.body.style.left = "0";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.documentElement.classList.remove("image-preview-open");
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.documentElement.style.width = previousDocumentWidth;
      document.documentElement.style.maxWidth = previousDocumentMaxWidth;
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.width = previousBodyWidth;
      document.body.style.maxWidth = previousBodyMaxWidth;
      document.body.style.top = previousBodyTop;
      document.body.style.right = previousBodyRight;
      document.body.style.bottom = previousBodyBottom;
      document.body.style.left = previousBodyLeft;
      previouslyFocused?.focus();
    };
  }, [request]);

  useEffect(() => {
    setLoadedUrl("");
    setFailedUrl("");
  }, [currentUrl]);

  useEffect(() => {
    if (!request || !currentUrl || urls.length < 2) {
      preloadedImagesRef.current.clear();
      return;
    }

    const urlsToKeep = new Set([currentUrl]);
    getNeighborIndexes(activeIndex, urls.length).forEach((index) => {
      const url = urls[index];
      if (!url) {
        return;
      }

      urlsToKeep.add(url);
      if (preloadedImagesRef.current.has(url)) {
        return;
      }

      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
      preloadedImagesRef.current.set(url, image);
    });

    Array.from(preloadedImagesRef.current.keys()).forEach((url) => {
      if (!urlsToKeep.has(url)) {
        preloadedImagesRef.current.delete(url);
      }
    });
  }, [activeIndex, currentUrl, request, urls]);

  useEffect(() => {
    if (!request) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(CONTROL_SELECTOR) ?? []
      ).filter((control) => !control.hasAttribute("disabled"));

      if (controls.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? controls.length - 1
          : currentIndex - 1
        : currentIndex < 0 || currentIndex === controls.length - 1
          ? 0
          : currentIndex + 1;
      event.preventDefault();
      controls[nextIndex].focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move, onClose, request]);

  if (!request || urls.length === 0 || !currentUrl) {
    return null;
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    gestureStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gestureStartRef.current;
    gestureStartRef.current = null;

    if (!start || urls.length < 2) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX > 0 ? -1 : 1);
    }
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="image-preview__dialog"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      tabIndex={-1}
      onKeyDown={handleDialogKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="image-preview__control image-preview__close"
        aria-label="关闭图片预览"
        title="关闭"
        data-image-preview-control
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>

      <div
        className="image-preview__stage"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          gestureStartRef.current = null;
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        {failedUrl === currentUrl ? (
          <div className="image-preview__failure" role="status">
            <span>图片加载失败</span>
            <button
              type="button"
              className="image-preview__control image-preview__retry"
              aria-label="重新加载图片"
              title="重试"
              data-image-preview-control
              onClick={() => setFailedUrl("")}
            >
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        ) : (
          <>
            {loadedUrl !== currentUrl ? (
              <span className="image-preview__loading" role="status">
                图片加载中
              </span>
            ) : null}
            <img
              key={`${activeIndex}-${currentUrl}-${failedUrl}`}
              className={`image-preview__image ${loadedUrl === currentUrl ? "image-preview__image--loaded" : ""}`}
              src={currentUrl}
              alt={`预览图片 ${activeIndex + 1}`}
              draggable={false}
              onLoad={() => setLoadedUrl(currentUrl)}
              onError={() => setFailedUrl(currentUrl)}
            />
          </>
        )}
      </div>

      {urls.length > 1 ? (
        <>
          <button
            type="button"
            className="image-preview__control image-preview__previous"
            aria-label="上一张图片"
            title="上一张"
            data-image-preview-control
            onClick={() => move(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="image-preview__control image-preview__next"
            aria-label="下一张图片"
            title="下一张"
            data-image-preview-control
            onClick={() => move(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </>
      ) : null}

      <span className="image-preview__counter" aria-live="polite">
        {activeIndex + 1} / {urls.length}
      </span>
    </div>,
    document.body
  );
}
