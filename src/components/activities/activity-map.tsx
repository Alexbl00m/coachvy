"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type {
  CircleMarker,
  LatLngTuple,
  Map as LeafletMap,
  Polyline,
} from "leaflet";

import { SERIES } from "@/lib/calculators/chart-colors";
import type { Streams } from "@/lib/activities/analysis";
import type { HoverStore } from "./hover-store";

/**
 * Kartbrickorna. OpenStreetMaps egna servrar räcker för en coach med adepter,
 * men deras användarvillkor tillåter inte tung trafik – byt då till en
 * leverantör med nyckel via miljövariablerna, utan kodändring.
 */
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare';

/**
 * Rutten på karta, med en markör som följer pekaren i graferna och en
 * markerad sträcka för en vald insats.
 *
 * Leaflet laddas först i webbläsaren – det rör `window` redan vid import.
 */
export function ActivityMap({
  streams,
  hover,
  highlight,
}: {
  streams: Streams;
  hover: HoverStore;
  /** Index i serien, från och till, för den valda insatsen. */
  highlight: [number, number] | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const segment = useRef<Polyline[]>([]);
  const routeLine = useRef<Polyline | null>(null);
  const points = useRef<(LatLngTuple | null)[]>([]);
  const leaflet = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    void import("leaflet").then((L) => {
      if (cancelled || !box.current) return;
      leaflet.current = L;
      const pts = streams.lat.map((lat, i) => {
        const lon = streams.lon[i];
        return lat !== null && lon !== null
          ? ([lat, lon] as LatLngTuple)
          : null;
      });
      points.current = pts;
      const route = pts.filter((p): p is LatLngTuple => p !== null);
      if (route.length < 2) return;

      const m = L.map(box.current, {
        preferCanvas: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      map.current = m;
      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 18,
      }).addTo(m);

      // Ytan under linjen, så att rutten syns mot både skog och stad.
      L.polyline(route, { color: "#121216", weight: 6, opacity: 0.55 }).addTo(
        m,
      );
      routeLine.current = L.polyline(route, {
        color: SERIES.primary,
        weight: 3.5,
        opacity: 1,
      }).addTo(m);
      const end = (at: LatLngTuple, fill: string, label: string) =>
        L.circleMarker(at, {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: fill,
          fillOpacity: 1,
        })
          .bindTooltip(label, { direction: "top", offset: [0, -6] })
          .addTo(m);
      end(route[0], "#5cb87a", "Start");
      end(route[route.length - 1], "#e7e7ec", "Mål");
      m.fitBounds(L.latLngBounds(route), { padding: [24, 24] });

      marker.current = L.circleMarker(route[0], {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: SERIES.primary,
        fillOpacity: 0,
        opacity: 0,
      }).addTo(m);

      unsubscribe = hover.subscribe(() => {
        const i = hover.get();
        const p = i !== null ? points.current[i] : null;
        if (!marker.current) return;
        if (p) {
          marker.current.setLatLng(p);
          marker.current.setStyle({ opacity: 1, fillOpacity: 1 });
        } else {
          marker.current.setStyle({ opacity: 0, fillOpacity: 0 });
        }
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
      map.current?.remove();
      map.current = null;
    };
  }, [streams, hover]);

  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    segment.current.forEach((line) => line.remove());
    segment.current = [];
    // Resten av rutten tonas ned medan en insats är vald.
    routeLine.current?.setStyle({ opacity: highlight ? 0.35 : 1 });
    if (!L || !m || !highlight) return;
    const part = points.current
      .slice(highlight[0], highlight[1] + 1)
      .filter((p): p is LatLngTuple => p !== null);
    if (part.length < 2) return;
    segment.current = [
      L.polyline(part, { color: "#ffffff", weight: 8, opacity: 0.9 }).addTo(m),
      L.polyline(part, { color: SERIES.primary, weight: 4, opacity: 1 }).addTo(
        m,
      ),
    ];
    m.fitBounds(L.latLngBounds(part), { padding: [48, 48], maxZoom: 14 });
  }, [highlight]);

  return (
    <div
      ref={box}
      role="img"
      aria-label="Karta över rutten"
      className="activity-map h-[340px] w-full overflow-hidden rounded-lg border border-line bg-surface-2 sm:h-[420px]"
    />
  );
}
