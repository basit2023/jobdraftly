import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Employer", template: "%s | JobDraftly for Employers" },
  robots: { index: false, follow: false, nocache: true },
};

export default function EmployerRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
