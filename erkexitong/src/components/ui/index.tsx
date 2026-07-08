import { useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import type { ReactNode } from "react";
import "./index.scss";

type Tone = "neutral" | "success" | "warning" | "danger";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, aside }: PageHeaderProps) {
  return (
    <View className="ui-page-header">
      <View className="ui-page-header__copy">
        {eyebrow ? <Text className="ui-page-header__eyebrow">{eyebrow}</Text> : null}
        <Text className="ui-page-header__title">{title}</Text>
        {description ? <Text className="ui-page-header__description">{description}</Text> : null}
      </View>
      {aside ? <View className="ui-page-header__aside">{aside}</View> : null}
    </View>
  );
}

interface StatusBannerProps {
  tone?: Tone;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function StatusBanner({ tone = "neutral", title, description, action }: StatusBannerProps) {
  return (
    <View className={`ui-status-banner ui-status-banner--${tone}`}>
      <View className="ui-status-banner__mark" />
      <View className="ui-status-banner__copy">
        <Text className="ui-status-banner__title">{title}</Text>
        {description ? <Text className="ui-status-banner__description">{description}</Text> : null}
      </View>
      {action ? <View className="ui-status-banner__action">{action}</View> : null}
    </View>
  );
}

interface MetricTileProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function MetricTile({ label, value, hint }: MetricTileProps) {
  return (
    <View className="ui-metric-tile">
      <Text className="ui-metric-tile__value">{value}</Text>
      <Text className="ui-metric-tile__label">{label}</Text>
      {hint ? <Text className="ui-metric-tile__hint">{hint}</Text> : null}
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View className="ui-empty-state">
      <View className="ui-empty-state__symbol">＋</View>
      <Text className="ui-empty-state__title">{title}</Text>
      <Text className="ui-empty-state__description">{description}</Text>
      {action ? <View className="ui-empty-state__action">{action}</View> : null}
    </View>
  );
}

interface FeedbackButtonProps {
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  onClick?: () => Promise<unknown> | unknown;
}

export function FeedbackButton({
  className = "",
  children,
  disabled = false,
  disabledReason,
  loadingText = "处理中",
  successText,
  errorText = "未完成",
  onClick
}: FeedbackButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const isBusy = state === "loading";

  const handleClick = async () => {
    if (disabled || isBusy || !onClick) {
      return;
    }

    try {
      setState("loading");
      await onClick();
      if (successText) {
        setState("success");
        setTimeout(() => setState("idle"), 1200);
      } else {
        setState("idle");
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 1400);
    }
  };

  const label = isBusy ? loadingText : state === "success" ? successText : state === "error" ? errorText : children;

  return (
    <View className="ui-feedback-button-wrap">
      <Button
        className={`ui-feedback-button ${className} ${state !== "idle" ? `ui-feedback-button--${state}` : ""}`}
        disabled={disabled || isBusy}
        onClick={handleClick}
      >
        {isBusy ? <Text className="ui-feedback-button__spinner" /> : null}
        <Text className="ui-feedback-button__label">{label}</Text>
      </Button>
      {disabled && disabledReason ? <Text className="ui-feedback-button__reason">{disabledReason}</Text> : null}
    </View>
  );
}

interface ActionDockProps {
  meta?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  danger?: ReactNode;
}

export function ActionDock({ meta, primary, secondary, danger }: ActionDockProps) {
  return (
    <View className="ui-action-dock">
      {meta ? <View className="ui-action-dock__meta">{meta}</View> : null}
      <View className="ui-action-dock__main">{primary}</View>
      {secondary || danger ? (
        <View className="ui-action-dock__secondary">
          {secondary}
          {danger ? <View className="ui-action-dock__danger">{danger}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

interface SegmentTabsProps {
  items: Array<{ key: string; label: string; active?: boolean; onClick?: () => void }>;
}

export function SegmentTabs({ items }: SegmentTabsProps) {
  return (
    <View className="ui-segment-tabs">
      {items.map((item) => (
        <Button
          key={item.key}
          className={`ui-segment-tabs__item ${item.active ? "ui-segment-tabs__item--active" : ""}`}
          onClick={item.onClick}
        >
          {item.label}
        </Button>
      ))}
    </View>
  );
}
