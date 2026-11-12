import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Administrator", template: "%s | JobDraftly Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
