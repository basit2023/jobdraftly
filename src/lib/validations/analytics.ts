import { z } from "zod";

export const analyticsEventSchema = z.object({
  type: z.enum(["JOB_VIEW", "APPLICATION_LINK_CLICK", "SEARCH", "FILTER"]),
  jobId: z.string().max(30).optional(),
  path: z.string().trim().startsWith("/").max(255),
  locationSlug: z.string().trim().regex(/^[a-z0-9-]+$/).max(191).optional(),
  categorySlug: z.string().trim().regex(/^[a-z0-9-]+$/).max(191).optional(),
  filterCount: z.number().int().min(0).max(20).default(0),
  metadata: z.object({
    hasKeyword: z.boolean().optional(),
    resultCount: z.number().int().min(0).max(10_000_000).optional(),
  }).strict().optional(),
}).strict().superRefine((event, context) => {
  if (["JOB_VIEW", "APPLICATION_LINK_CLICK"].includes(event.type) && !event.jobId) {
    context.addIssue({ code: "custom", message: "Job events require jobId", path: ["jobId"] });
  }
});
