/**
 * Videon bild för bild i webbläsaren: öppna filen, läs bildfrekvensen och kör
 * posemodellen på varje bild.
 *
 * Videon spelas upp i den takt modellen hinner med, och varje bild som visas
 * mäts. Bilder som ändå hoppades över hämtas sedan en och en, så att serien
 * till mätkedjan har en mätning per bild i filen. Bara för webbläsaren.
 */

import type { PoseFrame } from "./chain";
import { readVideoTrackInfo } from "./mp4";
import type { PoseDetector } from "./pose";

export type OpenedVideo = {
  video: HTMLVideoElement;
  url: string;
  width: number;
  height: number;
  durationS: number;
  fps: number;
  frames: number;
  /** Varifrån frekvensen kom: filens huvud eller uppmätt uppspelning. */
  fpsSource: "fil" | "uppspelning";
};

const once = (el: HTMLMediaElement, event: string) =>
  new Promise<void>((resolve, reject) => {
    const ok = () => {
      el.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      el.removeEventListener(event, ok);
      reject(new Error("Videon gick inte att läsa i webbläsaren."));
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener("error", fail, { once: true });
  });

/** Väntar på nästa bild som visas, med dess tid i filen. */
const nextFrame = (video: HTMLVideoElement) =>
  new Promise<number>((resolve) =>
    video.requestVideoFrameCallback((_, meta) => resolve(meta.mediaTime)),
  );

/** Bildfrekvensen ur uppspelningen, när filen inte är MP4/MOV. */
async function measureFps(video: HTMLVideoElement): Promise<number | null> {
  video.currentTime = 0;
  video.playbackRate = 1;
  await video.play();
  const times: number[] = [];
  const stop = performance.now() + 1500;
  while (times.length < 40 && performance.now() < stop)
    times.push(await nextFrame(video));
  video.pause();
  const deltas = times
    .slice(1)
    .map((t, i) => t - times[i])
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  if (deltas.length < 5) return null;
  // Den minsta vanliga skillnaden: uppspelningen kan hoppa över bilder,
  // men aldrig visa dem tätare än de spelades in.
  const shortest = deltas[Math.floor(deltas.length * 0.2)];
  return 1 / shortest;
}

export async function openVideo(file: File): Promise<OpenedVideo> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await once(video, "loadeddata");
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  if (!("requestVideoFrameCallback" in video)) {
    URL.revokeObjectURL(url);
    throw new Error(
      "Webbläsaren kan inte läsa videon bild för bild. Använd Chrome, Edge eller Safari.",
    );
  }
  const info = await readVideoTrackInfo(file).catch(() => null);
  let fps = info?.fps ?? null;
  let fpsSource: OpenedVideo["fpsSource"] = "fil";
  if (!fps) {
    fps = await measureFps(video);
    fpsSource = "uppspelning";
  }
  if (!fps || !Number.isFinite(fps)) {
    URL.revokeObjectURL(url);
    throw new Error("Bildfrekvensen gick inte att läsa ur filen.");
  }
  const durationS = info?.durationS ?? video.duration;
  return {
    video,
    url,
    width: video.videoWidth,
    height: video.videoHeight,
    durationS,
    fps,
    frames: info?.frames ?? Math.round(durationS * fps),
    fpsSource,
  };
}

const seek = async (video: HTMLVideoElement, t: number) => {
  const done = once(video, "seeked");
  video.currentTime = t;
  await done;
};

/**
 * Posen i varje bild. `onProgress` får andelen klar (0–1). Kan avbrytas.
 */
export async function detectAllFrames(
  opened: OpenedVideo,
  detector: PoseDetector,
  onProgress: (share: number) => void,
  signal?: AbortSignal,
): Promise<PoseFrame[]> {
  const { video, fps, frames: n, width, height } = opened;
  const frames: (PoseFrame | undefined)[] = new Array(n).fill(undefined);
  let done = 0;
  const measure = (i: number) => {
    if (i < 0 || i >= n || frames[i] !== undefined) return;
    frames[i] = detector.detect(video, width, height);
    done++;
  };

  // Första passet: uppspelning i den takt modellen hinner.
  await seek(video, 0);
  video.playbackRate = 0.25;
  const ended = once(video, "ended").catch(() => undefined);
  let finished = false;
  void ended.then(() => (finished = true));
  await video.play();
  let spent = 0;
  let counted = 0;
  while (!finished && !signal?.aborted) {
    const t = await Promise.race([nextFrame(video), ended.then(() => null)]);
    if (t === null) break;
    const start = performance.now();
    measure(Math.round(t * fps));
    spent += performance.now() - start;
    counted++;
    // Takten efter modellens tid per bild, med marginal.
    if (counted === 8 || counted % 60 === 0) {
      const perFrame = spent / counted / 1000;
      video.playbackRate = Math.min(1, Math.max(0.0625, 0.7 / fps / perFrame));
    }
    onProgress((done / n) * 0.9);
  }
  video.pause();
  if (signal?.aborted) throw new DOMException("Avbrutet", "AbortError");

  // Andra passet: bilderna som hoppades över, en och en.
  const missing = frames.flatMap((f, i) => (f === undefined ? [i] : []));
  for (const [k, i] of missing.entries()) {
    if (signal?.aborted) throw new DOMException("Avbrutet", "AbortError");
    await seek(video, Math.min((i + 0.5) / fps, opened.durationS - 1e-3));
    measure(i);
    if (k % 10 === 0) onProgress(0.9 * (done / n) + 0.1 * (k / missing.length));
  }
  onProgress(1);
  return frames.map((f) => f ?? null);
}
