import { describe, expect, it } from "vitest";

import { readVideoTrackInfo, videoTrackInfo } from "./mp4";

const u32 = (n: number) => [
  n >>> 24,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
const box = (type: string, ...body: number[][]) => {
  const payload = body.flat();
  return [
    ...u32(8 + payload.length),
    ...[...type].map((c) => c.charCodeAt(0)),
    ...payload,
  ];
};
const fullBox = (type: string, version: number, ...body: number[][]) =>
  box(type, [version, 0, 0, 0], ...body);

/** Ett spår med tidsskala och stts-poster [antal, längd]. */
function trak(handler: string, timescale: number, stts: [number, number][]) {
  const mdhd = fullBox(
    "mdhd",
    0,
    u32(0),
    u32(0),
    u32(timescale),
    u32(0),
    [0, 0, 0, 0],
  );
  const hdlr = fullBox(
    "hdlr",
    0,
    u32(0),
    [...handler].map((c) => c.charCodeAt(0)),
    u32(0),
    u32(0),
    u32(0),
    [0],
  );
  const sttsBox = fullBox(
    "stts",
    0,
    u32(stts.length),
    ...stts.map(([c, d]) => [...u32(c), ...u32(d)]),
  );
  return box(
    "trak",
    box("mdia", mdhd, hdlr, box("minf", box("stbl", sttsBox))),
  );
}

const buf = (bytes: number[]) => new Uint8Array(bytes).buffer;

describe("videoTrackInfo", () => {
  it("läser 60 B/s ur en iPhone-lik tidsskala", () => {
    const info = videoTrackInfo(
      buf([
        ...trak("soun", 44100, [[100, 1024]]),
        ...trak("vide", 600, [[1200, 10]]),
      ]),
    );
    expect(info?.fps).toBeCloseTo(60, 6);
    expect(info?.frames).toBe(1200);
    expect(info?.durationS).toBeCloseTo(20, 6);
  });

  it("ger medel och nominell frekvens vid variabel bildfrekvens", () => {
    const info = videoTrackInfo(
      buf(
        trak("vide", 90000, [
          [290, 3000],
          [10, 6000],
        ]),
      ),
    );
    expect(info?.nominalFps).toBeCloseTo(30, 6);
    expect(info?.fps).toBeCloseTo(300 / ((290 * 3000 + 10 * 6000) / 90000), 6);
  });

  it("säger null när filen saknar videospår", () => {
    expect(videoTrackInfo(buf(trak("soun", 48000, [[10, 1024]])))).toBeNull();
  });
});

describe("readVideoTrackInfo", () => {
  it("hittar moov också efter mdat", async () => {
    const file = new Blob([
      new Uint8Array(box("ftyp", [...u32(0)])),
      new Uint8Array(box("mdat", new Array(5000).fill(7))),
      new Uint8Array(box("moov", trak("vide", 120, [[240, 1]]))),
    ]);
    const info = await readVideoTrackInfo(file);
    expect(info?.fps).toBeCloseTo(120, 6);
  });

  it("säger null för en fil som inte är MP4", async () => {
    expect(
      await readVideoTrackInfo(
        new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0])]),
      ),
    ).toBeNull();
  });
});
