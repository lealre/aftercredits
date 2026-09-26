import { describe, expect, it } from "vitest";
import { listFilterKey } from "./listFilterKey";

const base = {
  groupId: "g1",
  watched: undefined,
  titleType: undefined,
  orderBy: "addedAt",
  ascending: false,
};

describe("listFilterKey", () => {
  it("is stable for identical filters", () => {
    expect(listFilterKey(base)).toBe(listFilterKey({ ...base }));
  });

  // The bug this exists for: on page 3 of all titles, switching to Unwatched
  // (27 titles, 2 pages) kept page=3 and returned an empty list.
  it("changes when the watched filter changes", () => {
    expect(listFilterKey({ ...base, watched: false })).not.toBe(listFilterKey(base));
    expect(listFilterKey({ ...base, watched: true })).not.toBe(
      listFilterKey({ ...base, watched: false }),
    );
  });

  it("changes when the type, sort, direction or group changes", () => {
    const k = listFilterKey(base);
    expect(listFilterKey({ ...base, titleType: "serie" })).not.toBe(k);
    expect(listFilterKey({ ...base, orderBy: "imdbRating" })).not.toBe(k);
    expect(listFilterKey({ ...base, ascending: true })).not.toBe(k);
    expect(listFilterKey({ ...base, groupId: "g2" })).not.toBe(k);
  });

  // undefined and false mean different things for the watched filter — "all"
  // versus "unwatched" — so they must not collapse to the same key.
  it("distinguishes an absent filter from a false one", () => {
    expect(listFilterKey({ ...base, watched: undefined })).not.toBe(
      listFilterKey({ ...base, watched: false }),
    );
  });
});
