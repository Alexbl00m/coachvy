/**
 * Spelar in analysvideon: varje bild med overlayn, i filens bildfrekvens, och
 * tar bilden från nedre dödläget. Bara för webbläsaren.
 *
 * Inspelningen sker i realtid (MediaRecorder tidsstämplar efter klockan), så
 * den tar lika lång tid som klippet. MP4 när webbläsaren kan, annars WebM.
 */

import type { ClipAnalysis, PoseFrame } from "./chain";
import {
  drawOverlay,
  overlayCanvasSize,
  overlayColors,
  overlayFont,
} from "./overlay";
import type { Assessment } from "./templates";
import type { OpenedVideo } from "./video-frames";

/** Längsta sidan i analysvideon; större filmer skalas ned. */
const MAX_SIDE = 1920;

export type RenderedMedia = {
  video: Blob | null;
  frame: Blob;
  mime: string | null;
};

const MIMES = [
  "video/mp4;codecs=avc1.640028",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function recordingMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** Bilden närmast medianen bland varvens nedre dödlägen. */
export function bdcFrameIndex(analysis: ClipAnalysis): number | null {
  const median = analysis.kneeFlexBdc;
  if (median === null || analysis.bdc.length === 0) return null;
  const best = analysis.bdc.reduce((a, b) =>
    Math.abs(b.flex - median) < Math.abs(a.flex - median) ? b : a,
  );
  return Math.round(best.at);
}

const seek = (video: HTMLVideoElement, t: number) =>
  new Promise<void>((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = t;
  });

export async function renderAnalysis(input: {
  opened: OpenedVideo;
  frames: PoseFrame[];
  analysis: ClipAnalysis;
  assessment: Assessment;
  title: string;
  onProgress: (share: number) => void;
  signal?: AbortSignal;
}): Promise<RenderedMedia> {
  const { opened, frames, analysis, assessment, title } = input;
  const { video, fps } = opened;
  const k = Math.min(1, MAX_SIDE / Math.max(opened.width, opened.height));
  const vw = Math.round(opened.width * k);
  const vh = Math.round(opened.height * k);
  const size = overlayCanvasSize(vw, vh);
  const canvas = document.createElement("canvas");
  // Jämna mått: videokodare vill ha det.
  canvas.width = size.width + (size.width % 2);
  canvas.height = size.height + (size.height % 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Webbläsaren kan inte rita analysvideon.");
  const colors = overlayColors();
  const font = overlayFont();
  const paint = (index: number) => {
    ctx.fillStyle = "#0c0c0e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, vw, vh);
    const i = Math.max(0, Math.min(frames.length - 1, index));
    drawOverlay(ctx, {
      width: vw,
      height: vh,
      k,
      index: i,
      frame: frames[i] ?? null,
      analysis,
      assessment,
      title,
      colors,
      font,
    });
  };

  // Bilden från nedre dödläget först, med sökning till exakt rätt bild.
  const bdc = bdcFrameIndex(analysis) ?? Math.floor(frames.length / 2);
  await seek(video, Math.min((bdc + 0.5) / fps, opened.durationS - 1e-3));
  paint(bdc);
  const frame = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Bilden gick inte att spara.")),
      "image/jpeg",
      0.9,
    ),
  );

  const mime = recordingMime();
  if (!mime || !("captureStream" in canvas))
    return { video: null, frame, mime: null };

  await seek(video, 0);
  paint(0);
  const stream = canvas.captureStream(Math.round(fps));
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>(
    (resolve) => (recorder.onstop = () => resolve()),
  );
  recorder.start(1000);
  video.playbackRate = 1;
  let running = true;
  const onFrame = (_: number, meta: VideoFrameCallbackMetadata) => {
    if (!running) return;
    const i = Math.round(meta.mediaTime * fps);
    paint(i);
    input.onProgress(Math.min(1, meta.mediaTime / opened.durationS));
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
  const ended = new Promise<void>((resolve) =>
    video.addEventListener("ended", () => resolve(), { once: true }),
  );
  const aborted = new Promise<void>((resolve) =>
    input.signal?.addEventListener("abort", () => resolve(), { once: true }),
  );
  await video.play();
  await Promise.race([ended, aborted]);
  running = false;
  video.pause();
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  if (input.signal?.aborted) throw new DOMException("Avbrutet", "AbortError");
  input.onProgress(1);
  return { video: new Blob(chunks, { type: mime.split(";")[0] }), frame, mime };
}
