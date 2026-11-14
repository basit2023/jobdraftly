import Script from "next/script";

const DEFAULT_TAG_MANAGER_ID = "GTM-WFDVNXZ4";

export function AnalyticsScripts() {
  const configuredId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  const tagManagerId = configuredId && /^GTM-[A-Z0-9]+$/.test(configuredId)
    ? configuredId
    : DEFAULT_TAG_MANAGER_ID;

  return (
    <>
      <Script id="jobdraftly-gtm-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});function gtag(){window.dataLayer.push(arguments)};gtag('js',new Date());`}
      </Script>
      <Script
        async
        id="jobdraftly-gtm"
        src={`https://www.googletagmanager.com/gtm.js?id=${tagManagerId}`}
        strategy="afterInteractive"
      />
      <noscript>
        <iframe
          aria-hidden="true"
          height="0"
          src={`https://www.googletagmanager.com/ns.html?id=${tagManagerId}`}
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
          width="0"
        />
      </noscript>
    </>
  );
}
