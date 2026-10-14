export type MonitoringEventKind = "api-failure" | "error-log" | "key-action";

export type MonitoringActionStatus = "attempt" | "success" | "failed" | "blocked";

export interface MonitoringEvent {
  id: string;
  kind: MonitoringEventKind;
  name: string;
  message?: string;
  status?: MonitoringActionStatus;
  statusCode?: number;
  url?: string;
  method?: string;
  createdAt: number;
  context?: Record<string, string | number | boolean | null>;
}

export interface ApiFailureStat {
  count: number;
  latestAt: number;
  latestMessage: string;
  latestStatusCode?: number;
}

export interface MonitoringSnapshot {
  events: MonitoringEvent[];
  apiFailureStats: Record<string, ApiFailureStat>;
  keyActionCounts: Record<string, number>;
  errorCount: number;
}

export interface MonitoringUploadPayload extends MonitoringSnapshot {
  schemaVersion: 1;
  generatedAt: number;
  droppedEventCount: number;
}

const MAX_MONITORING_EVENTS = 120;
const DEFAULT_MONITORING_UPLOAD_LIMIT = 50;
const MAX_MONITORING_STRING_LENGTH = 160;
const SENSITIVE_CONTEXT_KEY_PATTERN =
  /(token|authorization|password|secret|credential|content|text|body|image|url|uri|base64|student|userId|user_id|phone|mobile|email|idCard|identity)/i;
const SENSITIVE_CONTEXT_VALUE_PATTERN = /(data:image|https?:\/\/|blob:|file:|base64,)/i;

const events: MonitoringEvent[] = [];
let sequence = 0;

function createEventId(kind: MonitoringEventKind): string {
  sequence += 1;
  return `${kind}-${Date.now()}-${sequence}`;
}

function normalizeMethod(method?: string): string {
  return method?.toUpperCase() || "GET";
}

function createApiFailureKey(method: string, url: string, statusCode?: number): string {
  return `${normalizeMethod(method)} ${url} ${statusCode ?? "NETWORK"}`;
}

function sanitizeMonitoringString(value: string): string {
  const trimmed = value.trim();
  if (SENSITIVE_CONTEXT_VALUE_PATTERN.test(trimmed)) {
    return "[redacted]";
  }

  return trimmed.length > MAX_MONITORING_STRING_LENGTH
    ? `${trimmed.slice(0, MAX_MONITORING_STRING_LENGTH)}...`
    : trimmed;
}

function sanitizeContext(
  context?: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean | null> | undefined {
  if (!context) {
    return undefined;
  }

  return Object.entries(context).reduce<Record<string, string | number | boolean | null>>((result, [key, value]) => {
    if (value === undefined) {
      return result;
    }

    if (SENSITIVE_CONTEXT_KEY_PATTERN.test(key)) {
      result[key] = "[redacted]";
      return result;
    }

    if (typeof value === "string") {
      result[key] = sanitizeMonitoringString(value);
    } else {
      result[key] = value;
    }
    return result;
  }, {});
}

function pushMonitoringEvent(event: Omit<MonitoringEvent, "id" | "createdAt">): MonitoringEvent {
  const nextEvent: MonitoringEvent = {
    ...event,
    id: createEventId(event.kind),
    createdAt: Date.now()
  };

  events.push(nextEvent);
  if (events.length > MAX_MONITORING_EVENTS) {
    events.splice(0, events.length - MAX_MONITORING_EVENTS);
  }

  return nextEvent;
}

function buildMonitoringSnapshot(sourceEvents: MonitoringEvent[]): MonitoringSnapshot {
  const apiFailureStats: Record<string, ApiFailureStat> = {};
  const keyActionCounts: Record<string, number> = {};
  let errorCount = 0;

  sourceEvents.forEach((event) => {
    if (event.kind === "api-failure") {
      const previousStat = apiFailureStats[event.name];
      apiFailureStats[event.name] = {
        count: (previousStat?.count ?? 0) + 1,
        latestAt: Math.max(previousStat?.latestAt ?? 0, event.createdAt),
        latestMessage: event.message ?? previousStat?.latestMessage ?? "接口请求失败",
        latestStatusCode: event.statusCode ?? previousStat?.latestStatusCode
      };
    }

    if (event.kind === "key-action" && event.status) {
      const key = `${event.name}:${event.status}`;
      keyActionCounts[key] = (keyActionCounts[key] ?? 0) + 1;
    }

    if (event.kind === "error-log") {
      errorCount += 1;
    }
  });

  return {
    events: [...sourceEvents],
    apiFailureStats,
    keyActionCounts,
    errorCount
  };
}

export function recordApiFailure({
  url,
  method,
  statusCode,
  message,
  context
}: {
  url: string;
  method?: string;
  statusCode?: number;
  message: string;
  context?: Record<string, string | number | boolean | null | undefined>;
}): MonitoringEvent {
  const normalizedMethod = normalizeMethod(method);
  const key = createApiFailureKey(normalizedMethod, url, statusCode);

  return pushMonitoringEvent({
    kind: "api-failure",
    name: key,
    url,
    method: normalizedMethod,
    statusCode,
    message,
    context: sanitizeContext(context)
  });
}

export function recordErrorLog(
  scope: string,
  error: unknown,
  context?: Record<string, string | number | boolean | null | undefined>
): MonitoringEvent {
  const message = error instanceof Error && error.message ? error.message : String(error || "未知错误");

  return pushMonitoringEvent({
    kind: "error-log",
    name: scope,
    message,
    context: sanitizeContext(context)
  });
}

export function recordKeyAction(
  action: string,
  status: MonitoringActionStatus,
  context?: Record<string, string | number | boolean | null | undefined>
): MonitoringEvent {
  return pushMonitoringEvent({
    kind: "key-action",
    name: action,
    status,
    context: sanitizeContext(context)
  });
}

export function getMonitoringSnapshot(): MonitoringSnapshot {
  return buildMonitoringSnapshot(events);
}

export function getMonitoringUploadPayload(limit = DEFAULT_MONITORING_UPLOAD_LIMIT): MonitoringUploadPayload {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_MONITORING_UPLOAD_LIMIT;
  const selectedEvents = events.slice(0, safeLimit);
  const snapshot = buildMonitoringSnapshot(selectedEvents);

  return {
    ...snapshot,
    schemaVersion: 1,
    generatedAt: Date.now(),
    droppedEventCount: Math.max(0, events.length - selectedEvents.length)
  };
}

export function clearMonitoringEvents(uploadedEventIds: string[]): void {
  if (!Array.isArray(uploadedEventIds) || uploadedEventIds.length === 0) {
    return;
  }

  const uploadedIdSet = new Set(uploadedEventIds);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (uploadedIdSet.has(events[index].id)) {
      events.splice(index, 1);
    }
  }
}

export function resetMonitoringSnapshot(): void {
  events.splice(0, events.length);
}
