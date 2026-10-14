import { getErrorMessage, hasApiBaseUrl, request } from "./api";
import {
  clearMonitoringEvents,
  getMonitoringSnapshot,
  getMonitoringUploadPayload,
  recordErrorLog,
  type MonitoringUploadPayload
} from "../utils/monitoring";

const MONITORING_UPLOAD_PATH = "/frontend-monitoring-events";
const DEFAULT_MONITORING_UPLOAD_LIMIT = 50;

export interface MonitoringUploadResponse {
  acceptedEventIds?: string[];
}

export interface MonitoringUploadResult {
  attempted: boolean;
  uploaded: boolean;
  eventCount: number;
  acceptedEventIds: string[];
  remainingEventCount: number;
  skippedReason?: "empty" | "missing-api-base-url";
  error?: string;
}

export async function uploadMonitoringEvents(limit = DEFAULT_MONITORING_UPLOAD_LIMIT): Promise<MonitoringUploadResult> {
  const pendingEventCount = getMonitoringSnapshot().events.length;

  if (pendingEventCount === 0) {
    return {
      attempted: false,
      uploaded: false,
      eventCount: 0,
      acceptedEventIds: [],
      remainingEventCount: 0,
      skippedReason: "empty"
    };
  }

  if (!hasApiBaseUrl) {
    return {
      attempted: false,
      uploaded: false,
      eventCount: 0,
      acceptedEventIds: [],
      remainingEventCount: pendingEventCount,
      skippedReason: "missing-api-base-url"
    };
  }

  const payload = getMonitoringUploadPayload(limit);

  try {
    const response = await request<MonitoringUploadResponse, MonitoringUploadPayload>({
      url: MONITORING_UPLOAD_PATH,
      method: "POST",
      data: payload
    });
    const acceptedEventIds = Array.isArray(response?.acceptedEventIds) ? response.acceptedEventIds : [];
    clearMonitoringEvents(acceptedEventIds);

    return {
      attempted: true,
      uploaded: acceptedEventIds.length > 0,
      eventCount: payload.events.length,
      acceptedEventIds,
      remainingEventCount: getMonitoringSnapshot().events.length
    };
  } catch (error) {
    const message = getErrorMessage(error, "监控事件上报失败");
    recordErrorLog("monitoring_upload", error, { eventCount: payload.events.length });
    return {
      attempted: true,
      uploaded: false,
      eventCount: payload.events.length,
      acceptedEventIds: [],
      remainingEventCount: getMonitoringSnapshot().events.length,
      error: message
    };
  }
}
