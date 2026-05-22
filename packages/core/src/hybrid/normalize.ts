import { createHash } from "node:crypto";
import type { MemoryKind, MemoryScope } from "../types.js";
import { redactPrivate } from "../redaction/private.js";

export type HybridOrigin = "local" | "supermemory-live" | "supermemory-export";
export type RemoteSystem = "supermemory";
export type SourceKind = "derived" | "manual" | "remote-import" | "raw_transcript" | "benchmark" | "private" | "unknown";

export interface HybridProvenance {
  origin: HybridOrigin;
  sourceId: string;
  observedAt: string;
  remoteSystem?: RemoteSystem;
  remoteId?: string;
  containerTag?: string;
}

export interface HybridCandidate {
  id: string;
  text: string;
  origin: HybridOrigin;
  score: number;
  kind?: MemoryKind;
  scope?: MemoryScope;
  containerTag?: string;
  remoteSystem?: RemoteSystem;
  remoteId?: string;
  sourceKind?: SourceKind;
  sourceId?: string;
  confidence?: number;
  syncEligible?: boolean;
  safeForRemote?: boolean;
  observedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  normalizedHash?: string;
  provenance?: HybridProvenance[];
  metadata?: Record<string, unknown>;
}

export interface NormalizedHybridCandidate extends HybridCandidate {
  normalizedHash: string;
  safeForRemote: boolean;
  redactionCount: number;
}

export function normalizeMemoryText(input: string): string {
  const redacted = redactPrivate(input).text;
  return redacted
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(^[^\w<]+|[^\w>]+$)/g, "")
    .trim();
}

export function normalizedHash(input: string): string {
  return createHash("sha256").update(normalizeMemoryText(input)).digest("hex");
}

export function normalizeHybridCandidate(candidate: HybridCandidate): NormalizedHybridCandidate | null {
  const redacted = redactPrivate(candidate.text);
  if (redacted.fullyPrivate) return null;
  const hash = candidate.normalizedHash ?? normalizedHash(redacted.text);
  const provenance: HybridProvenance[] = candidate.provenance ?? [
    {
      origin: candidate.origin,
      sourceId: candidate.sourceId ?? candidate.id,
      observedAt: candidate.observedAt ?? new Date(0).toISOString(),
      ...(candidate.remoteSystem ? { remoteSystem: candidate.remoteSystem } : {}),
      ...(candidate.remoteId ? { remoteId: candidate.remoteId } : {}),
      ...(candidate.containerTag ? { containerTag: candidate.containerTag } : {}),
    },
  ];

  return {
    ...candidate,
    text: redacted.text,
    normalizedHash: hash,
    safeForRemote: Boolean(candidate.safeForRemote) && !redacted.redacted,
    redactionCount: redacted.redactionCount,
    provenance,
  };
}

export function tokenizeForSimilarity(input: string): string[] {
  return normalizeMemoryText(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9_/-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function jaccardSimilarity(a: string, b: string): number {
  const aSet = new Set(tokenizeForSimilarity(a));
  const bSet = new Set(tokenizeForSimilarity(b));
  if (aSet.size === 0 && bSet.size === 0) return 1;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}
