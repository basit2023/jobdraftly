import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";

import { SITE_NAME, SITE_URL } from "@/lib/seo/site";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";

import "./globals.css";

// Poppins is not a variable font, so each weight in use must be listed.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

// Montserrat is a variable font; headings and the wordmark use it.
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "JobDraftly | Jobs in Pakistan",
    template: "%s | JobDraftly",
  },
  description:
    "Search jobs across Pakistan by city, category, company, and work arrangement.",
  applicationName: "JobDraftly",
  category: "employment",
  keywords: [
    "jobs in Pakistan",
    "Pakistan jobs",
    "careers",
    "government jobs",
    "remote jobs",
    "internships",
  ],
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: SITE_NAME,
    title: "JobDraftly | Jobs in Pakistan",
    description:
      "Search jobs across Pakistan by city, category, company, and work arrangement.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "JobDraftly | Jobs in Pakistan",
    description: "Search jobs across Pakistan by city, category, company, and work arrangement.",
  },
  // No site-wide `robots` here: pages set it through pageMetadata(), and Next.js adds
  // `noindex` to 404s automatically. A root value would be emitted alongside that noindex.
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${poppins.variable} ${montserrat.variable}`} lang="en-PK">
      <body className="font-sans" suppressHydrationWarning>{children}<AnalyticsScripts /></body>
    </html>
  );
}

