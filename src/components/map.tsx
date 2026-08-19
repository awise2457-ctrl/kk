import { useEffect, useRef, useState } from "react";
import type * as ML from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Plot } from "../lib/data";
import { PLOT_STATUS } from "./ui";

const STATUS_COLORS: [string, string][] = Object.entries(PLOT_STATUS).map(([k, v]) => [k, v.fill]);

/** Property-location layer: plot polygons colored by status, click-to-select.
    MapLibre GL is loaded dynamically so a WebGL/worker failure can never take
    down the page — it falls back to a pure-SVG plan view. */
export function PlotMap({
  plots, center, zoom = 15.4, selectedId, onSelect, height = 420, interactive = true,
}: {
  plots: Plot[];
  center: [number, number];
  zoom?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  interactive?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ML.Map | null>(null);
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const [glFailed, setGlFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (glFailed) return;
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !el.current || mapRef.current) return;
        const map = new ml.Map({
          container: el.current,
          center,
          zoom,
          attributionControl: { compact: true },
          style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors · indicated layout, not a cadastral survey",
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          },
        });
        mapRef.current = map;
        map.on("error", () => { /* tile/network errors are non-fatal */ });
        map.on("load", () => {
          try {
            map.addSource("plots", { type: "geojson", data: fc([]) });
            map.addLayer({
              id: "plots-fill", type: "fill", source: "plots",
              paint: {
                "fill-color": ["match", ["get", "status"], ...STATUS_COLORS.flat(), "#5c6b62"] as never,
                "fill-opacity": ["case", ["boolean", ["get", "selected"], false], 0.85, 0.45] as never,
              },
            });
            map.addLayer({
              id: "plots-line", type: "line", source: "plots",
              paint: {
                "line-color": ["match", ["get", "status"], ...STATUS_COLORS.flat(), "#5c6b62"] as never,
                "line-width": ["case", ["boolean", ["get", "selected"], false], 3, 1.4] as never,
              },
            });
            if (interactive) {
              map.on("click", "plots-fill", (e: ML.MapLayerMouseEvent) => {
                const id = e.features?.[0]?.properties?.id as string | undefined;
                if (id) cbRef.current?.(id);
              });
              map.on("mouseenter", "plots-fill", () => { map.getCanvas().style.cursor = "pointer"; });
              map.on("mouseleave", "plots-fill", () => { map.getCanvas().style.cursor = ""; });
            }
          } catch { /* layer setup failed — base map still visible */ }
        });
        ro = new ResizeObserver(() => { try { map.resize(); } catch { /* noop */ } });
        ro.observe(el.current!);
        setReady(true);
      } catch {
        // WebGL/worker unavailable (sandboxed iframe, headless) — plan view takes over
        if (!cancelled) {
          try { mapRef.current?.remove(); } catch { /* noop */ }
          mapRef.current = null;
          setGlFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      try { mapRef.current?.remove(); } catch { /* noop */ }
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glFailed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || glFailed) return;
    const apply = () => {
      const src = map.getSource("plots") as ML.GeoJSONSource | undefined;
      src?.setData(fc(plots, selectedId));
    };
    if (map.isStyleLoaded()) apply();
    else map.on("load", apply);
  }, [plots, selectedId, glFailed, ready]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line shadow-sm" style={{ height }}>
      {glFailed ? (
        <PlanView plots={plots} selectedId={selectedId} onSelect={interactive ? onSelect : undefined} />
      ) : (
        <div ref={el} className="absolute inset-0" />
      )}
      {!glFailed && !ready && (
        <div className="absolute inset-0 grid place-items-center bg-[#e6ece4]">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-moss-500">
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-pine-700" />
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-pine-700" />
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-pine-700" />
            Loading map
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-line bg-card/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-moss-500 backdrop-blur">
        Indicated layout · not cadastral{glFailed && " · plan view"}
      </div>
    </div>
  );
}

/** SVG plan-view fallback: linearly projects the same plot polygons. */
function PlanView({ plots, selectedId, onSelect }: { plots: Plot[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  if (!plots.length) return <div className="absolute inset-0 grid place-items-center bg-pine-50 text-sm text-moss-500">No plots in this layout</div>;
  const xs = plots.flatMap((p) => p.polygon.map((c) => c[0]));
  const ys = plots.flatMap((p) => p.polygon.map((c) => c[1]));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const padX = (maxX - minX) * 0.06 || 0.001, padY = (maxY - minY) * 0.06 || 0.001;
  const W = 1000, H = 620;
  const px = (x: number) => ((x - minX + padX) / (maxX - minX + 2 * padX)) * W;
  const py = (y: number) => H - ((y - minY + padY) / (maxY - minY + 2 * padY)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full bg-[#e6ece4]">
      <defs>
        <pattern id="planGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#14532d" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#planGrid)" />
      {plots.map((p) => {
        const sel = p.id === selectedId;
        const pts = p.polygon.map(([x, y]) => `${px(x)},${py(y)}`).join(" ");
        const cx = px((p.polygon[0][0] + p.polygon[2][0]) / 2);
        const cy = py((p.polygon[0][1] + p.polygon[2][1]) / 2);
        return (
          <g key={p.id} onClick={() => onSelect?.(p.id)} className={onSelect ? "cursor-pointer" : undefined}>
            <polygon points={pts} fill={PLOT_STATUS[p.status]?.fill ?? "#5c6b62"} fillOpacity={sel ? 0.92 : 0.55}
              stroke="#0d1b15" strokeOpacity={sel ? 1 : 0.35} strokeWidth={sel ? 2.4 : 1}
              style={{ transition: "fill-opacity 0.15s" }} />
            {sel && <text x={cx} y={cy + 4} textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="IBM Plex Mono, monospace" fill="#fdf5e4">{p.number}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function fc(plots: Plot[], selectedId?: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: plots.map((p) => ({
      type: "Feature" as const,
      properties: { id: p.id, number: p.number, status: p.status, selected: p.id === selectedId },
      geometry: { type: "Polygon" as const, coordinates: [p.polygon] },
    })),
  };
}

export function PlotLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {Object.entries(PLOT_STATUS).filter(([k]) => k !== "cancelled").map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-xs font-medium text-moss-500">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: v.fill }} />
          {v.label}
        </span>
      ))}
    </div>
  );
}
