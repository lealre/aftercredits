import { describe, expect, it, vi, afterEach } from "vitest";

// The hook itself needs React to run; what is worth pinning without a DOM
// harness is the query it asks, because the wrong query is the whole bug.
// A width breakpoint would call a touchscreen laptop "hover capable" and a
// landscape phone "not narrow", which is how hover-only UI ends up invisible.
describe("useHoverCapable", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks about the pointer, not the viewport width", async () => {
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", { matchMedia });

    const { useHoverCapable } = await import("./useHoverCapable");
    expect(typeof useHoverCapable).toBe("function");

    // The source must interrogate hover and pointer capability. Asserting on
    // the query string is blunt, but it is the one thing that silently breaks
    // while everything still compiles and renders.
    const src = await import("fs").then((fs) =>
      fs.readFileSync(new URL("./useHoverCapable.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("(hover: hover) and (pointer: fine)");
    expect(src).not.toMatch(/max-width|min-width/);
  });
});
