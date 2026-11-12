/* eslint-disable @next/next/no-img-element */

import Image from "next/image";

export function CompanyLogo({
  name,
  logoUrl,
  size = "md",
  priority = false,
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  const dimensions = {
    sm: "size-11 rounded-md text-base",
    md: "size-14 rounded-lg text-lg",
    lg: "size-20 rounded-lg text-2xl",
  }[size];
  const pixels = { sm: 44, md: 56, lg: 80 }[size];

  const validLogo = (() => {
    if (!logoUrl) return null;
    if (/^\/uploads\/company-logos\/[0-9a-f-]+\.(png|jpg|webp)$/i.test(logoUrl)) {
      return logoUrl;
    }
    try {
      const url = new URL(logoUrl);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  })();

  return (
    <span
      aria-label={`${name} logo`}
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-line bg-paper font-display font-bold text-body ${dimensions}`}
      role="img"
    >
      {validLogo?.startsWith("/") ? (
        <Image alt="" className="object-contain p-2" fill priority={priority} sizes={`${pixels}px`} src={validLogo} />
      ) : validLogo ? (
        <img alt="" className="size-full object-contain p-2" decoding="async" height={pixels} loading={priority ? "eager" : "lazy"} src={validLogo} width={pixels} />
      ) : (
        name.charAt(0).toLocaleUpperCase("en")
      )}
    </span>
  );
}
