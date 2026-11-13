const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16) || 32);
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10) || 32);
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Limit on text sent to the model; long pages are cut at this point and flagged. */
export const MAX_ADVERT_CHARACTERS = 120_000;

/** Converts an HTML page to readable plain text, keeping paragraph and list breaks. */
export function htmlToText(html: string): { text: string; truncated: boolean } {
  const text = decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table|ul|ol)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > MAX_ADVERT_CHARACTERS
    ? { text: text.slice(0, MAX_ADVERT_CHARACTERS), truncated: true }
    : { text, truncated: false };
}

/** Absolute http(s) image URLs from og:image and <img> tags, in page order, de-duplicated. */
export function findImageCandidates(html: string, pageUrl: string, limit = 15): string[] {
  const found: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    try {
      const url = new URL(decodeEntities(raw.trim()), pageUrl);
      if ((url.protocol === "https:" || url.protocol === "http:") && !found.includes(url.href)) found.push(url.href);
    } catch {
      // Ignore malformed URLs.
    }
  };
  for (const match of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/gi)) {
    add(/content=["']([^"']+)["']/i.exec(match[0])?.[1]);
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    if (/(?:width|height)=["']?(?:1|0)["'\s>]/i.test(tag)) continue; // tracking pixels
    add(/\ssrc=["']([^"']+)["']/i.exec(tag)?.[1]);
  }
  return found.filter((url) => !/\.(svg|gif)(\?|$)/i.test(url)).slice(0, limit);
}

/** Parses YYYY-MM-DD into the end of that day in Pakistan time (UTC+5). */
export function endOfPakistanDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function comparableWords(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Share of `excerpt` that appears word for word in `original`, from 0 to 1.
 * Compares overlapping 6-word sequences, so punctuation, bullets and line
 * breaks don't matter but rewording does. Very short excerpts compare whole words.
 */
export function verbatimShare(excerpt: string, original: string): number {
  const words = comparableWords(excerpt);
  if (!words.length) return 1;
  const source = comparableWords(original);
  const size = Math.min(6, words.length);
  const sourceGrams = new Set<string>();
  for (let index = 0; index + size <= source.length; index++) sourceGrams.add(source.slice(index, index + size).join(" "));
  let total = 0;
  let found = 0;
  for (let index = 0; index + size <= words.length; index++) {
    total++;
    if (sourceGrams.has(words.slice(index, index + size).join(" "))) found++;
  }
  return total ? found / total : 1;
}
