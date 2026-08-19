import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Plot } from "../lib/data";
import { PLOT_STATUS } from "./ui";

const STATUS_COLORS: [string, string][] = Object.entries(PLOT_STATUS).map(([k, v]) => [k, v.fill]);

/** Property-location layer: plot polygons colored by status, click-to-select.
    Tile/geocoder providers sit behind this single component (GIS adapter seam). */
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = new maplibregl.Map({
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

    map.on("load", () => {
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
        map.on("click", "plots-fill", (e: maplibregl.MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) cbRef.current?.(id);
        });
        map.on("mouseenter", "plots-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "plots-fill", () => { map.getCanvas().style.cursor = ""; });
      }
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("plots") as maplibregl.GeoJSONSource | undefined;
      src?.setData(fc(plots, selectedId));
    };
    if (map.isStyleLoaded()) apply();
    else map.on("load", apply);
  }, [plots, selectedId]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line shadow-sm" style={{ height }}>
      <div ref={el} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-line bg-card/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-moss-500 backdrop-blur">
        Indicated layout · not cadastral
      </div>
    </div>
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
