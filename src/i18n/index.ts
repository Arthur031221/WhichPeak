import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ptBR from "./locales/pt-BR.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

export type Messages = typeof en;

export const LOCALES = {
  en: { name: "English", messages: en },
  "zh-TW": { name: "繁體中文", messages: zhTW },
  "zh-CN": { name: "简体中文", messages: zhCN },
  ja: { name: "日本語", messages: ja },
  ko: { name: "한국어", messages: ko },
  es: { name: "Español", messages: es },
  fr: { name: "Français", messages: fr },
  de: { name: "Deutsch", messages: de },
  "pt-BR": { name: "Português (Brasil)", messages: ptBR },
} as const;

export type LocaleId = keyof typeof LOCALES;

export const LOCALE_IDS = Object.keys(LOCALES) as LocaleId[];

/** Maps a browser language tag such as zh-Hant-TW or pt-PT to the closest shipped locale. */
export function resolveLocale(tag: string | readonly string[] | undefined): LocaleId {
  const tags = typeof tag === "string" ? [tag] : [...(tag ?? [])];
  for (const raw of tags) {
    const t = raw.toLowerCase();
    if (t.startsWith("zh")) return /hant|tw|hk|mo/.test(t) ? "zh-TW" : "zh-CN";
    if (t.startsWith("pt")) return "pt-BR";
    const base = t.split("-")[0];
    const hit = LOCALE_IDS.find((id) => id.toLowerCase() === base);
    if (hit) return hit;
  }
  return "en";
}

type Params = Record<string, string | number>;

function lookup(tree: unknown, key: string): string | undefined {
  let node = tree;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node)
      node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(message: string, params?: Params): string {
  return params
    ? message.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
    : message;
}

export type Translate = (key: string, params?: Params) => string;

/** Translator that falls back to English for any key a locale lacks. */
export function createTranslator(id: LocaleId): Translate {
  const messages = LOCALES[id].messages;
  return (key, params) => interpolate(lookup(messages, key) ?? lookup(en, key) ?? key, params);
}

const LANG_KEY = "whichpeak.lang";

export function savedLocale(): LocaleId {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && saved in LOCALES) return saved as LocaleId;
  } catch {
    /* storage can be blocked */
  }
  return resolveLocale(navigator.languages?.length ? navigator.languages : navigator.language);
}

export function saveLocale(id: LocaleId): void {
  try {
    localStorage.setItem(LANG_KEY, id);
  } catch {
    /* storage can be blocked */
  }
}

/** Fills every element that carries a data-i18n attribute. */
export function applyDom(root: ParentNode, t: Translate): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]"))
    el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]"))
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder!));
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-title]"))
    el.setAttribute("title", t(el.dataset.i18nTitle!));
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-label]"))
    el.setAttribute("aria-label", t(el.dataset.i18nLabel!));
}
