export type Mode = "panorama" | "photo" | "los";

export interface ViewState {
  lat: number;
  lon: number;
  /** Looking direction, degrees clockwise from north. */
  heading: number;
  /** Horizontal field of view of the viewer, degrees. */
  fov: number;
  /** How far the panorama reaches, kilometres. */
  range: number;
  /** Eye height above the ground, metres. */
  eye: number;
  refraction: number;
  /** Moment used for the sun, the moon and the light, UTC milliseconds. */
  time: number;
  mode: Mode;
  /** Second point of the line of sight tool. */
  target: [number, number] | null;
  ghosts: boolean;
}

export const LIMITS = {
  range: [5, 400],
  fov: [10, 360],
  eye: [0, 3000],
  refraction: [0, 0.25],
} as const;

export const DEFAULT_STATE: ViewState = {
  lat: 35.6586,
  lon: 139.7454,
  heading: 250,
  fov: 90,
  range: 150,
  eye: 2,
  refraction: 0.13,
  time: Date.UTC(2026, 5, 21, 7, 40),
  mode: "panorama",
  target: null,
  ghosts: false,
};

/** What the page opens with when the address carries no place: Tokyo Tower at golden hour, Fuji in the west. */
export const DEMO_STATE: ViewState = { ...DEFAULT_STATE, eye: 150 };

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

function num(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

const round = (v: number, digits: number) => Number(v.toFixed(digits));

/** Reads a location hash such as #lat=35.6586&lon=139.7454&az=250. Unknown or bad values are ignored. */
export function parseHash(hash: string): Partial<ViewState> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const out: Partial<ViewState> = {};
  const lat = num(q.get("lat"));
  const lon = num(q.get("lon"));
  if (lat !== null && lon !== null && Math.abs(lat) <= 85 && Math.abs(lon) <= 180) {
    out.lat = lat;
    out.lon = lon;
  }
  const az = num(q.get("az"));
  if (az !== null) out.heading = ((az % 360) + 360) % 360;
  const fov = num(q.get("fov"));
  if (fov !== null) out.fov = clamp(fov, LIMITS.fov);
  const range = num(q.get("r"));
  if (range !== null) out.range = clamp(range, LIMITS.range);
  const eye = num(q.get("eye"));
  if (eye !== null) out.eye = clamp(eye, LIMITS.eye);
  const k = num(q.get("k"));
  if (k !== null) out.refraction = clamp(k, LIMITS.refraction);
  const t = q.get("t");
  if (t && !Number.isNaN(Date.parse(t))) out.time = Date.parse(t);
  const mode = q.get("mode");
  if (mode === "panorama" || mode === "los") out.mode = mode;
  const tl = num(q.get("tlat"));
  const tn = num(q.get("tlon"));
  if (tl !== null && tn !== null && Math.abs(tl) <= 85 && Math.abs(tn) <= 180)
    out.target = [tl, tn];
  if (q.get("ghosts") === "1") out.ghosts = true;
  return out;
}

/** Writes the place, the view and the moment; the other settings only when they differ from the defaults. */
export function formatHash(s: ViewState): string {
  const q = new URLSearchParams();
  q.set("lat", String(round(s.lat, 5)));
  q.set("lon", String(round(s.lon, 5)));
  q.set("az", String(round(s.heading, 1)));
  if (s.fov !== DEFAULT_STATE.fov) q.set("fov", String(round(s.fov, 1)));
  if (s.range !== DEFAULT_STATE.range) q.set("r", String(round(s.range, 1)));
  if (s.eye !== DEFAULT_STATE.eye) q.set("eye", String(round(s.eye, 1)));
  if (s.refraction !== DEFAULT_STATE.refraction) q.set("k", String(round(s.refraction, 3)));
  q.set("t", new Date(s.time).toISOString().slice(0, 16) + "Z");
  if (s.mode === "los") {
    q.set("mode", "los");
    if (s.target) {
      q.set("tlat", String(round(s.target[0], 5)));
      q.set("tlon", String(round(s.target[1], 5)));
    }
  }
  if (s.ghosts) q.set("ghosts", "1");
  return `#${q.toString().replace(/%3A/g, ":")}`;
}

export function mergeState(base: ViewState, patch: Partial<ViewState>): ViewState {
  return { ...base, ...patch };
}
