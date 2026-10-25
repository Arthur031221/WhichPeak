import { bearing, distance } from "../core/geodesy";
import type { LosResult } from "../core/los";
import { type Peak, peakMatches, peakName } from "../core/peaks";
import { dayEvents, dayPath, moonPosition, sunPosition } from "../core/sun";
import type { PeakView } from "../core/visibility";
import {
  type LocaleId,
  LOCALES,
  LOCALE_IDS,
  applyDom,
  createTranslator,
  saveLocale,
  savedLocale,
} from "../i18n";
import { type PeakResult, fetchPeaks } from "../net/overpass";
import { peakSource } from "../net/bundled";
import { type Place, searchPlaces } from "../net/geocode";
import { h, segmented, slider, toggle } from "../ui/dom";
import {
  type Units,
  clockOffset,
  formatAngle,
  formatDistance,
  formatElevation,
  fromSolarClock,
  fromSolarDate,
  solarClock,
  solarDate,
} from "../ui/format";
import { drawProfile } from "../ui/losChart";
import { LocationMap } from "../ui/map";
import { type LabeledPeak, PanoramaView, peakPriority } from "../ui/panorama";
import { SceneClient } from "../worker/client";
import type { Strip } from "../worker/protocol";
import {
  DEFAULT_STATE,
  DEMO_STATE,
  LIMITS,
  type Mode,
  type ViewState,
  formatHash,
  mergeState,
  parseHash,
} from "./state";
import { PhotoMode } from "../photo/mode";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const UNITS_KEY = "whichpeak.units";

export class App {
  state: ViewState;
  locale: LocaleId = savedLocale();
  t = createTranslator(this.locale);
  units: Units = "metric";
  client: SceneClient;
  pano: PanoramaView;
  map: LocationMap;
  photo: PhotoMode;
  peaks: Peak[] = [];
  views: PeakView[] = [];
  selected: LabeledPeak | null = null;
  /** The last finished strip, which photo mode matches against. */
  lastStrip: Strip | null = null;
  los: LosResult | null = null;
  losHeight = 0;
  losGround: number | undefined;
  private loadTimer = 0;
  private hashTimer = 0;
  private abort: AbortController | null = null;
  private loadSeq = 0;
  private peakSource: PeakResult["source"] = "osm";
  private shading = false;
  private shadeAgain = false;
  private ready = false;
  private controls: Record<string, { set: (v: never) => void }> = {};
  private statusTimer = 0;

  constructor() {
    const params = new URLSearchParams(location.search);
    const fromHash = parseHash(location.hash);
    const hasPlace = fromHash.lat !== undefined;
    this.state = mergeState(
      hasPlace ? { ...DEFAULT_STATE, time: Date.now() } : DEMO_STATE,
      fromHash,
    );
    if (hasPlace && fromHash.time === undefined)
      this.state.time = Math.round(Date.now() / 60000) * 60000;
    try {
      this.units = localStorage.getItem(UNITS_KEY) === "imperial" ? "imperial" : "metric";
    } catch {
      /* storage can be blocked */
    }
    this.client = new SceneClient(params.get("tiles") ?? undefined);
    this.pano = new PanoramaView(
      $("#panorama-host"),
      {
        onView: (heading, fov) => this.onView(heading, fov),
        onPick: (peak) => this.selectPeak(peak),
      },
      this.t,
    );
    this.map = new LocationMap($("#map"), this.state, {
      onObserver: (lat, lon) => this.setLocation(lat, lon),
      onTarget: (lat, lon) => this.setTarget(lat, lon),
    });
    this.photo = new PhotoMode(this);
    this.setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", false);
  }

  start(): void {
    this.fillLanguages();
    this.applyLocale();
    this.bindChrome();
    this.pano.setView(this.state.heading, this.state.fov);
    this.pano.setOptions({ showHidden: this.state.ghosts, units: this.units, locale: this.locale });
    this.setMode(this.state.mode, false);
    this.updateSky();
    this.updateChip();
    this.schedule(0);
    this.ready = true;
    addEventListener("hashchange", () => this.onHashChange());
    addEventListener("resize", () => this.redrawLos());
    setTimeout(() => $("#hint").toggleAttribute("data-gone", true), 6000);
  }

