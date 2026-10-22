"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  analyseClip,
  type ClipAnalysis,
  type PoseFrame,
} from "@/lib/bikefit/chain";
import { summariseAnalysis } from "@/lib/bikefit/fit";
import { createPoseDetector, type PoseDetector } from "@/lib/bikefit/pose";
import { recordingCheck, type RecordingCheck } from "@/lib/bikefit/recording";
import { renderAnalysis, type RenderedMedia } from "@/lib/bikefit/render";
import type { Assessment } from "@/lib/bikefit/templates";
import {
  detectAllFrames,
  openVideo,
  type OpenedVideo,
} from "@/lib/bikefit/video-frames";
import type { VideoPanelProps, VideoResult } from "./fit-form";

type Stage =
  | { kind: "tom" }
  | { kind: "öppnar" }
  | { kind: "vald"; check: RecordingCheck }
  | { kind: "laddar" }
  | { kind: "mäter"; share: number }
  | { kind: "spelar in"; share: number }
  | { kind: "klar" }
  | { kind: "fel"; message: string };

const sv = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const keyOf = (a: Assessment) => JSON.stringify(a);

/**
 * Videoanalysen i formuläret: välj en sidovideo, se om den duger, låt
 * posemodellen hitta lederna bild för bild i webbläsaren och få vinklarna,
 * analysvideon och bilden från nedre dödläget.
 */
