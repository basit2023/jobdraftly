import { absoluteUrl } from "@/lib/seo/site";
import { renderSitemapIndex, sitemapResponse } from "@/lib/seo/sitemap-xml";

export const revalidate = 900;

export function GET() {
  return sitemapResponse(renderSitemapIndex([
    absoluteUrl("/sitemaps/pages.xml"),
    absoluteUrl("/sitemaps/jobs.xml"),
    absoluteUrl("/sitemaps/categories.xml"),
    absoluteUrl("/sitemaps/locations.xml"),
    absoluteUrl("/sitemaps/organizations.xml"),
    absoluteUrl("/sitemaps/announcements.xml"),
  ]));
}

