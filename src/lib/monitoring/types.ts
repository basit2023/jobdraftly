import type { DiscoveryType } from "@/generated/prisma/client";

export type DiscoveryDocument = {
  url: string;
  mimeType: string | null;
  reference: string | null;
};

export type DiscoveryCandidate = {
  externalId: string | null;
  canonicalUrl: string;
  title: string;
  summary: string | null;
  type: DiscoveryType;
  publishedAt: Date | null;
  deadline: Date | null;
  documents: DiscoveryDocument[];
  rawPayload: Record<string, string>;
};

export type MonitorPayloadMode = "API" | "RSS" | "WEB_PAGE";
