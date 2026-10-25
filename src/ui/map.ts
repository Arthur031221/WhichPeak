import L from "leaflet";

export interface MapCallbacks {
  /** The observer moved, by a click or by dragging the pin. */
  onObserver: (lat: number, lon: number) => void;
  /** The line of sight target moved. */
  onTarget: (lat: number, lon: number) => void;
}

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function pin(extra = ""): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${extra}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export class LocationMap {
  private map: L.Map;
  private observer: L.Marker;
  private target: L.Marker | null = null;
  private fan: L.Polygon;
  private line: L.Polyline;
  private mode: "panorama" | "los" | "photo" = "panorama";

  constructor(
    el: HTMLElement,
    start: { lat: number; lon: number },
    private cb: MapCallbacks,
  ) {
    this.map = L.map(el, { zoomControl: true, attributionControl: true }).setView(
      [start.lat, start.lon],
      8,
    );
    L.tileLayer(TILES, {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
    this.observer = L.marker([start.lat, start.lon], { icon: pin(), draggable: true }).addTo(
      this.map,
    );
    this.observer.on("dragend", () => {
      const p = this.observer.getLatLng();
      this.cb.onObserver(p.lat, p.lng);
    });
    this.fan = L.polygon([], {
      color: "#ff8f6b",
      weight: 1,
      fillOpacity: 0.16,
      interactive: false,
    }).addTo(this.map);
    this.line = L.polyline([], {
      color: "#7fd6f5",
      weight: 3,
      dashArray: "6 6",
      interactive: false,
    }).addTo(this.map);
    this.map.on("click", (e: L.LeafletMouseEvent) => {
      if (this.mode === "los") this.cb.onTarget(e.latlng.lat, e.latlng.lng);
      else this.cb.onObserver(e.latlng.lat, e.latlng.lng);
    });
  }

  setMode(mode: "panorama" | "los" | "photo"): void {
    this.mode = mode;
    if (mode !== "los") this.setTarget(null);
    this.map.getContainer().style.cursor = "crosshair";
    this.invalidate();
  }

  setObserver(lat: number, lon: number, pan = true): void {
    this.observer.setLatLng([lat, lon]);
    if (pan && !this.map.getBounds().pad(-0.2).contains([lat, lon]))
      this.map.setView([lat, lon], Math.max(this.map.getZoom(), 8));
  }

  setTarget(t: [number, number] | null): void {
    if (!t) {
      this.target?.remove();
      this.target = null;
      this.line.setLatLngs([]);
      return;
    }
    if (!this.target) {
      this.target = L.marker(t, { icon: pin("pin-target"), draggable: true }).addTo(this.map);
      this.target.on("dragend", () => {
        const p = this.target!.getLatLng();
        this.cb.onTarget(p.lat, p.lng);
      });
    } else this.target.setLatLng(t);
    const o = this.observer.getLatLng();
    this.line.setLatLngs([o, t]);
  }

  /** Shades the part of the horizon the viewer is looking at. */
  setFan(lat: number, lon: number, heading: number, fov: number, rangeKm: number): void {
    if (this.mode !== "panorama") {
      this.fan.setLatLngs([]);
      return;
    }
    const r = Math.min(rangeKm, 60) * 1000;
    const pts: L.LatLngTuple[] = [[lat, lon]];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const az = ((heading - fov / 2 + (fov * i) / steps) * Math.PI) / 180;
      const dLat = (r * Math.cos(az)) / 111_320;
      const dLon = (r * Math.sin(az)) / (111_320 * Math.cos((lat * Math.PI) / 180));
      pts.push([lat + dLat, lon + dLon]);
    }
    this.fan.setLatLngs(pts);
  }

  invalidate(): void {
    setTimeout(() => this.map.invalidateSize(), 0);
  }

  flyTo(lat: number, lon: number): void {
    this.map.setView([lat, lon], Math.max(this.map.getZoom(), 9));
  }
}
