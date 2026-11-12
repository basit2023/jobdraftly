"use client";

import { useEffect } from "react";

type Payload = {
  type: "JOB_VIEW" | "APPLICATION_LINK_CLICK" | "SEARCH" | "FILTER";
  jobId?: string;
  path: string;
  locationSlug?: string;
  categorySlug?: string;
  filterCount?: number;
  metadata?: { hasKeyword?: boolean; resultCount?: number };
};

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

export function recordAnalyticsEvent(payload: Payload, gaName: string) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics/events", new Blob([body], { type: "text/plain" }));
  else void fetch("/api/analytics/events", { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true });
  window.gtag?.("event", gaName, {
    job_id: payload.jobId,
    location: payload.locationSlug,
    category: payload.categorySlug,
    filter_count: payload.filterCount,
    has_keyword: payload.metadata?.hasKeyword,
    result_count: payload.metadata?.resultCount,
    transport_type: "beacon",
  });
}

export function JobViewEvent({ jobId, slug }: { jobId: string; slug: string }) {
  useEffect(() => { recordAnalyticsEvent({ type: "JOB_VIEW", jobId, path: `/jobs/${slug}` }, "job_view"); }, [jobId, slug]);
  return null;
}

export function SearchEvents({
  path, locationSlug, categorySlug, filterCount, hasKeyword, resultCount,
}: {
  path: string; locationSlug?: string; categorySlug?: string; filterCount: number; hasKeyword: boolean; resultCount: number;
}) {
  useEffect(() => {
    const base = { path, locationSlug, categorySlug, filterCount, metadata: { hasKeyword, resultCount } };
    recordAnalyticsEvent({ type: "SEARCH", ...base }, "job_search");
    if (filterCount > 0) recordAnalyticsEvent({ type: "FILTER", ...base }, "job_filter");
  }, [path, locationSlug, categorySlug, filterCount, hasKeyword, resultCount]);
  return null;
}
