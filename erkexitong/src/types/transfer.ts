import type { DimensionKey, NoteReference, ProofImage, SectionKey } from "./evaluation";
import type { ContentBlock } from "./content";

export type TransferAction = "EDIT_ITEM" | "NOTE_CONTENT";

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
}

export type TransferPayload = EditingItemPayload | NoteTransferPayload;

interface IncomingTransferBase {
  targetDevice: string;
  fromDevice: string;
  time: number;
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
  direction: "sent" | "received";
  time: number;
  action: TransferAction;
  deviceName: string;
  summary: string;
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
