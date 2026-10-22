"use client";

import { attachFitMedia } from "@/lib/bikefit/actions";
import { fitPath } from "@/lib/bikefit/fit";
import { BUCKET } from "@/lib/bikefit/storage";
import { createClient } from "@/lib/supabase/client";
import type { BikeFitRow } from "@/lib/types/database";
import { FitForm, type VideoResult } from "./fit-form";
import { VideoPanel } from "./video-panel";
import type { Assessment } from "@/lib/bikefit/templates";

/**
 * En ny fit: formuläret med videoanalysen. När fiten sparats laddas
 * analysvideon och bilden från nedre dödläget upp i fitens mapp.
 */
export function NewFit({
  adeptId,
  today,
  previous,
}: {
  adeptId: string;
  today: string;
  previous: BikeFitRow | null;
}) {
  const upload = async (
    fitId: string,
    video: VideoResult | null,
    assessment: Assessment,
  ): Promise<string | null> => {
    if (!video) return null;
    let media;
    try {
      media = await video.media(assessment);
    } catch {
      return "analysvideon gick inte att spela in.";
    }
    const supabase = createClient();
    const ext = media.mime?.startsWith("video/mp4") ? "mp4" : "webm";
    const videoPath = media.video
      ? fitPath(adeptId, fitId, `analys.${ext}`)
      : null;
    const framePath = fitPath(adeptId, fitId, "nedre-dodlaget.jpg");
    const put = (path: string, blob: Blob, type: string) =>
      supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: type, upsert: true });
    const results = await Promise.all([
      put(framePath, media.frame, "image/jpeg"),
      videoPath && media.video
        ? put(videoPath, media.video, `video/${ext}`)
        : Promise.resolve({ error: null }),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error)
      return `filerna kunde inte laddas upp (${failed.error.message}).`;
    const attached = await attachFitMedia({
      fitId,
      adeptId,
      videoPath,
      framePath,
    });
    return attached.ok ? null : attached.error;
  };

  return (
    <FitForm
      adeptId={adeptId}
      today={today}
      previous={previous}
      videoPanel={(props) => <VideoPanel {...props} />}
      onSaved={upload}
    />
  );
}
