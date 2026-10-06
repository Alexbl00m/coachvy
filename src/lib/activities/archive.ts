/**
 * Plockar ut aktivitetsfilerna ur det adepten laddat ner: lösa .fit-filer,
 * komprimerade .fit.gz (TrainingPeaks, Strava) och zip-arkiv – också zip i
 * zip, som i Garmins export.
 *
 * Arkivet läses bit för bit med `Blob.slice` och packas upp med webbläsarens
 * egen `DecompressionStream`, så att en export på en gigabyte inte behöver
 * ligga i minnet på en gång och inget bibliotek behövs. Allt sker i
 * webbläsaren; ingenting skickas.
 */

export type ArchiveEntry = {
  /** Sökvägen i arkivet, eller filnamnet. */
  name: string;
  read: () => Promise<ArrayBuffer>;
};

export type ArchiveScan = {
  fit: ArchiveEntry[];
  /** Filer som inte är FIT – GPX, TCX, JSON i Garmins export – räknas bara. */
  skipped: number;
  /** Arkiv som inte gick att läsa, med skälet. */
  errors: string[];
};

const lower = (name: string) => name.toLowerCase();
const isFit = (name: string) => lower(name).endsWith(".fit");
const isFitGz = (name: string) => lower(name).endsWith(".fit.gz");
const isZip = (name: string) => lower(name).endsWith(".zip");

async function inflate(
  data: Blob,
  format: "gzip" | "deflate-raw",
): Promise<ArrayBuffer> {
  const stream = data.stream().pipeThrough(new DecompressionStream(format));
  return new Response(stream).arrayBuffer();
}

const u16 = (v: DataView, at: number) => v.getUint16(at, true);
const u32 = (v: DataView, at: number) => v.getUint32(at, true);
const u64 = (v: DataView, at: number) => Number(v.getBigUint64(at, true));

type ZipEntry = {
  name: string;
  method: number;
  encrypted: boolean;
  compressedSize: number;
  localOffset: number;
};

/** Centralkatalogen ur ett zip-arkiv, med stöd för zip64. */
async function zipEntries(zip: Blob): Promise<ZipEntry[]> {
  // Slutposten ligger sist, efter en kommentar på högst 64 kB.
  const tailSize = Math.min(zip.size, 22 + 65_535 + 20);
  const tailStart = zip.size - tailSize;
  const tail = new DataView(await zip.slice(tailStart).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("inget zip-arkiv");

  let count = u16(tail, eocd + 10);
  let dirSize = u32(tail, eocd + 12);
  let dirOffset = u32(tail, eocd + 16);
  // Zip64: de riktiga värdena står i en egen slutpost som lokaliseraren pekar ut.
  if (eocd >= 20 && u32(tail, eocd - 20) === 0x07064b50) {
    const at = u64(tail, eocd - 20 + 8);
    const z64 = new DataView(await zip.slice(at, at + 56).arrayBuffer());
    if (u32(z64, 0) === 0x06064b50) {
      count = u64(z64, 32);
      dirSize = u64(z64, 40);
      dirOffset = u64(z64, 48);
    }
  }

  const dir = new DataView(
    await zip.slice(dirOffset, dirOffset + dirSize).arrayBuffer(),
  );
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= dir.byteLength; n += 1) {
    if (u32(dir, p) !== 0x02014b50) break;
    const flags = u16(dir, p + 8);
    const method = u16(dir, p + 10);
    let compressedSize = u32(dir, p + 20);
    const uncompressedSize = u32(dir, p + 24);
    const nameLength = u16(dir, p + 28);
    const extraLength = u16(dir, p + 30);
    const commentLength = u16(dir, p + 32);
    let localOffset = u32(dir, p + 42);
    const name = decoder.decode(
      new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength),
    );
    // Zip64-fältet har bara de värden som inte fick plats, i den här ordningen.
    let e = p + 46 + nameLength;
    const extraEnd = e + extraLength;
    while (e + 4 <= extraEnd) {
      const id = u16(dir, e);
      const size = u16(dir, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressedSize === 0xffffffff) q += 8;
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(dir, q);
          q += 8;
        }
        if (localOffset === 0xffffffff) localOffset = u64(dir, q);
      }
      e += 4 + size;
    }
    if (!name.endsWith("/")) {
      entries.push({
        name,
        method,
        encrypted: (flags & 1) === 1,
        compressedSize,
        localOffset,
      });
    }
    p = extraEnd + commentLength;
  }
  return entries;
}

/** Själva innehållet i en post, uppackat. */
async function zipData(zip: Blob, entry: ZipEntry): Promise<Blob> {
  const header = new DataView(
    await zip.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer(),
  );
  if (u32(header, 0) !== 0x04034b50) throw new Error("trasig post");
  const start = entry.localOffset + 30 + u16(header, 26) + u16(header, 28);
  const raw = zip.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return new Blob([await inflate(raw, "deflate-raw")]);
  throw new Error("okänd komprimering");
}

/** En FIT-fil som `ArchiveEntry`, uppackad om den är .fit.gz. */
function fitEntry(name: string, blob: () => Promise<Blob>): ArchiveEntry {
  return {
    name,
    read: async () => {
      const data = await blob();
      return isFitGz(name) ? inflate(data, "gzip") : data.arrayBuffer();
    },
  };
}

async function scanZip(
  zip: Blob,
  label: string,
  out: ArchiveScan,
  depth: number,
): Promise<void> {
  let entries: ZipEntry[];
  try {
    entries = await zipEntries(zip);
  } catch {
    out.errors.push(`${label} gick inte att öppna som zip.`);
    return;
  }
  for (const entry of entries) {
    const base = entry.name.split("/").pop() ?? entry.name;
    if (base.startsWith(".") || entry.name.startsWith("__MACOSX/")) continue;
    if (entry.encrypted) {
      out.skipped += 1;
      continue;
    }
    if (isZip(base) && depth < 3) {
      try {
        await scanZip(await zipData(zip, entry), base, out, depth + 1);
      } catch {
        out.errors.push(`${base} gick inte att packa upp.`);
      }
    } else if (isFit(base) || isFitGz(base)) {
      out.fit.push(fitEntry(entry.name, () => zipData(zip, entry)));
    } else {
      out.skipped += 1;
    }
  }
}

/**
 * Går igenom filerna som valts eller släppts och listar FIT-filerna i dem.
 * Själva filerna läses först när `read()` anropas, en i taget.
 */
export async function scanFiles(files: File[]): Promise<ArchiveScan> {
  const out: ArchiveScan = { fit: [], skipped: 0, errors: [] };
  for (const file of files) {
    if (isZip(file.name)) await scanZip(file, file.name, out, 0);
    else if (isFit(file.name) || isFitGz(file.name))
      out.fit.push(fitEntry(file.name, async () => file));
    else out.skipped += 1;
  }
  return out;
}
