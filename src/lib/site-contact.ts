import { z } from "zod";

const DEFAULT_CONTACT_EMAIL = "fastsitecheck@gmail.com";

/** Public contact address. NEXT_PUBLIC_CONTACT_EMAIL overrides the default. */
export const CONTACT_EMAIL = z.email().safeParse(process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()).data ?? DEFAULT_CONTACT_EMAIL;
