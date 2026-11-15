export type ValidDocument = { extension: "pdf" | "docx" | "doc"; mimeType: string };

export const MAX_CV_BYTES = 5 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value);

/**
 * Identifies a CV by its real bytes (never by the file name or browser-declared type).
 * Accepts PDF, Word .docx and legacy Word .doc.
 */
export function validateCvDocument(bytes: Uint8Array): ValidDocument | null {
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_CV_BYTES) return null;

  // %PDF-
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { extension: "pdf", mimeType: "application/pdf" };
  }
  // .docx is a ZIP whose entries live under word/
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const head = Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, 64 * 1024))).toString("latin1");
    if (head.includes("word/")) {
      return { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    }
    return null;
  }
  // Legacy .doc (OLE compound file)
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { extension: "doc", mimeType: "application/msword" };
  }
  return null;
}

/** A file name safe to show and to use in Content-Disposition. */
export function safeDownloadName(name: string, extension: string) {
  const base = name
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .normalize("NFKD")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "cv"}.${extension}`;
}
