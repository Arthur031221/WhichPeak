type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Small element builder, so panes read as markup without a framework. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
}

export interface SliderOptions {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  /** Maps the slider position to a value and back, for scales that are not linear. */
  curve?: { to: (pos: number) => number; from: (value: number) => number };
  help?: string;
  onInput: (value: number) => void;
}

export function slider(o: SliderOptions): { root: HTMLElement; set: (v: number) => void } {
  const to = o.curve?.to ?? ((p: number) => p);
  const from = o.curve?.from ?? ((v: number) => v);
  const out = h("output", { for: o.id }, o.format(o.value));
  const input = h("input", {
    id: o.id,
    type: "range",
    min: o.min,
    max: o.max,
    step: o.step,
    value: from(o.value),
    "aria-valuetext": o.format(o.value),
  });
  input.addEventListener("input", () => {
    const v = to(Number(input.value));
    out.textContent = o.format(v);
    input.setAttribute("aria-valuetext", o.format(v));
    o.onInput(v);
  });
  const root = h(
    "div",
    { class: "field" },
    h("div", { class: "field-head" }, h("label", { for: o.id }, o.label), out),
    input,
    o.help ? h("small", {}, o.help) : null,
  );
  return {
    root,
    set(v) {
      input.value = String(from(v));
      out.textContent = o.format(v);
      input.setAttribute("aria-valuetext", o.format(v));
    },
  };
}

export function toggle(
  label: string,
  checked: boolean,
  onChange: (on: boolean) => void,
): { root: HTMLElement; set: (on: boolean) => void } {
  const input = h("input", { type: "checkbox", role: "switch" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return {
    root: h("label", { class: "toggle" }, h("span", {}, label), input),
    set: (on) => (input.checked = on),
  };
}

export function segmented<T extends string>(
  options: { value: T; label: string }[],
  current: T,
  onPick: (v: T) => void,
): { root: HTMLElement; set: (v: T) => void } {
  const buttons = options.map((o) =>
    h(
      "button",
      { type: "button", "data-value": o.value, "aria-pressed": String(o.value === current) },
      o.label,
    ),
  );
  const root = h("div", { class: "seg", role: "group" }, ...buttons);
  const set = (v: T) => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.value === v));
  };
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const v = b.dataset.value as T;
    set(v);
    onPick(v);
  });
  return { root, set };
}
