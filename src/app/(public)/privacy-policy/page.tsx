
import { PageHero } from "@/components/layout/page-hero";
import { ProsePage } from "@/components/layout/prose-page";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({ title: "Privacy Policy", description: "How JobDraftly handles your information when you search for jobs or apply with your CV, who can see your application, how long we keep it and your choices.", path: "/privacy-policy" });

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        description="What information we collect, how we use it and the choices you have."
        title="Privacy Policy"
      />
      <ProsePage>
        <p><strong>Last updated:</strong> 15 November 2026</p>
        <p>
          This policy describes the public JobDraftly website, applications sent through it,
          and the accounts companies use to post jobs.
        </p>

        <h2>Information you provide</h2>
        <p>
          The current public job search does not require an account. If you contact
          JobDraftly through your email application, your message is handled by your email
          provider and the receiving mailbox according to their respective policies.
        </p>

        <h2>Job applications</h2>
        <p>
          Some jobs let you apply on JobDraftly. When you do, we collect your name, email
          address, mobile number, optional city and message, and your CV. We share them only
          with the company that posted that job, which uses them to consider you for the role
          and to contact you. Your CV is stored privately: it is never published, and only that
          company&apos;s signed-in staff and JobDraftly administrators can open it.
        </p>
        <p>
          Applications and CVs are deleted automatically 12 months after you send them. To
          have an application deleted sooner, or to ask what we hold about you, email us from
          the address you applied with.
        </p>
        <p>
          Other jobs send you to the employer&apos;s or original source&apos;s own website.
          Information you submit there is controlled by that website, not by JobDraftly.
          Review its privacy notice before applying.
        </p>

        <h2>Company accounts</h2>
        <p>
          Companies that post jobs have staff logins created by JobDraftly. We store each
          person&apos;s name, work email, a securely hashed password and when they last signed
          in. Companies are responsible for how they use the applications they receive.
        </p>

        <h2>Technical information</h2>
        <p>
          Standard server logs may contain request time, requested page, browser details,
          and network information needed for security and reliability. JobDraftly does not
          publish candidate profiles or sell candidate data.
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
