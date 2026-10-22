/**
 * Analysvideons overlay: det som ritas ovanpå varje bild.
 *
 * Rubrik och hörnram, skelettet på den uppmätta sidan i två drag (mörk kant,
 * färg efter omdömet), knävinkeln live som en båge, rutor med vinklarna,
 * mätkvaliteten, knäkurvan över hela klippet med målband, nedre dödlägen och
 * spelhuvud, och resultatet längst ned. Färgen följer exakt samma gränser som
 * texten i rapporten – inget färgas för effekt, och ett värde som inte gick
 * att mäta står som "inte mätbart". Bara för webbläsaren (canvas).
 */

import {
  MIN_CONF,
  type BodySide,
  type ClipAnalysis,
  type Joint,
  type PoseFrame,
} from "./chain";
import { flexion } from "./geometry";
import {
  verdictFor,
  type Assessed,
  type Assessment,
  type Verdict,
} from "./templates";

export type OverlayColors = Record<Verdict, string> & {
  /** Linjer och text utan omdöme. */
  neutral: string;
  /** Rutornas och stapelns botten. */
  panel: string;
  muted: string;
};

export type OverlayInput = {
  /** Videons yta på duken; rutorna och kurvan ligger utanför den. */
  width: number;
  height: number;
  /** Från filens pixlar till dukens. */
  k: number;
  index: number;
  frame: PoseFrame;
  analysis: ClipAnalysis;
  assessment: Assessment;
  title: string;
  colors: OverlayColors;
  font: string;
};

/** Skalan för text och linjer: 1 vid 1080 pixlar på videons kortsida. */
const scaleOf = (w: number, h: number) => Math.min(w, h) / 1080;

/**
 * Dukens storlek: videon, en kolumn med rutor till höger och en remsa med
 * kurvan och resultatet under – så att inget täcker cyklisten.
 */
export function overlayCanvasSize(width: number, height: number) {
  const s = scaleOf(width, height);
  return {
    width: Math.round(width + 300 * s),
    height: Math.round(height + 300 * s),
  };
}
const sv = (v: number, d = 1) =>
  v.toFixed(d).replace(".", ",").replace("-", "−");

/** Typsnittet appen själv använder, annars systemets. */
export function overlayFont(): string {
  const family = getComputedStyle(document.body).fontFamily;
  const candidates = [family, "Geist", "Inter", "system-ui", "sans-serif"];
  for (const f of candidates)
    if (f && document.fonts.check(`16px ${f}`)) return f;
  return "sans-serif";
}

