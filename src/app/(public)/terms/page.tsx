
import { PageHero } from "@/components/layout/page-hero";
import { ProsePage } from "@/components/layout/prose-page";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({ title: "Terms of Use", description: "The terms for using JobDraftly, including how job listings are sourced, how external application links work and what we are and aren't responsible for.", path: "/terms" });

export default function TermsPage() {
  return (
    <>
      <PageHero
        description="The rules for using JobDraftly and the job links on it."
        title="Terms of Use"
      />
      <ProsePage>
        <p><strong>Last updated:</strong> 8 November 2026</p>

        <h2>Public discovery service</h2>
        <p>
          JobDraftly organizes vacancy information for discovery. It is not the employer,
          recruiter, or application processor unless a listing explicitly states otherwise.
          JobDraftly does not guarantee an interview, offer, or hiring outcome.
        </p>

        <h2>Original sources</h2>
        <p>
          Listings may summarize information from permitted employer or public sources and
          retain attribution. The original source controls its application process and may
          update or close a vacancy independently.
        </p>

        <h2>Responsible use</h2>
        <ul>
          <li>Do not misuse the service, interfere with access, or attempt unauthorized entry.</li>
          <li>Do not republish JobDraftly content in a misleading or unlawful manner.</li>
          <li>Verify application destinations before sharing personal information.</li>
          <li>Never treat a request for payment as proof of a legitimate vacancy.</li>
        </ul>

        <h2>Accuracy and availability</h2>
        <p>
          Reasonable efforts are made to show published, non-expired records, but external
          sources can change without notice. Report suspected errors through the contact
          page. The service may change or be temporarily unavailable during development.
        </p>

        <h2>External websites</h2>
        <p>
          External websites have their own terms, privacy practices, and security controls.
          Following an external link does not make JobDraftly responsible for that website.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated as JobDraftly introduces new capabilities. Material
          changes will be reflected by the date shown above.
        </p>
      </ProsePage>
    </>
  );
}
