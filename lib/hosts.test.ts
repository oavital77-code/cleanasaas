import { describe, expect, it } from "vitest";
import { CLEANA_URL, GROUP_URL, hostnameOf, routeForHost } from "./hosts";

const prod = { production: true };
const preview = { production: false };

describe("hostnameOf", () => {
  it.each([
    ["cleanagroup.app", "cleanagroup.app"],
    ["CleanaGroup.app:443", "cleanagroup.app"],
    ["localhost:3000", "localhost"],
    [null, ""],
    [undefined, ""],
  ])("%s -> %s", (input, expected) => {
    expect(hostnameOf(input)).toBe(expected);
  });
});

describe("routeForHost — דף הנחיתה של הקבוצה (cleanagroup.app)", () => {
  it.each(["cleanagroup.app", "www.cleanagroup.app", "cleanagroup.app:443"])(
    "/ על %s מוגש כ-/group (rewrite, לא redirect — הכתובת בדפדפן נשארת נקייה)",
    (host) => {
      expect(routeForHost(host, "/", "", prod)).toEqual({ kind: "rewrite", pathname: "/group" });
    },
  );

  it.each(["/group", "/terms", "/privacy"])("%s מוגש ישירות", (path) => {
    expect(routeForHost("cleanagroup.app", path, "", prod)).toEqual({ kind: "next" });
  });

  it.each(["/login", "/dashboard", "/signup", "/admin/board"])(
    "%s הוא של המוצר, לא של הקבוצה — מופנה ל-Cleana באותו נתיב",
    (path) => {
      expect(routeForHost("cleanagroup.app", path, "", prod)).toEqual({
        kind: "redirect",
        url: `${CLEANA_URL}${path}`,
      });
    },
  );

  it("ה-redirect שומר על query string", () => {
    expect(routeForHost("cleanagroup.app", "/join/orc", "?ref=x", prod)).toEqual({
      kind: "redirect",
      url: `${CLEANA_URL}/join/orc?ref=x`,
    });
  });

  it("מתנהג זהה גם ב-preview — דף הנחיתה לא תלוי בסביבה", () => {
    expect(routeForHost("cleanagroup.app", "/", "", preview)).toEqual({ kind: "rewrite", pathname: "/group" });
  });
});

describe("routeForHost — hosts של המוצר", () => {
  it.each(["cleanas.cleanagroup.app", "cleanasaas.vercel.app"])(
    "/group על %s מופנה לכתובת הקנונית של הקבוצה ב-production",
    (host) => {
      expect(routeForHost(host, "/group", "", prod)).toEqual({ kind: "redirect", url: `${GROUP_URL}/` });
    },
  );

  it("/group ב-preview/localhost מוגש כרגיל — אפשר לפתח את הדף מקומית", () => {
    expect(routeForHost("localhost:3000", "/group", "", preview)).toEqual({ kind: "next" });
    expect(routeForHost("cleanasaas-git-x.vercel.app", "/group", "", preview)).toEqual({ kind: "next" });
  });

  it.each(["/", "/login", "/dashboard", "/terms"])("%s לא מושפע", (path) => {
    expect(routeForHost("cleanas.cleanagroup.app", path, "", prod)).toEqual({ kind: "next" });
    expect(routeForHost("cleanasaas.vercel.app", path, "", prod)).toEqual({ kind: "next" });
  });

  it("host חסר (בקשה פנימית/בדיקה) — לא נוגעים", () => {
    expect(routeForHost(null, "/", "", prod)).toEqual({ kind: "next" });
  });
});