  // Chrome: language, theme, search, share, zoom

  private fillLanguages(): void {
    const select = $<HTMLSelectElement>("#lang-select");
    for (const id of LOCALE_IDS) select.append(h("option", { value: id }, LOCALES[id].name));
    select.value = this.locale;
    select.addEventListener("change", () => {
      this.locale = select.value as LocaleId;
      saveLocale(this.locale);
      this.applyLocale();
    });
  }

  private applyLocale(): void {
    this.t = createTranslator(this.locale);
    document.documentElement.lang = this.locale;
    applyDom(document, this.t);
    $<HTMLSelectElement>("#lang-select").value = this.locale;
    this.pano.setText(this.t);
    this.pano.setOptions({ locale: this.locale });
    this.buildPanes();
    this.photo.relocalize();
    this.updateChip();
    this.renderPeakList();
    if (this.selected) this.showCard(this.selected);
    this.redrawLos();
  }

  setTheme(theme: "dark" | "light", persist = true): void {
    document.documentElement.dataset.theme = theme;
    if (persist) {
      try {
        localStorage.setItem("whichpeak.theme", theme);
      } catch {
        /* storage can be blocked */
      }
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0a1220" : "#eef3f9");
    const light = theme === "light";
    this.pano.palette = {
      accent: light ? "#d9552b" : "#ff8f6b",
      label: "rgba(9, 16, 28, 0.78)",
      labelText: "#f6f8fb",
      labelSub: "rgba(246, 248, 251, 0.74)",
    };
    this.pano.invalidate();
    requestAnimationFrame(() => this.redrawLos());
  }

  private bindChrome(): void {
    $("#btn-theme").addEventListener("click", () =>
      this.setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"),
    );
    $("#btn-share").addEventListener("click", () => void this.share());
    $("#btn-locate").addEventListener("click", () => this.locate());
    $("#zoom-in").addEventListener("click", () => this.zoom(1 / 1.35));
    $("#zoom-out").addEventListener("click", () => this.zoom(1.35));
    for (const tab of document.querySelectorAll<HTMLElement>(".tabs button"))
      tab.addEventListener("click", () => this.setMode(tab.dataset.mode as Mode));
    this.bindSearch();
  }

  private zoom(f: number): void {
    const { heading, fov } = this.pano.getView();
    this.pano.lookAt(heading, Math.min(180, Math.max(12, fov * f)));
  }

  private bindSearch(): void {
    const form = $<HTMLFormElement>("#search-form");
    const input = $<HTMLInputElement>("#search-input");
    const list = $<HTMLUListElement>("#search-results");
    let abort: AbortController | null = null;
    const close = () => (list.hidden = true);
    const run = async () => {
      const q = input.value.trim();
      if (q.length < 2) return close();
      const coords = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(q);
      if (coords) {
        close();
        this.setLocation(Number(coords[1]), Number(coords[2]), true);
        return;
      }
      abort?.abort();
      abort = new AbortController();
      list.hidden = false;
      list.replaceChildren(h("li", { class: "none" }, this.t("search.searching")));
      try {
        const found = await searchPlaces(q, this.locale, abort.signal);
        list.replaceChildren(
          ...(found.length
            ? found.map((p) => this.placeItem(p, close, input))
            : [h("li", { class: "none" }, this.t("search.none"))]),
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        list.replaceChildren(h("li", { class: "none" }, this.t("search.failed")));
      }
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void run();
    });
    input.addEventListener("keydown", (e) => e.key === "Escape" && close());
    document.addEventListener("click", (e) => {
      if (!form.contains(e.target as Node)) close();
    });
  }

  private placeItem(p: Place, close: () => void, input: HTMLInputElement): HTMLElement {
    const [first, ...rest] = p.name.split(", ");
    return h(
      "li",
      {},
      h(
        "button",
        {
          type: "button",
          onclick: () => {
            close();
            input.value = first;
            this.setLocation(p.lat, p.lon, true);
          },
        },
        first,
        h("small", {}, rest.slice(0, 3).join(", ")),
      ),
    );
  }

  private locate(): void {
    if (!navigator.geolocation) return this.flash(this.t("status.noGeo"));
    this.flash(this.t("status.locating"), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.setLocation(pos.coords.latitude, pos.coords.longitude, true);
        if (pos.coords.altitude !== null) this.flash(this.t("status.located"));
      },
      () => this.flash(this.t("status.geoDenied")),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  private async share(): Promise<void> {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      this.flash(this.t("status.copied"));
    } catch {
      prompt(this.t("actions.share"), url);
    }
  }

  /** Short message in the status chip. */
  flash(text: string, ms = 2600): void {
    const chip = $("#status-chip");
    chip.textContent = text;
    chip.hidden = false;
    clearTimeout(this.statusTimer);
    if (ms > 0)
      this.statusTimer = window.setTimeout(() => {
        chip.hidden = true;
        this.pano.invalidate();
      }, ms);
    this.pano.invalidate();
  }

  // State

  private persistHash(): void {
    clearTimeout(this.hashTimer);
    this.hashTimer = window.setTimeout(() => {
      const hash = formatHash(this.state);
      if (hash !== location.hash) history.replaceState(null, "", hash);
    }, 200);
  }

  private onHashChange(): void {
    const next = parseHash(location.hash);
    const moved =
      next.lat !== undefined && (next.lat !== this.state.lat || next.lon !== this.state.lon);
    const changed = formatHash(mergeState(this.state, next)) !== formatHash(this.state);
    if (!changed) return;
    this.state = mergeState(this.state, next);
    this.pano.setView(this.state.heading, this.state.fov);
    this.map.setObserver(this.state.lat, this.state.lon);
    this.syncControls();
    this.setMode(this.state.mode, false);
    if (moved) this.schedule(0);
    else this.schedule(200);
  }

  private onView(heading: number, fov: number): void {
    this.state.heading = heading;
    this.state.fov = fov;
    $("#hint").toggleAttribute("data-gone", true);
    this.map.setFan(this.state.lat, this.state.lon, heading, fov, this.state.range);
    this.persistHash();
  }

  setLocation(lat: number, lon: number, fly = false): void {
    lat = Math.max(-85, Math.min(85, lat));
    this.state.lat = lat;
    this.state.lon = lon;
    this.selected = null;
    $("#peak-card").hidden = true;
    this.pano.setSelected(null);
    this.map.setObserver(lat, lon, !fly);
    if (fly) this.map.flyTo(lat, lon);
    this.updateChip();
    this.persistHash();
    this.photo.onLocation();
    if (this.state.mode === "los" && this.state.target) void this.runLos();
    this.schedule(180);
  }

  private patch(p: Partial<ViewState>, reload: boolean): void {
    this.state = mergeState(this.state, p);
    this.persistHash();
    this.updateChip();
    if (reload) this.schedule(350);
    else {
      this.updateSky();
      this.reshade();
    }
  }

  private syncControls(): void {
    const s = this.state;
    (this.controls.range?.set as (v: number) => void)?.(s.range);
    (this.controls.eye?.set as (v: number) => void)?.(s.eye);
    (this.controls.eye2?.set as (v: number) => void)?.(s.eye);
    (this.controls.k?.set as (v: number) => void)?.(s.refraction);
    (this.controls.k2?.set as (v: number) => void)?.(s.refraction);
    (this.controls.ghosts?.set as (v: boolean) => void)?.(s.ghosts);
    this.syncTime();
  }

  // Scene loading

  private schedule(delay: number): void {
    clearTimeout(this.loadTimer);
    this.loadTimer = window.setTimeout(() => void this.load(), delay);
  }

  private setBusy(on: boolean, fraction?: number): void {
    const bar = $("#progress");
    bar.hidden = !on;
    if (fraction === undefined) bar.removeAttribute("data-determinate");
    else {
      bar.setAttribute("data-determinate", "");
      bar.style.setProperty("--w", `${Math.round(fraction * 100)}%`);
    }
  }

  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.abort?.abort();
    this.abort = new AbortController();
    const { signal } = this.abort;
    const s = this.state;
    $("#empty").hidden = true;
    this.setBusy(true);
    document.documentElement.dataset.scene = "loading";
    this.flash(this.t("status.loadingTerrain"), 0);
    this.map.setFan(s.lat, s.lon, s.heading, s.fov, s.range);
    let sceneDone = false;
    let waiting: PeakResult | null = null;
    const apply = async (r: PeakResult) => {
      this.peaks = r.peaks;
      this.peakSource = r.source;
      await this.evaluate(seq);
      if (seq !== this.loadSeq) return;
      if (r.source === "bundled" && r.peaks.length > 0)
        this.flash(this.t(navigator.onLine ? "status.peaksBundled" : "status.peaksOffline"), 0);
      else $("#status-chip").hidden = true;
    };
    const peaksPromise = fetchPeaks(s.lat, s.lon, s.range * 1000, signal, (r) => {
      if (seq !== this.loadSeq) return;
      if (sceneDone) void apply(r);
      else waiting = r;
    }).then(
      (r) => ({ ok: true as const, result: r }),
      (err: unknown) => ({ ok: false as const, err }),
    );
    try {
      await this.client.render(
        {
          lat: s.lat,
          lon: s.lon,
          rangeKm: s.range,
          eye: s.eye,
          refraction: s.refraction,
          time: s.time,
          pxPerDeg: 12,
        },
        {
          onProgress: (phase, done, total) => {
            if (seq === this.loadSeq && phase === "tiles")
              this.setBusy(true, done / Math.max(1, total));
          },
          onStrip: (strip) => {
            if (seq !== this.loadSeq) return strip.bitmap.close();
            if (strip.final) this.lastStrip = strip;
            this.pano.setStrip(strip);
            this.setBusy(true);
            if (!strip.final) this.flash(this.t("status.refining"), 0);
          },
        },
      );
    } catch (err) {
      if (seq !== this.loadSeq) return;
      this.setBusy(false);
      document.documentElement.dataset.scene = "error";
      $("#status-chip").hidden = true;
      this.showEmpty(
        this.t("error.terrain.title"),
        this.t("error.terrain.body", { reason: (err as Error).message }),
      );
      return;
    }
    if (seq !== this.loadSeq) return;
    this.setBusy(false);
    this.updateSky();
    sceneDone = true;
    if (waiting) await apply(waiting);
    const result = await peaksPromise;
    if (seq !== this.loadSeq) return;
    if (result.ok) await apply(result.result);
    else if (!waiting) {
      this.peaks = [];
      this.views = [];
      this.pano.setPeaks([], this.locale);
      this.renderPeakList();
      this.flash(this.t("status.peaksFailed"), 0);
    }
    document.documentElement.dataset.scene = "ready";
    this.photo.onScene();
    if (this.state.mode === "los" && this.state.target) void this.runLos();
  }

