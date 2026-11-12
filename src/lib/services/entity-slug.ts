import { normalizeMatchingText } from "./job-identity";

export function createEntitySlug(name: string): string {
  return (
    normalizeMatchingText(name)
      .replaceAll(" ", "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 180)
      .replace(/-$/g, "") || "item"
  );
}
