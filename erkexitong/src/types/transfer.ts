import type { DimensionKey, NoteReference, ProofImage, SectionKey } from "./evaluation";
import type { ContentBlock } from "./content";
import type { NoteSource } from "./note";

export type TransferAction = "EDIT_ITEM" | "NOTE_CONTENT";
export type TransferDeliveryStatus = "demo" | "pending" | "delivered" | "failed" | "received";

export interface EditingItemPayload {
  dimensionKey: DimensionKey;
  sectionKey: SectionKey;
  itemId: string;
  recordId: string;
  text: string;
  images: ProofImage[];
  noteReferences?: NoteReference[];
  selectedOption?: string;
  numericValue?: number;
}

export interface NoteTransferPayload {
  noteId: string | null;
  title: string;
  content: ContentBlock[];
  tags?: string[];
  dimensionKeys?: DimensionKey[];
  source?: NoteSource;
}

export type TransferPayload = EditingItemPayload | NoteTransferPayload;

interface IncomingTransferBase {
  targetDevice: string;
  fromDevice: string;
  time: number;
  messageId?: string;
  serverTime?: number;
}

export type IncomingTransfer =
  | (IncomingTransferBase & {
      action: "EDIT_ITEM";
      payload: EditingItemPayload;
    })
  | (IncomingTransferBase & {
      action: "NOTE_CONTENT";
      payload: NoteTransferPayload;
    });

export interface TransferHistoryEntry {
  messageId: string;
  direction: "sent" | "received";
  time: number;
  action: TransferAction;
  deviceName: string;
  summary: string;
  status: TransferDeliveryStatus;
  targetDevice?: string;
  payload?: TransferPayload;
  attempts: number;
  serverTime?: number;
  error?: string;
}

export interface TransferAckPayload {
  messageId: string;
  status: "delivered" | "failed";
  serverTime?: number;
  error?: string;
}

export interface WebSocketDevice {
  deviceId: string;
  deviceName: string;
  online: boolean;
}

export interface WebSocketEnvelope<TPayload = unknown> {
  event: string;
  payload: TPayload;
}