/** Färgerna ur designsystemets tokens. */
export function overlayColors(): OverlayColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    grön: v("--good", "#4cb782"),
    gul: v("--warn", "#e2b340"),
    röd: v("--bad", "#eb6b5f"),
    neutral: "#f4f4f5",
    panel: "#1a1a1d",
    muted: "rgba(244, 244, 245, 0.66)",
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawOverlay(ctx: CanvasRenderingContext2D, o: OverlayInput) {
  const { width: w, height: h, colors: col, font, analysis: an } = o;
  const s = scaleOf(w, h);
  const W = w + 300 * s;
  const H = h + 300 * s;
  const m = 36 * s;
  const px = (n: number) => `${Math.round(n * s)}px`;
  const tone = (a: Assessed) => (a.verdict ? col[a.verdict] : col.neutral);
  ctx.save();
  ctx.textBaseline = "alphabetic";

  // Hörnram.
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3 * s;
  const L = 56 * s;
  for (const [x, y, dx, dy] of [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
    ctx.stroke();
  }

  // Rubrik, på en mörk platta så att den syns mot ljusa bakgrunder.
  roundRect(ctx, m + 10 * s, m + 10 * s, 600 * s, 150 * s, 14 * s);
  ctx.fillStyle = "rgba(12, 12, 14, 0.62)";
  ctx.fill();
  const hx = m + 24 * s;
  let hy = m + 64 * s;
  ctx.fillStyle = col.neutral;
  ctx.font = `700 ${px(46)} ${font}`;
  ctx.letterSpacing = px(6);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8 * s;
  ctx.fillText("BIKEFIT", hx, hy);
  ctx.letterSpacing = "0px";
  ctx.font = `500 ${px(24)} ${font}`;
  ctx.fillStyle = col.muted;
  hy += 34 * s;
  ctx.fillText(o.title, hx, hy);
  ctx.shadowBlur = 0;

  // Mätkvaliteten i den här bilden.
  const q = an.series.quality[o.index] ?? null;
  hy += 24 * s;
  const qw = 220 * s;
  const qh = 10 * s;
  roundRect(ctx, hx, hy, qw, qh, qh / 2);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fill();
  if (q !== null) {
    roundRect(ctx, hx, hy, Math.max(qh, qw * q), qh, qh / 2);
    ctx.fillStyle = q < MIN_CONF ? col.gul : col.neutral;
    ctx.fill();
  }
  ctx.font = `500 ${px(18)} ${font}`;
  ctx.fillStyle = col.muted;
  ctx.fillText(
    q === null
      ? "mätkvalitet: ingen person hittad"
      : `mätkvalitet ${Math.round(q * 100)} %${q < MIN_CONF ? " – för låg, bilden räknas inte" : ""}`,
    hx + qw + 12 * s,
    hy + qh,
  );

  // Skelettet på den uppmätta sidan.
  const side: BodySide | null = an.side;
  const raw = o.frame && side ? o.frame[side] : null;
  const joints = raw
    ? (Object.fromEntries(
        Object.entries(raw).map(([j, p]) => [
          j,
          { x: p.x * o.k, y: p.y * o.k, c: p.c },
        ]),
      ) as typeof raw)
    : null;
  const a = o.assessment;
  if (joints) {
    const seen = (j: Joint) => joints[j].c >= MIN_CONF;
    const bones: [Joint, Joint, Assessed][] = [
      ["shoulder", "elbow", a.elbow],
      ["elbow", "wrist", a.elbow],
      ["shoulder", "hip", a.trunk],
      ["hip", "knee", a.knee],
      ["knee", "ankle", a.knee],
    ];
    ctx.lineCap = "round";
    for (const pass of [0, 1])
      for (const [p, q2, assessed] of bones) {
        if (!seen(p) || !seen(q2)) continue;
        ctx.strokeStyle = pass === 0 ? "rgba(0,0,0,0.65)" : tone(assessed);
        ctx.lineWidth = (pass === 0 ? 12 : 6) * s;
        ctx.beginPath();
        ctx.moveTo(joints[p].x, joints[p].y);
        ctx.lineTo(joints[q2].x, joints[q2].y);
        ctx.stroke();
      }
    for (const j of [
      "shoulder",
      "elbow",
      "wrist",
      "hip",
      "knee",
      "ankle",
    ] as Joint[]) {
      if (!seen(j)) continue;
      ctx.beginPath();
      ctx.arc(joints[j].x, joints[j].y, 7 * s, 0, 2 * Math.PI);
      ctx.fillStyle = col.neutral;
      ctx.fill();
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.stroke();
    }

    // Knävinkeln live: bågen mellan lår och underben.
    if (seen("hip") && seen("knee") && seen("ankle")) {
      const k = joints.knee;
      const toHip = Math.atan2(joints.hip.y - k.y, joints.hip.x - k.x);
      const toAnkle = Math.atan2(joints.ankle.y - k.y, joints.ankle.x - k.x);
      let sweep = toAnkle - toHip;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;
      const r = 54 * s;
      ctx.beginPath();
      ctx.moveTo(k.x, k.y);
      ctx.arc(k.x, k.y, r, toHip, toHip + sweep, sweep < 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(k.x, k.y, r, toHip, toHip + sweep, sweep < 0);
      ctx.strokeStyle = col.neutral;
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      const live = flexion(joints.hip, k, joints.ankle);
      const mid = toHip + sweep / 2 + Math.PI;
      const tx = k.x + Math.cos(mid) * (r + 26 * s);
      const ty = k.y + Math.sin(mid) * (r + 26 * s);
      ctx.font = `700 ${px(28)} ${font}`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6 * s;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(`${sv(live, 0)}°`, tx, ty + 10 * s);
      ctx.fillStyle = col.neutral;
      ctx.fillText(`${sv(live, 0)}°`, tx, ty + 10 * s);
      ctx.textAlign = "left";
    }
  }

  // Rutor med vinklarna, högerkanten.
  const tiles: [string, Assessed][] = [
    ["Knä i nedre dödläget", a.knee],
    ["Bål mot vågrätt", a.trunk],
    ["Armbåge", a.elbow],
    ["Axel", a.shoulder],
    ["Höft vid nedre dödläget", a.hip],
  ];
  ctx.fillStyle = "#0c0c0e";
  ctx.fillRect(w, 0, W - w, H);
  ctx.fillRect(0, h, w, H - h);
  const tw = 300 * s - 2 * 20 * s;
  const th = 104 * s;
  const tx0 = w + 20 * s;
  let ty0 = 20 * s;
  for (const [label, item] of tiles) {
    roundRect(ctx, tx0, ty0, tw, th, 14 * s);
    ctx.fillStyle = col.panel;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = item.verdict ? tone(item) : "rgba(255,255,255,0.18)";
    ctx.stroke();
    ctx.font = `500 ${px(17)} ${font}`;
    ctx.fillStyle = col.muted;
    ctx.fillText(label, tx0 + 16 * s, ty0 + 28 * s);
    ctx.font = `700 ${px(36)} ${font}`;
    ctx.fillStyle = col.neutral;
    ctx.fillText(
      item.value === null ? "–" : `${sv(item.value)}°`,
      tx0 + 16 * s,
      ty0 + 68 * s,
    );
    ctx.font = `600 ${px(17)} ${font}`;
    ctx.fillStyle = item.verdict ? tone(item) : col.muted;
    ctx.fillText(item.label, tx0 + 16 * s, ty0 + 92 * s);
    ty0 += th + 12 * s;
  }

  // Resultatet längst ned.
  const rb = 64 * s;
  const ry = H - 20 * s - rb;
  const rx = 20 * s;
  const rw = W - 40 * s;
  roundRect(ctx, rx, ry, rw, rb, 14 * s);
  ctx.fillStyle = col.panel;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rx + 30 * s, ry + rb / 2, 9 * s, 0, 2 * Math.PI);
  ctx.fillStyle = tone(a.knee);
  ctx.fill();
  ctx.font = `700 ${px(26)} ${font}`;
  ctx.fillStyle = col.neutral;
  const headline = a.sentence.split(":")[0];
  ctx.fillText(headline, rx + 52 * s, ry + rb / 2 + 9 * s, rw - 70 * s);

  // Knäkurvan över hela klippet.
  const ch = 300 * s - 3 * 20 * s - rb;
  const cy = h + 20 * s;
  roundRect(ctx, rx, cy, rw, ch, 14 * s);
  ctx.fillStyle = col.panel;
  ctx.fill();
  const knee = an.series.knee;
  const band = a.knee.band;
  const present = knee.filter((v): v is number => v !== null);
  if (present.length > 1) {
    let lo = Math.min(...present, band?.min ?? Infinity) - 4;
    let hi = Math.max(...present, band?.max ?? -Infinity) + 4;
    if (hi - lo < 20) {
      const c = (hi + lo) / 2;
      lo = c - 10;
      hi = c + 10;
    }
    const pad = 16 * s;
    const gx = rx + 56 * s;
    const gw = rw - 56 * s - pad;
    const gy = cy + pad;
    const gh = ch - 2 * pad;
    const X = (i: number) => gx + (i / Math.max(1, knee.length - 1)) * gw;
    const Y = (v: number) => gy + (1 - (v - lo) / (hi - lo)) * gh;
    ctx.font = `500 ${px(15)} ${font}`;
    ctx.fillStyle = col.muted;
    ctx.fillText("Knä", rx + 14 * s, cy + 30 * s);
    if (band) {
      ctx.fillStyle = col.grön;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(gx, Y(band.max), gw, Y(band.min) - Y(band.max));
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.muted;
      ctx.fillText(
        `${band.min}–${band.max}°`,
        rx + 14 * s,
        (Y(band.max) + Y(band.min)) / 2 + 5 * s,
      );
    }
    // Trampande bilder heldragna, resten svagare.
    ctx.lineWidth = 2.5 * s;
    ctx.lineJoin = "round";
    for (const pedalling of [false, true]) {
      ctx.strokeStyle = pedalling ? col.neutral : "rgba(255,255,255,0.3)";
      ctx.beginPath();
      let open = false;
      knee.forEach((v, i) => {
        if (v === null || an.pedalling[i] !== pedalling) {
          open = false;
          return;
        }
        if (!open) ctx.moveTo(X(i), Y(v));
        else ctx.lineTo(X(i), Y(v));
        open = true;
      });
      ctx.stroke();
    }
    for (const b of an.bdc) {
      ctx.beginPath();
      ctx.arc(X(b.at), Y(b.flex), 5 * s, 0, 2 * Math.PI);
      ctx.fillStyle = band ? col[verdictFor(b.flex, band)] : col.neutral;
      ctx.fill();
      ctx.lineWidth = 1.5 * s;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.stroke();
    }
    ctx.strokeStyle = col.neutral;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(X(o.index), gy);
    ctx.lineTo(X(o.index), gy + gh);
    ctx.stroke();
  } else {
    ctx.font = `500 ${px(20)} ${font}`;
    ctx.fillStyle = col.muted;
    ctx.fillText(
      "Knävinkeln gick inte att mäta i klippet.",
      rx + 20 * s,
      cy + ch / 2,
    );
  }
  ctx.restore();
}
