/**
 * Posemodellen i webbläsaren: MediaPipe Pose Landmarker (Apache 2.0).
 *
 * Modellen körs i coachens webbläsare; videon lämnar aldrig datorn. Den körs
 * bild för bild utan spårning mellan bilderna, eftersom videoläget jämnar ut
 * punkterna över tid – och nedre dödläget ska läsas ur ojämnade värden.
 * Punkterna kommer normerade (0–1) och räknas om till pixlar innan mätkedjan
 * får dem, så att vinklarna inte förvrängs av bildens format.
 */

import { JOINTS, type Joint, type PoseFrame, type SideJoints } from "./chain";
import { toPixels } from "./geometry";

/** Versionen vars wasm-filer scripts/copy-mediapipe.mjs lägger i public/. */
export const MEDIAPIPE_VERSION = "0.10.35";
export const POSE_MODEL = "MediaPipe Pose Landmarker full";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

/** BlazePose-punkterna för varje led, vänster och höger. */
const INDEX: Record<Joint, [left: number, right: number]> = {
  shoulder: [11, 12],
  elbow: [13, 14],
  wrist: [15, 16],
  hip: [23, 24],
  knee: [25, 26],
  ankle: [27, 28],
};

export type Landmark = { x: number; y: number; visibility?: number };

/** En persons punkter som en bild för mätkedjan, i pixlar. */
export function toPoseFrame(
  landmarks: Landmark[] | undefined,
  width: number,
  height: number,
): PoseFrame {
  if (!landmarks || landmarks.length < 29) return null;
  const side = (i: 0 | 1): SideJoints => {
    const out = {} as SideJoints;
    for (const joint of JOINTS) {
      const l = landmarks[INDEX[joint][i]];
      out[joint] = { ...toPixels(l, width, height), c: l.visibility ?? 0 };
    }
    return out;
  };
  return { left: side(0), right: side(1) };
}

export type PoseDetector = {
  name: string;
  detect(source: TexImageSource, width: number, height: number): PoseFrame;
  close(): void;
};

declare global {
  // Utvecklingskrok: ett test kan ersätta modellen med kända punkter.
  var __coachvyPoseDetector: (() => Promise<PoseDetector>) | undefined;
}

/** Laddar modellen; GPU när den finns, annars CPU. */
export async function createPoseDetector(): Promise<PoseDetector> {
  if (process.env.NODE_ENV !== "production" && globalThis.__coachvyPoseDetector)
    return globalThis.__coachvyPoseDetector();
  const { FilesetResolver, PoseLandmarker } =
    await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(
    `/mediapipe/${MEDIAPIPE_VERSION}`,
  );
  const create = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "IMAGE",
      numPoses: 1,
    });
  const landmarker = await create("GPU").catch(() => create("CPU"));
  return {
    name: POSE_MODEL,
    detect(source, width, height) {
      const result = landmarker.detect(source as HTMLVideoElement);
      return toPoseFrame(result.landmarks[0], width, height);
    },
    close: () => landmarker.close(),
  };
}
