export type ValidImage = { extension: "png" | "jpg" | "webp"; width: number; height: number };

const MAX_DIMENSION = 4_096;
const MAX_PIXELS = 16_000_000;

function validDimensions(width: number, height: number) {
  return width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION && width * height <= MAX_PIXELS;
}

function png(bytes: Uint8Array): ValidImage | null {
  if (bytes.length < 33 || ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  if (String.fromCharCode(...bytes.slice(-8, -4)) !== "IEND") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return validDimensions(width, height) ? { extension: "png", width, height } : null;
}

function jpeg(bytes: Uint8Array): ValidImage | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01) { offset += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return validDimensions(width, height) ? { extension: "jpg", width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}

function webp(bytes: Uint8Array): ValidImage | null {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return null;
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  let width = 0;
  let height = 0;
  if (kind === "VP8X") {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else if (kind === "VP8L" && bytes[20] === 0x2f) {
    width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
  } else if (kind === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
  }
  return validDimensions(width, height) ? { extension: "webp", width, height } : null;
}

export function validateImage(bytes: Uint8Array, declaredType: string): ValidImage | null {
  const image = png(bytes) ?? jpeg(bytes) ?? webp(bytes);
  if (!image) return null;
  const accepted = image.extension === "jpg" ? ["image/jpeg", "image/jpg"] : [`image/${image.extension}`];
  return accepted.includes(declaredType.toLowerCase()) ? image : null;
}