  private async evaluate(seq: number): Promise<void> {
    try {
      const views = await this.client.evaluate(this.peaks);
      if (seq !== this.loadSeq) return;
      this.views = views;
      this.pano.setRange(this.state.range * 1000);
      this.pano.setPeaks(views, this.locale);
      this.renderPeakList();
    } catch (err) {
      if (seq === this.loadSeq) this.flash((err as Error).message, 4000);
    }
  }

  private showEmpty(title: string, body: string): void {
    const el = $("#empty");
    el.replaceChildren(
      h("h2", {}, title),
      h("p", {}, body),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          { class: "btn btn-primary", type: "button", onclick: () => void this.load() },
          this.t("actions.retry"),
        ),
      ),
    );
    el.hidden = false;
  }

  /** Light changes only need the colours redone; the terrain stays in the worker. */
  private reshade(): void {
    if (!this.ready) return;
    if (this.shading) {
      this.shadeAgain = true;
      return;
    }
    this.shading = true;
    this.client.reshade(this.state.time, (strip: Strip) => {
      this.pano.setStrip(strip);
      this.shading = false;
      if (this.shadeAgain) {
        this.shadeAgain = false;
        this.reshade();
      }
    });
  }

  updateSky(): void {
    const { lat, lon, time } = this.state;
    const date = new Date(time);
    this.pano.setSky({
      sun: sunPosition(date, lat, lon),
      sunPath: dayPath("sun", date, lat, lon),
      moon: moonPosition(date, lat, lon),
    });
  }

  private updateChip(): void {
    const s = this.state;
    const ns = s.lat >= 0 ? "N" : "S";
    const ew = s.lon >= 0 ? "E" : "W";
    const when = `${solarDate(s.time, s.lon)} ${solarClock(s.time, s.lon)}`;
    $("#place-chip").replaceChildren(
      h("b", {}, `${Math.abs(s.lat).toFixed(4)}° ${ns}, ${Math.abs(s.lon).toFixed(4)}° ${ew}`),
      ` · ${this.t("chip.eye", { height: formatElevation(s.eye, this.units, this.locale) })} · ${when}`,
    );
  }

  // Peaks

  selectPeak(peak: LabeledPeak | null): void {
    this.selected = peak;
    this.pano.setSelected(peak ? peak.view.peak.id : null);
    if (!peak) {
      $("#peak-card").hidden = true;
      return;
    }
    this.showCard(peak);
  }

  private showCard(p: LabeledPeak): void {
    const v = p.view;
    const card = $("#peak-card");
    const row = (k: string, val: string) => [h("dt", {}, k), h("dd", {}, val)];
    const nameLocal = v.peak.names.name && v.peak.names.name !== p.name ? v.peak.names.name : null;
    card.replaceChildren(
      h(
        "button",
        {
          class: "icon-btn card-close",
          type: "button",
          "aria-label": this.t("actions.close"),
          onclick: () => this.selectPeak(null),
        },
        "×",
      ),
      h("h3", {}, p.name),
      nameLocal ? h("small", {}, nameLocal) : "",
      h(
        "div",
        {},
        h(
          "span",
          v.visible ? { class: "tag" } : { class: "tag", "data-hidden": true },
          v.visible ? this.t("card.visible") : this.t("card.hidden"),
        ),
      ),
      h(
        "dl",
        {},
        ...row(this.t("card.elevation"), formatElevation(v.ele, this.units, this.locale)),
        ...row(this.t("card.distance"), formatDistance(v.dist, this.units, this.locale)),
        ...row(this.t("card.bearing"), formatAngle(v.az, this.locale)),
        ...row(this.t("card.angle"), formatAngle(v.angle, this.locale, 2)),
        ...(v.visible
          ? row(this.t("card.clearance"), formatAngle(v.clearance, this.locale, 2))
          : v.hiddenBy
            ? row(this.t("card.hiddenBy"), formatDistance(v.hiddenBy, this.units, this.locale))
            : []),
      ),
      h(
        "div",
        { class: "card-actions" },
        h(
          "button",
          { class: "btn", type: "button", onclick: () => this.sightTo(v.peak) },
          this.t("card.sightline"),
        ),
        h(
          "a",
          {
            class: "btn",
            href: peakSource(v.peak).url,
            target: "_blank",
            rel: "noopener",
          },
          peakSource(v.peak).label,
        ),
      ),
    );
    card.hidden = false;
  }

  /** Opens the line of sight tool aimed at a peak, standing on its summit height. */
  private sightTo(peak: Peak): void {
    this.losGround = peak.ele ?? undefined;
    this.losHeight = 0;
    this.setMode("los");
    this.setTarget(peak.lat, peak.lon, peak.ele ?? undefined);
  }

  private renderPeakList(): void {
    const list = document.getElementById("peak-list");
    if (!list) return;
    const query = (document.getElementById("peak-filter") as HTMLInputElement | null)?.value ?? "";
    const matching = this.views
      .filter((v) => v.visible && peakMatches(v.peak, query))
      .sort(
        (a, b) =>
          peakPriority(b, this.state.range * 1000) - peakPriority(a, this.state.range * 1000),
      );
    // A search looks through every visible peak, the plain list stops at the 40 that matter most.
    const shown = query.trim() ? matching : matching.slice(0, 40);
    const empty = document.getElementById("peak-empty");
    if (empty) {
      empty.hidden = shown.length > 0;
      empty.textContent = this.t(query.trim() ? "peaks.noMatch" : "peaks.empty");
    }
    list.replaceChildren(
      ...shown.map((v) =>
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              onclick: () => {
                this.pano.lookAt(v.az, Math.min(this.state.fov, 60));
                this.selectPeak({ view: v, name: peakName(v.peak, this.locale) });
              },
            },
            h("span", {}, peakName(v.peak, this.locale)),
            h(
              "small",
              {},
              `${formatElevation(v.ele, this.units, this.locale)} · ${formatDistance(v.dist, this.units, this.locale)}`,
            ),
          ),
        ),
      ),
    );
  }

  // Modes

  setMode(mode: Mode, persist = true): void {
    this.state.mode = mode;
    for (const tab of document.querySelectorAll<HTMLElement>(".tabs button"))
      tab.setAttribute("aria-selected", String(tab.dataset.mode === mode));
    for (const m of ["panorama", "los", "photo"] as const) $(`#pane-${m}`).hidden = m !== mode;
    this.map.setMode(mode);
    this.photo.setActive(mode === "photo");
    $("#hint").hidden = mode === "photo";
    this.map.setTarget(mode === "los" ? this.state.target : null);
    if (mode === "los" && this.state.target) void this.runLos();
    if (persist) this.persistHash();
  }

  // Line of sight

  setTarget(lat: number, lon: number, ground?: number): void {
    this.state.target = [lat, lon];
    this.losGround = ground;
    this.map.setTarget(this.state.target);
    this.persistHash();
    void this.runLos();
  }

  private losSeq = 0;

  private async runLos(): Promise<void> {
    const t = this.state.target;
    if (!t) return;
    const seq = ++this.losSeq;
    const out = document.getElementById("los-out");
    if (out) out.setAttribute("aria-busy", "true");
    this.setBusy(true);
    try {
      const result = await this.client.lineOfSight(
        {
          lat: this.state.lat,
          lon: this.state.lon,
          targetLat: t[0],
          targetLon: t[1],
          eye: this.state.eye,
          targetHeight: this.losHeight,
          targetGround: this.losGround,
          refraction: this.state.refraction,
        },
        (done, total) => seq === this.losSeq && this.setBusy(true, done / Math.max(1, total)),
      );
      if (seq !== this.losSeq) return;
      this.los = result;
      this.renderLos();
    } catch (err) {
      if (seq !== this.losSeq) return;
      this.los = null;
      const box = document.getElementById("los-result");
      box?.replaceChildren(h("p", { class: "note", "data-tone": "warn" }, (err as Error).message));
    } finally {
      if (seq === this.losSeq) {
        this.setBusy(false);
        out?.removeAttribute("aria-busy");
      }
    }
  }

  private renderLos(): void {
    const r = this.los;
    const box = document.getElementById("los-result");
    if (!r || !box) return;
    const u = this.units;
    const l = this.locale;
    const stat = (k: string, v: string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    box.replaceChildren(
      h(
        "div",
        { class: "verdict", "data-visible": String(r.visible) },
        h("strong", {}, r.visible ? this.t("los.visible") : this.t("los.blocked")),
        h(
          "p",
          {},
          r.limiting
            ? r.visible
              ? this.t("los.clearBy", {
                  meters: formatElevation(Math.max(0, r.clearance), u, l),
                  at: formatDistance(r.limiting.d, u, l),
                })
              : this.t("los.blockedBy", {
                  meters: formatElevation(Math.abs(r.clearance), u, l),
                  at: formatDistance(r.limiting.d, u, l),
                })
            : this.t("los.open"),
        ),
      ),
      h(
        "dl",
        { class: "stats" },
        stat(this.t("los.distance"), formatDistance(r.distance, u, l)),
        stat(this.t("los.bearing"), formatAngle(r.bearing, l)),
        stat(this.t("los.eyeAlt"), formatElevation(r.eyeAlt, u, l)),
        stat(this.t("los.targetAlt"), formatElevation(r.targetAlt, u, l)),
        stat(this.t("los.angle"), formatAngle(r.targetAngle, l, 2)),
        stat(this.t("los.limiting"), r.limiting ? formatElevation(r.limiting.ground, u, l) : "-"),
      ),
      h("canvas", {
        class: "chart",
        id: "los-chart",
        role: "img",
        "aria-label": this.t("los.chart"),
      }),
    );
    requestAnimationFrame(() => this.redrawLos());
  }

  private redrawLos(): void {
    const canvas = document.getElementById("los-chart") as HTMLCanvasElement | null;
    if (!canvas || !this.los) return;
    drawProfile(canvas, this.los, this.units, this.locale, {
      eye: this.t("los.chartEye"),
      target: this.t("los.chartTarget"),
      limit: this.t("los.chartLimit"),
    });
  }

  // Panes

  private buildPanes(): void {
    const t = this.t;
    const s = this.state;
    const fmtLen = (m: number) => formatElevation(m, this.units, this.locale);
    const eyeCurve = {
      to: (p: number) => Math.round((p * p) / 100) * 1,
      from: (v: number) => Math.sqrt(v * 100),
    };
    const range = slider({
      id: "range",
      label: t("controls.range"),
      min: LIMITS.range[0],
      max: LIMITS.range[1],
      step: 5,
      value: s.range,
      format: (v) => formatDistance(v * 1000, this.units, this.locale),
      help: t("controls.rangeHelp"),
      onInput: (v) => this.patch({ range: v }, true),
    });
    const eyeSlider = (id: string) =>
      slider({
        id,
        label: t("controls.eye"),
        min: 0,
        max: Math.sqrt(LIMITS.eye[1] * 100),
        step: 0.5,
        value: s.eye,
        curve: eyeCurve,
        format: fmtLen,
        help: t("controls.eyeHelp"),
        onInput: (v) => {
          this.patch({ eye: v }, true);
          (this.controls.eye2?.set as (v: number) => void)?.(v);
          (this.controls.eye?.set as (v: number) => void)?.(v);
        },
      });
    const kSlider = (id: string) =>
      slider({
        id,
        label: t("controls.refraction"),
        min: LIMITS.refraction[0],
        max: LIMITS.refraction[1],
        step: 0.01,
        value: s.refraction,
        format: (v) => v.toFixed(2),
        help: t("controls.refractionHelp"),
        onInput: (v) => {
          this.patch({ refraction: v }, true);
          (this.controls.k2?.set as (v: number) => void)?.(v);
          (this.controls.k?.set as (v: number) => void)?.(v);
        },
      });
    const eye = eyeSlider("eye");
    const eye2 = eyeSlider("eye-los");
    const k = kSlider("refraction");
    const k2 = kSlider("refraction-los");
    const ghosts = toggle(t("controls.ghosts"), s.ghosts, (on) => {
      this.state.ghosts = on;
      this.pano.setOptions({ showHidden: on });
      this.persistHash();
    });
    const units = segmented<Units>(
      [
        { value: "metric", label: t("units.metric") },
        { value: "imperial", label: t("units.imperial") },
      ],
      this.units,
      (u) => {
        this.units = u;
        try {
          localStorage.setItem(UNITS_KEY, u);
        } catch {
          /* storage can be blocked */
        }
        this.pano.setOptions({ units: u });
        this.buildPanes();
        this.updateChip();
        this.renderPeakList();
        this.redrawLos();
        if (this.los) this.renderLos();
      },
    );
    this.controls = { range, eye, eye2, k, k2, ghosts } as never;

    const date = h("input", { type: "date", id: "date", "aria-label": t("controls.date") });
    const clock = slider({
      id: "clock",
      label: t("controls.time"),
      min: 0,
      max: 1439,
      step: 5,
      value: 0,
      format: (v) =>
        `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(Math.round(v % 60)).padStart(2, "0")}`,
      help: "",
      onInput: (v) => {
        const hhmm = `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
        this.patch({ time: fromSolarClock(this.state.time, this.state.lon, hhmm) }, false);
      },
    });
    const zone = h("small", { id: "zone" });
    this.controls.clock = clock as never;
    (this.controls as Record<string, unknown>).date = date;
    date.addEventListener("change", () => {
      if (date.value)
        this.patch({ time: fromSolarDate(this.state.time, this.state.lon, date.value) }, false);
      this.syncTime();
    });
    const quick = (label: string, pick: () => Date | null) =>
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            const d = pick();
            if (d) this.patch({ time: d.getTime() }, false);
            else this.flash(t("controls.noEvent"));
            this.syncTime();
          },
        },
        label,
      );
    const events = () => dayEvents(new Date(this.state.time), this.state.lat, this.state.lon);
    const timeRow = h(
      "div",
      { class: "row" },
      quick(t("controls.sunrise"), () => events().sunrise),
      quick(t("controls.goldenHour"), () => events().goldenHour),
      quick(t("controls.sunset"), () => events().sunset),
      quick(t("controls.now"), () => new Date()),
    );

    const pano = $("#pane-panorama");
    pano.replaceChildren(
      h("p", { class: "section-title" }, t("controls.viewpoint")),
      range.root,
      eye.root,
      k.root,
      h("p", { class: "section-title" }, t("controls.light")),
      h(
        "div",
        { class: "field" },
        h("div", { class: "field-head" }, h("label", { for: "date" }, t("controls.date")), zone),
        date,
      ),
      clock.root,
      timeRow,
      h("p", { class: "section-title" }, t("controls.display")),
      ghosts.root,
      h("div", { class: "field-head" }, h("span", {}, t("units.label")), units.root),
      h("p", { class: "section-title" }, t("peaks.title")),
      h("input", {
        type: "search",
        id: "peak-filter",
        class: "peak-filter",
        placeholder: t("peaks.filter"),
        "aria-label": t("peaks.filter"),
        autocomplete: "off",
        oninput: () => this.renderPeakList(),
      }),
      h("ul", { class: "peak-list", id: "peak-list" }),
      h("p", { class: "note", id: "peak-empty" }, t("peaks.empty")),
      h(
        "button",
        { class: "btn", type: "button", onclick: () => void this.exportPng() },
        t("actions.savePng"),
      ),
    );
    this.syncTime();

    const height = h("input", {
      type: "number",
      id: "los-height",
      min: 0,
      max: 9000,
      step: 1,
      value: this.losHeight,
    });
    height.addEventListener("input", () => {
      this.losHeight = Math.max(0, Number(height.value) || 0);
      if (this.state.target) void this.runLos();
    });
    $("#pane-los").replaceChildren(
      h("p", { class: "note" }, t("los.intro")),
      eye2.root,
      k2.root,
      h(
        "div",
        { class: "field" },
        h(
          "div",
          { class: "field-head" },
          h("label", { for: "los-height" }, t("los.targetHeight")),
          h("output", {}, "m"),
        ),
        height,
        h("small", {}, t("los.targetHeightHelp")),
      ),
      h(
        "div",
        { id: "los-out" },
        h(
          "div",
          { id: "los-result" },
          this.state.target ? "" : h("p", { class: "note" }, t("los.pick")),
        ),
      ),
    );
    if (this.los) this.renderLos();
    this.photo.mountPane($("#pane-photo"));
  }

  private syncTime(): void {
    const s = this.state;
    const date = (this.controls as Record<string, unknown>).date as HTMLInputElement | undefined;
    if (date) date.value = solarDate(s.time, s.lon);
    const hhmm = solarClock(s.time, s.lon).split(":").map(Number);
    (this.controls.clock?.set as ((v: number) => void) | undefined)?.(hhmm[0] * 60 + hhmm[1]);
    const zone = document.getElementById("zone");
    if (zone) zone.textContent = this.t("controls.solarClock", { zone: clockOffset(s.lon) });
  }

  async exportPng(): Promise<void> {
    const blob = await this.pano.toBlob();
    if (!blob) return;
    const a = h("a", {
      href: URL.createObjectURL(blob),
      download: `whichpeak-${this.state.lat.toFixed(3)}-${this.state.lon.toFixed(3)}.png`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** Bearing and distance from the viewpoint, used by photo mode. */
  from(lat: number, lon: number): { az: number; dist: number } {
    return {
      az: bearing(this.state.lat, this.state.lon, lat, lon),
      dist: distance(this.state.lat, this.state.lon, lat, lon),
    };
  }
}
