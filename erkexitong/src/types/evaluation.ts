export type DimensionKey = "moral" | "academic" | "sports" | "aesthetic" | "labor";
export type SectionKey = "base" | "extension";
export type ScoreType = "fixed" | "select" | "count" | "number" | "deduction";

export interface ScoreOption {
  label: string;
  value: string;
  score: number;
}

export interface ProofImage {
  id: string;
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  size?: number;
  uploaded: boolean;
}

export interface EvaluationItemConfig {
  id: string;
  title: string;
  description: string;
  maxScore: number;
  scoreType: ScoreType;
  mode: "single" | "multi";
  requiredText: boolean;
  imageLimit: number;
  placeholder: string;
  fixedScore?: number;
  scorePerRecord?: number;
  scorePerUnit?: number;
  unitLabel?: string;
  options?: ScoreOption[];
}

export interface EvaluationSectionConfig {
  key: SectionKey;
  title: string;
  maxScore: number;
  items: EvaluationItemConfig[];
}

export interface EvaluationDimensionConfig {
  key: DimensionKey;
  title: string;
  maxScore: number;
  baseMax: number;
  extensionMax: number;
  sections: EvaluationSectionConfig[];
}

export interface ProofRecord {
  id: string;
  dimensionKey: DimensionKey;
  sectionKey: SectionKey;
  itemId: string;
  text: string;
  images: ProofImage[];
  selectedOption?: string;
  numericValue?: number;
  createdAt: number;
  updatedAt: number;
  dirty: boolean;
}

export type EvaluationRecordMap = Record<string, ProofRecord[]>;

export interface EvaluationSnapshot {
  records: EvaluationRecordMap;
  selectedItemIds?: string[];
  savedAt: number;
  source?: "local" | "remote";
}

export interface EvaluationDraftSaveResult {
  snapshot: EvaluationSnapshot;
  remoteSaved: boolean;
  remoteError?: string;
}

export interface EvaluationSubmissionRequest {
  records: EvaluationRecordMap;
}

export interface EvaluationSubmissionResponse {
  submissionId: string;
}

export type EvaluationValidationIssueType =
  | "missing_text"
  | "empty_selected_item"
  | "invalid_number"
  | "local_image";

export interface EvaluationValidationIssue {
  type: EvaluationValidationIssueType;
  dimensionTitle: string;
  itemTitle: string;
  recordIndex?: number;
  message: string;
}
