import type { Metadata } from "next";

import PublicNotFound from "../not-found";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default PublicNotFound;
