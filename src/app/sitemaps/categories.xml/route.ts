import { categorySitemapEntries } from "@/lib/seo/sitemaps";
import { renderUrlSet, sitemapResponse } from "@/lib/seo/sitemap-xml";

export const revalidate = 900;
export const dynamic = "force-dynamic";
export async function GET() { return sitemapResponse(renderUrlSet(await categorySitemapEntries())); }

