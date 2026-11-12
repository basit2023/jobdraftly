
import { PageHero } from "@/components/layout/page-hero";
import { ProsePage } from "@/components/layout/prose-page";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({ title: "Privacy Policy", description: "How JobDraftly handles information when you search for jobs, contact us or follow a link to apply, including cookies, analytics and your choices.", path: "/privacy-policy" });

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        description="What information we collect, how we use it and the choices you have."
        title="Privacy Policy"
      />
      <ProsePage>
        <p><strong>Last updated:</strong> 11 November 2026</p>
        <p>
          This policy describes the public JobDraftly website. Additional notices may be
          introduced before account-based or CV features are launched.
        </p>

        <h2>Information you provide</h2>
        <p>
          The current public job search does not require an account. If you contact
          JobDraftly through your email application, your message is handled by your email
          provider and the receiving mailbox according to their respective policies.
        </p>

        <h2>Job applications</h2>
        <p>
          JobDraftly links to original employer or vacancy-source destinations. Information
          submitted after leaving JobDraftly is controlled by that destination, not by
          JobDraftly. Review the destination&apos;s privacy notice before applying.
        </p>

        <h2>Technical information</h2>
        <p>
          Standard server logs may contain request time, requested page, browser details,
          and network information needed for security and reliability. JobDraftly does not
          currently use public candidate profiles or sell candidate data.
        </p>

        <h2>Usage analytics</h2>
        <p>
          JobDraftly may measure job-page views, searches, filter usage, and clicks that
          open an external application page. An outbound click means only that the link
          was opened; it does not mean that an application was submitted or accepted.
          First-party operational analytics do not store raw search text, IP addresses,
          email addresses, or browser identifiers. Google Analytics may be enabled only
          after the production measurement and consent configuration is approved.
        </p>

        <h2>Cookies and future features</h2>
        <p>
          Essential technical storage may be used where required for security or site
          operation. Any material change involving analytics, accounts, saved jobs, or CV
          data will be reflected in an updated notice before launch.
        </p>

        <h2>Your choices</h2>
        <p>
          You can avoid following an external application link and can contact JobDraftly
          to request correction of inaccurate public information. Legal rights may vary by
          jurisdiction.
        </p>
      </ProsePage>
    </>
  );
}