export function VideoPanel({
  onResult,
  assessment,
  crankMm,
  title,
}: VideoPanelProps) {
  const [stage, setStage] = useState<Stage>({ kind: "tom" });
  const [analysis, setAnalysis] = useState<ClipAnalysis | null>(null);
  const [preview, setPreview] = useState<{ url: string; key: string } | null>(
    null,
  );
  const opened = useRef<OpenedVideo | null>(null);
  const frames = useRef<PoseFrame[] | null>(null);
  const detector = useRef<PoseDetector | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cache = useRef<{ key: string; media: Promise<RenderedMedia> } | null>(
    null,
  );
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  // Det som visas om den öppnade videon; ref:en ovan är för arbetet.
  const [info, setInfo] = useState<Pick<
    OpenedVideo,
    "fps" | "fpsSource"
  > | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      detector.current?.close();
      if (opened.current) URL.revokeObjectURL(opened.current.url);
    },
    [],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  /** Analysvideon för en bedömning, inspelad en gång per bedömning. */
  const media = (a: Assessment): Promise<RenderedMedia> => {
    const key = keyOf(a);
    if (cache.current?.key === key) return cache.current.media;
    const video = opened.current;
    const fs = frames.current;
    if (!video || !fs || !analysis)
      return Promise.reject(new Error("Videon är inte analyserad."));
    abort.current = new AbortController();
    setStage({ kind: "spelar in", share: 0 });
    const job = renderAnalysis({
      opened: video,
      frames: fs,
      analysis,
      assessment: a,
      title: titleRef.current,
      onProgress: (share) => setStage({ kind: "spelar in", share }),
      signal: abort.current.signal,
    }).then(
      (m) => {
        setStage({ kind: "klar" });
        if (m.video) setPreview({ url: URL.createObjectURL(m.video), key });
        return m;
      },
      (e) => {
        cache.current = null;
        setStage({
          kind: "fel",
          message:
            e instanceof DOMException && e.name === "AbortError"
              ? "Inspelningen avbröts."
              : `Analysvideon gick inte att spela in: ${e instanceof Error ? e.message : e}`,
        });
        throw e;
      },
    );
    cache.current = { key, media: job };
    return job;
  };
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  });

  // Spela in en gång när vinklarna kommit fram i formulärets bedömning.
  const recorded = useRef(false);
  useEffect(() => {
    if (!analysis || recorded.current) return;
    recorded.current = true;
    mediaRef.current(assessment).catch(() => undefined);
  }, [analysis, assessment]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    abort.current?.abort();
    if (opened.current) URL.revokeObjectURL(opened.current.url);
    opened.current = null;
    setInfo(null);
    frames.current = null;
    cache.current = null;
    recorded.current = false;
    setAnalysis(null);
    setPreview(null);
    onResult(null);
    setStage({ kind: "öppnar" });
    try {
      const v = await openVideo(file);
      opened.current = v;
      setInfo({ fps: v.fps, fpsSource: v.fpsSource });
      setStage({
        kind: "vald",
        check: recordingCheck({
          durationS: v.durationS,
          fps: v.fps,
          width: v.width,
          height: v.height,
        }),
      });
    } catch (e) {
      setStage({
        kind: "fel",
        message: e instanceof Error ? e.message : "Videon gick inte att öppna.",
      });
    }
  };

  const analyse = async () => {
    const v = opened.current;
    if (!v) return;
    abort.current = new AbortController();
    try {
      setStage({ kind: "laddar" });
      detector.current ??= await createPoseDetector();
      setStage({ kind: "mäter", share: 0 });
      const fs = await detectAllFrames(
        v,
        detector.current,
        (share) => setStage({ kind: "mäter", share }),
        abort.current.signal,
      );
      frames.current = fs;
      const a = analyseClip(fs, v.fps, { crankMm: crankMm ?? undefined });
      const result: VideoResult = {
        angles: {
          knee: a.kneeFlexBdc,
          trunk: a.trunk,
          elbow: a.elbow,
          shoulder: a.shoulder,
          hip: a.hip,
        },
        legs: { thighMm: a.scale.thighMm, shankMm: a.scale.shankMm },
        analysis: summariseAnalysis(a, detector.current.name),
        media: (x) => mediaRef.current(x),
      };
      setAnalysis(a);
      onResult(result);
    } catch (e) {
      setStage({
        kind: "fel",
        message:
          e instanceof DOMException && e.name === "AbortError"
            ? "Analysen avbröts."
            : `Analysen gick inte att göra: ${e instanceof Error ? e.message : e}`,
      });
    }
  };

  const busy =
    stage.kind === "öppnar" ||
    stage.kind === "laddar" ||
    stage.kind === "mäter" ||
    stage.kind === "spelar in";
  const stale =
    analysis !== null &&
    stage.kind === "klar" &&
    preview !== null &&
    preview.key !== keyOf(assessment);

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13px] leading-relaxed text-text-muted">
        Filma från sidan med mobilen i höjd med vevpartiet och hela cyklisten i
        bild, 15–30 sekunder jämnt trampande på trainern – 60 bilder per sekund
        om mobilen kan. Videon analyseras här i webbläsaren; originalet laddas
        aldrig upp. Det som sparas är analysvideon och bilden från nedre
        dödläget.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex h-9 cursor-pointer items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2 ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {info ? "Välj en annan video" : "Välj video"}
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {stage.kind === "vald" && (
          <Button type="button" onClick={analyse} disabled={!stage.check.ok}>
            Analysera
          </Button>
        )}
        {busy && stage.kind !== "öppnar" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => abort.current?.abort()}
          >
            Avbryt
          </Button>
        )}
      </div>

      <div aria-live="polite" className="space-y-3">
        {stage.kind === "öppnar" && (
          <p className="text-[13px] text-text-muted">Öppnar videon …</p>
        )}
        {stage.kind === "vald" && (
          <p
            className={`text-[13px] ${stage.check.ok ? "text-text" : "text-bad"}`}
          >
            {stage.check.sentence}
          </p>
        )}
        {stage.kind === "laddar" && (
          <p className="text-[13px] text-text-muted">Laddar posemodellen …</p>
        )}
        {(stage.kind === "mäter" || stage.kind === "spelar in") && (
          <div className="max-w-md">
            <p className="text-[13px] text-text-muted">
              {stage.kind === "mäter"
                ? "Hittar lederna bild för bild …"
                : "Spelar in analysvideon – tar lika lång tid som klippet …"}{" "}
              <span className="tabular-nums">
                {Math.round(stage.share * 100)} %
              </span>
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(stage.share * 100)}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
            >
              <div
                className="h-full bg-text transition-[width]"
                style={{ width: `${stage.share * 100}%` }}
              />
            </div>
          </div>
        )}
        {stage.kind === "fel" && (
          <p role="alert" className="text-[13px] text-bad">
            {stage.message}
          </p>
        )}

        {analysis && (
          <div className="space-y-2 text-[13px]">
            <p className="text-text">
              {analysis.kneeFlexBdc === null
                ? "Knäböjningen gick inte att mäta i klippet."
                : `Knäböjning ${sv(analysis.kneeFlexBdc)}° i nedre dödläget – medianen av ${analysis.bdc.length} varv${analysis.kneeSpread !== null ? `, spridning ${sv(analysis.kneeSpread)}°` : ""}.`}{" "}
              {analysis.cadenceRpm !== null &&
                `Kadens ${sv(analysis.cadenceRpm, 0)} rpm, `}
              {analysis.side === null
                ? "ingen sida gick att mäta."
                : `${analysis.side === "left" ? "vänster" : "höger"} sida mätt, ${sv(info?.fps ?? 0, 0)} bilder/s ur ${info?.fpsSource === "fil" ? "filen" : "uppspelningen"}.`}
            </p>
            {analysis.check.problems.length > 0 && (
              <ul className="space-y-1 text-text">
                {analysis.check.problems.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {preview && (
          <video
            src={preview.url}
            controls
            playsInline
            muted
            className="max-h-[60vh] w-full rounded-md bg-black"
          />
        )}
        {stale && (
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
            Bedömningen har ändrats sedan analysvideon spelades in; den spelas
            in igen när fiten sparas.
            <Button
              type="button"
              variant="secondary"
              onClick={() => media(assessment).catch(() => undefined)}
            >
              Spela in nu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
