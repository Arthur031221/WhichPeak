import { describe, expect, it } from "vitest";
import { LOCALES, LOCALE_IDS, createTranslator, resolveLocale } from "../src/i18n";

function flatten(o: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object")
      Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
    else out[`${prefix}${k}`] = String(v);
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
const en = flatten(LOCALES.en.messages);

describe("locales", () => {
  it("ships the nine languages the README promises", () => {
    expect(LOCALE_IDS).toEqual(["en", "zh-TW", "zh-CN", "ja", "ko", "es", "fr", "de", "pt-BR"]);
  });

  for (const id of LOCALE_IDS.filter((l) => l !== "en")) {
    it(`${id} has exactly the keys of en, with the same placeholders`, () => {
      const loc = flatten(LOCALES[id].messages);
      expect(Object.keys(loc).sort()).toEqual(Object.keys(en).sort());
      for (const k of Object.keys(en))
        expect(placeholders(loc[k]), `${id}:${k}`).toBe(placeholders(en[k]));
    });

    it(`${id} translates the interface instead of copying English`, () => {
      const loc = flatten(LOCALES[id].messages);
      const same = Object.keys(en).filter((k) => loc[k] === en[k]);
      // Unit names, compass letters and brand-like words may legitimately match.
      expect(same.length).toBeLessThan(Object.keys(en).length * 0.12);
    });
  }

  it("falls back to English for a missing key and fills placeholders", () => {
    const t = createTranslator("de");
    expect(t("los.clearBy", { meters: "12 m", at: "3 km" })).toContain("12 m");
  });

  it("maps browser tags to shipped locales", () => {
    expect(resolveLocale("zh-Hant-TW")).toBe("zh-TW");
    expect(resolveLocale("zh-SG")).toBe("zh-CN");
    expect(resolveLocale(["pt-PT"])).toBe("pt-BR");
    expect(resolveLocale("sv")).toBe("en");
  });
});
