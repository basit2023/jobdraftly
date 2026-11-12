import type { Metadata } from "next";

export const SITE_NAME = "JobDraftly";
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
export const SITE_URL = configuredSiteUrl && /^https:\/\//.test(configuredSiteUrl)
  ? configuredSiteUrl.replace(/\/$/, "")
  : "https://www.jobdraftly.com";
export const SEO_MIN_INDEXABLE_LISTING_JOBS = 2;

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function compactText(value: string, maximum = 160) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1).trimEnd()}…`;
}

export function hasSearchParams(params: Record<string, string | string[] | undefined>) {
  return Object.values(params).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value));
}

/** Default social share image (src/app/opengraph-image.tsx), used unless a page passes its own. */
export const DEFAULT_SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "JobDraftly — Jobs in Pakistan" };

export function pageMetadata(input: {
  title: string;
  /** Use the title as-is, without the " | JobDraftly" suffix. */
  absoluteTitle?: boolean;
  image?: string | null;
  description: string;
  path: string;
  index?: boolean;
  type?: "website" | "article";
}): Metadata {
  const description = compactText(input.description);
  const canonical = absoluteUrl(input.path);
  const index = input.index ?? true;
  const images = [input.image ? { url: input.image, alt: input.title } : DEFAULT_SHARE_IMAGE];
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    alternates: { canonical },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
      : { index: false, follow: true },
    openGraph: {
      type: input.type ?? "website",
      locale: "en_PK",
      siteName: SITE_NAME,
      title: input.title,
      description,
      url: canonical,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

