import "server-only";
import sharp from "sharp";

export type ProcessedImage = {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
};

const MAX_INPUT_PIXELS = 40_000_000;
const MAIN_EDGE = 2400;
const THUMB_EDGE = 640;

sharp.cache(false);
sharp.concurrency(1);

// Decodes and re-encodes every image. Whatever was appended to or hidden in
// the original (scripts, polyglot payloads, EXIF including GPS) does not
// survive: the output is a fresh WebP produced from decoded pixels.
export async function processImage(input: Buffer, expected: "jpeg" | "png" | "webp"): Promise<ProcessedImage | null> {
  try {
    const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 });
    const meta = await source.metadata();
    if (meta.format !== expected || !meta.width || !meta.height) return null;

    const main = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 })
      .rotate()
      .resize({ width: MAIN_EDGE, height: MAIN_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const thumb = await sharp(main.data)
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    return { main: main.data, thumb, width: main.info.width, height: main.info.height };
  } catch {
    return null;
  }
}
