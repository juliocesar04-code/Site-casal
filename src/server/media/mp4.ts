export type VideoInfo = {
  durationMs: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
};

type Box = { type: string; start: number; end: number; body: number };

function readBoxes(buf: Buffer, start: number, end: number): Box[] | null {
  const boxes: Box[] = [];
  let offset = start;

  while (offset < end) {
    if (offset + 8 > end) return null;
    let size = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    let header = 8;

    if (size === 1) {
      if (offset + 16 > end) return null;
      const large = buf.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(large);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < header || offset + size > end) return null;
    boxes.push({ type, start: offset, end: offset + size, body: offset + header });
    offset += size;
  }

  return boxes;
}

function child(buf: Buffer, parent: Box, type: string): Box | undefined {
  return readBoxes(buf, parent.body, parent.end)?.find((box) => box.type === type);
}

// Structural parse of an ISO-BMFF container: every box must fit inside its
// parent and the file must carry a movie header with a real duration. Files
// that only pretend to be MP4 (renamed executables, truncated uploads,
// polyglots with a fake ftyp) fail here.
export function inspectMp4(buf: Buffer): VideoInfo | null {
  const top = readBoxes(buf, 0, buf.length);
  if (!top || top[0]?.type !== "ftyp") return null;

  const moov = top.find((box) => box.type === "moov");
  if (!moov) return null;

  const mvhd = child(buf, moov, "mvhd");
  if (!mvhd || mvhd.body + 32 > mvhd.end) return null;

  const version = buf.readUInt8(mvhd.body);
  let timescale: number;
  let duration: number;
  if (version === 1) {
    timescale = buf.readUInt32BE(mvhd.body + 20);
    duration = Number(buf.readBigUInt64BE(mvhd.body + 24));
  } else {
    timescale = buf.readUInt32BE(mvhd.body + 12);
    duration = buf.readUInt32BE(mvhd.body + 16);
  }
  if (!timescale || !duration) return null;

  let width: number | null = null;
  let height: number | null = null;
  let videoCodec: string | null = null;

  for (const trak of readBoxes(buf, moov.body, moov.end)?.filter((box) => box.type === "trak") ?? []) {
    const tkhd = child(buf, trak, "tkhd");
    if (tkhd && tkhd.end - 8 >= tkhd.body) {
      const w = buf.readUInt32BE(tkhd.end - 8) / 65536;
      const h = buf.readUInt32BE(tkhd.end - 4) / 65536;
      if (w > 0 && h > 0 && width === null) {
        width = Math.round(w);
        height = Math.round(h);
        const mdia = child(buf, trak, "mdia");
        const minf = mdia && child(buf, mdia, "minf");
        const stbl = minf && child(buf, minf, "stbl");
        const stsd = stbl && child(buf, stbl, "stsd");
        if (stsd && stsd.body + 16 <= stsd.end) {
          videoCodec = buf.toString("latin1", stsd.body + 12, stsd.body + 16);
        }
      }
    }
  }

  return { durationMs: Math.round((duration / timescale) * 1000), width, height, videoCodec };
}

export const ALLOWED_VIDEO_CODECS = new Set(["avc1", "avc3", "hvc1", "hev1"]);
