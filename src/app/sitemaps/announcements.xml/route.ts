import { announcementSitemapEntries } from "@/lib/seo/sitemaps";
import { renderUrlSet, sitemapResponse } from "@/lib/seo/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET() {
  return sitemapResponse(renderUrlSet(await announcementSitemapEntries()));
}
