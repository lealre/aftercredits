import { describe, expect, it } from "vitest";
import { titleProvenance, watchedProvenance } from "./titleProvenance";

describe("titleProvenance", () => {
  it("reports both halves when both are known", () => {
    const p = titleProvenance({ id: "u1", username: "bfcorrea" }, "2026-09-19T10:00:00Z");
    expect(p?.who).toBe("bfcorrea");
    expect(p?.when).toBeTruthy();
  });

  // The common case right after the migration: the date was always stored,
  // the author only from now on.
  it("reports the date alone when no author was recorded", () => {
    const p = titleProvenance(null, "2026-09-19T10:00:00Z");
    expect(p?.who).toBeNull();
    expect(p?.when).toBeTruthy();
  });

  it("reports the author alone when the date is missing", () => {
    const p = titleProvenance({ id: "u1", username: "lealre" }, undefined);
    expect(p?.who).toBe("lealre");
    expect(p?.when).toBeNull();
  });

  // Rather than rendering the string "Invalid Date" at the user.
  it("drops a date it cannot parse", () => {
    expect(titleProvenance(null, "not-a-date")).toBeNull();
    expect(titleProvenance({ id: "u1", username: "x" }, "not-a-date")?.when).toBeNull();
  });

  it("treats a blank username as no author", () => {
    expect(titleProvenance({ id: "u1", username: "   " }, undefined)).toBeNull();
  });

  // Nothing to say means no affordance at all, not an empty panel.
  it("returns null when there is nothing to show", () => {
    expect(titleProvenance(null, null)).toBeNull();
    expect(titleProvenance(undefined, undefined)).toBeNull();
  });
});

describe("watchedProvenance", () => {
  it("reports who marked it and when", () => {
    const p = watchedProvenance({ id: "u1", username: "lealre" }, "2026-09-19T10:00:00Z");
    expect(p?.who).toBe("lealre");
    expect(p?.when).toBeTruthy();
  });

  // An unwatched title has no marker and no date, so the line is omitted
  // entirely rather than rendered empty.
  it("returns null for an unwatched title", () => {
    expect(watchedProvenance(null, undefined)).toBeNull();
  });

  // Titles watched before the backend recorded the marker: the date survives,
  // the name does not.
  it("reports the date alone when nobody was recorded", () => {
    const p = watchedProvenance(null, "2026-09-19T10:00:00Z");
    expect(p?.who).toBeNull();
    expect(p?.when).toBeTruthy();
  });
});
