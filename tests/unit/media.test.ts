import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectMime } from "@/server/media/detect";
import { processImage } from "@/server/media/image";
import { inspectMp4 } from "@/server/media/mp4";

function box(type: string, ...children: Buffer[]): Buffer {
  const body = Buffer.concat(children);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

function u32(...values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buf.writeUInt32BE(value, index * 4));
  return buf;
}

function mp4({ brand = "isom", timescale = 1000, duration = 5000, codec = "avc1" } = {}): Buffer {
  const ftyp = box("ftyp", Buffer.from(brand, "latin1"), u32(0), Buffer.from("isomavc1", "latin1"));
  const mvhd = box("mvhd", u32(0, 0, 0, timescale, duration), Buffer.alloc(80));
  const tkhd = box("tkhd", Buffer.alloc(76), u32(1280 * 65536, 720 * 65536));
  const stsd = box("stsd", u32(0, 1), u32(86), Buffer.from(codec, "latin1"), Buffer.alloc(78));
  const trak = box("trak", tkhd, box("mdia", box("minf", box("stbl", stsd))));
  return Buffer.concat([ftyp, box("moov", mvhd, trak), box("mdat", Buffer.alloc(32))]);
}

describe("detectMime", () => {
  it("identifies allowed formats by content", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
    const jpeg = await sharp(png).jpeg().toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    expect(detectMime(png)).toBe("image/png");
    expect(detectMime(jpeg)).toBe("image/jpeg");
    expect(detectMime(webp)).toBe("image/webp");
    expect(detectMime(mp4())).toBe("video/mp4");
    expect(detectMime(mp4({ brand: "qt  " }))).toBe("video/quicktime");
  });

  it("rejects everything else regardless of name or declared type", () => {
    expect(detectMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(detectMime(Buffer.from("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(detectMime(Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00", "latin1"))).toBeNull();
    expect(detectMime(Buffer.from("%PDF-1.7 obj stream"))).toBeNull();
    expect(detectMime(Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"))).toBeNull();
    expect(detectMime(Buffer.alloc(0))).toBeNull();
    expect(detectMime(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it("only accepts known ISO-BMFF brands", () => {
    expect(detectMime(mp4({ brand: "heic" }))).toBeNull();
    expect(detectMime(mp4({ brand: "zzzz" }))).toBeNull();
  });
});

describe("inspectMp4", () => {
  it("reads duration, size and codec from the container", () => {
    expect(inspectMp4(mp4({ timescale: 600, duration: 18_000 }))).toEqual({
      durationMs: 30_000,
      width: 1280,
      height: 720,
      videoCodec: "avc1",
    });
  });

  it("rejects files that only look like MP4", () => {
    const fake = Buffer.concat([box("ftyp", Buffer.from("isom0000", "latin1")), Buffer.from("MZ executable payload")]);
    expect(inspectMp4(fake)).toBeNull();
    expect(inspectMp4(mp4().subarray(0, 60))).toBeNull();
    expect(inspectMp4(mp4({ duration: 0 }))).toBeNull();
  });

  it("rejects boxes that claim more bytes than the file has", () => {
    const file = mp4();
    file.writeUInt32BE(0x7fffffff, 0);
    expect(inspectMp4(file)).toBeNull();
  });

  it("reports codecs so the caller can refuse unexpected ones", () => {
    expect(inspectMp4(mp4({ codec: "mp4v" }))?.videoCodec).toBe("mp4v");
  });
});

describe("processImage", () => {
  it("re-encodes to WebP and strips metadata such as GPS", async () => {
    const withExif = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c96" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "owner", Artist: "someone" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 33/1 0/1" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await processImage(withExif, "jpeg");
    expect(result).not.toBeNull();
    const meta = await sharp(result!.main).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(result!.width).toBe(64);
  });

  it("drops anything appended after the image data", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).jpeg().toBuffer();
    const polyglot = Buffer.concat([jpeg, Buffer.from("<script>alert(document.cookie)</script>")]);
    const result = await processImage(polyglot, "jpeg");
    expect(result).not.toBeNull();
    expect(result!.main.includes(Buffer.from("<script>"))).toBe(false);
  });

  it("refuses when the real format differs from the detected one", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer();
    expect(await processImage(png, "jpeg")).toBeNull();
  });

  it("refuses corrupt and oversized images", async () => {
    expect(await processImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 1, 2, 3]), "jpeg")).toBeNull();
    // A tiny PNG header that declares a 20000x20000 canvas (decompression bomb shape).
    const huge = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#000" } }).png().toBuffer();
    huge.writeUInt32BE(20_000, 16);
    huge.writeUInt32BE(20_000, 20);
    expect(await processImage(huge, "png")).toBeNull();
  });
});
