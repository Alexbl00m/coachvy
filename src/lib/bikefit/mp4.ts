/**
 * Bildfrekvensen ur filen, inte ur webbläsarens uppspelning.
 *
 * En mobil filmar ofta i 60 eller 120 bilder per sekund, och mätkedjan räknar
 * trampperioden och fönstret runt nedre dödläget i bilder. Att gissa 30
 * skulle förskjuta allt. MP4 och MOV (det mobiler spelar in) bär frekvensen i
 * videospårets tidsskala och stts-tabell; den läses här. Ren modul: den tar
 * moov-boxens bytes, så att den går att testa utan en riktig fil.
 */

export type VideoTrackInfo = {
  /** Medelbildfrekvens: bilder genom spårets längd. */
  fps: number;
  frames: number;
  durationS: number;
  /** Den vanligaste bildlängden som frekvens, för variabel bildfrekvens. */
  nominalFps: number;
};

type Box = { type: string; start: number; end: number };

function* boxes(view: DataView, start: number, end: number): Generator<Box> {
  let at = start;
  while (at + 8 <= end) {
    let size = view.getUint32(at);
    const type = String.fromCharCode(
      view.getUint8(at + 4),
      view.getUint8(at + 5),
      view.getUint8(at + 6),
      view.getUint8(at + 7),
    );
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) return;
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) size = end - at;
    if (size < header || at + size > end) return;
    yield { type, start: at + header, end: at + size };
    at += size;
  }
}

const child = (view: DataView, box: Box, type: string) => {
  for (const b of boxes(view, box.start, box.end))
    if (b.type === type) return b;
  return null;
};

/** Videospårets bildfrekvens ur moov-boxens innehåll (utan dess huvud). */
export function videoTrackInfo(moov: ArrayBuffer): VideoTrackInfo | null {
  const view = new DataView(moov);
  for (const trak of boxes(view, 0, moov.byteLength)) {
    if (trak.type !== "trak") continue;
    const mdia = child(view, trak, "mdia");
    if (!mdia) continue;
    const hdlr = child(view, mdia, "hdlr");
    if (!hdlr || hdlr.end - hdlr.start < 12) continue;
    const handler = String.fromCharCode(
      ...[8, 9, 10, 11].map((i) => view.getUint8(hdlr.start + i)),
    );
    if (handler !== "vide") continue;
    const mdhd = child(view, mdia, "mdhd");
    const stbl = (() => {
      const minf = child(view, mdia, "minf");
      return minf ? child(view, minf, "stbl") : null;
    })();
    const stts = stbl ? child(view, stbl, "stts") : null;
    if (!mdhd || !stts) return null;
    const version = view.getUint8(mdhd.start);
    const timescale = view.getUint32(mdhd.start + (version === 1 ? 20 : 12));
    if (!timescale) return null;
    const entries = view.getUint32(stts.start + 4);
    let frames = 0;
    let ticks = 0;
    let common = { count: 0, delta: 0 };
    for (let i = 0; i < entries; i++) {
      const at = stts.start + 8 + i * 8;
      if (at + 8 > stts.end) break;
      const count = view.getUint32(at);
      const delta = view.getUint32(at + 4);
      frames += count;
      ticks += count * delta;
      if (count > common.count && delta > 0) common = { count, delta };
    }
    if (!frames || !ticks || !common.delta) return null;
    const durationS = ticks / timescale;
    return {
      fps: frames / durationS,
      frames,
      durationS,
      nominalFps: timescale / common.delta,
    };
  }
  return null;
}

/**
 * Läser bara huvudena på filens översta nivå och sedan moov-boxen, så att en
 * stor video inte behöver läsas in i minnet. Null för annat än MP4/MOV.
 */
export async function readVideoTrackInfo(
  file: Blob,
): Promise<VideoTrackInfo | null> {
  let at = 0;
  while (at + 8 <= file.size) {
    const head = new DataView(await file.slice(at, at + 16).arrayBuffer());
    let size = head.getUint32(0);
    const type = String.fromCharCode(
      head.getUint8(4),
      head.getUint8(5),
      head.getUint8(6),
      head.getUint8(7),
    );
    let header = 8;
    if (size === 1) {
      size = Number(head.getBigUint64(8));
      header = 16;
    } else if (size === 0) size = file.size - at;
    if (size < header) return null;
    if (at === 0 && type !== "ftyp") return null;
    if (type === "moov")
      return videoTrackInfo(
        await file.slice(at + header, at + size).arrayBuffer(),
      );
    at += size;
  }
  return null;
}
