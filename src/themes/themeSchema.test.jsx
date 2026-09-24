import { describe, expect, it } from "vitest";
import { createTheme } from "./themeSchema";

describe("theme schema", () => {
  it("provides semantic defaults for the full visual system", () => {
    const theme = createTheme({
      id: "test",
      name: "Test",
      description: "Test",
      words: {},
    });

    expect(theme.colors).toMatchObject({
      background: "#0b0d10",
      surface: "#10131a",
      surfaceElevated: "#141820",
      muted: "#a1a1aa",
      glow: "#2dd4bf",
    });

    expect(theme.colors.gradient).toContain("linear-gradient");
    expect(theme.atmosphere.animation).toBe("none");
    expect(theme.background).toBeNull();
  });

  it("preserves explicit theme tokens", () => {
    const theme = createTheme({
      id: "custom",
      name: "Custom",
      description: "Custom",
      colors: {
        background: "#123456",
        surface: "#234567",
        glow: "#abcdef",
      },
      atmosphere: {
        artworkOpacity: 0.2,
        animation: "scan",
      },
      background: "custom",
      words: {},
    });

    expect(theme.colors.background).toBe("#123456");
    expect(theme.colors.surface).toBe("#234567");
    expect(theme.colors.glow).toBe("#abcdef");
    expect(theme.atmosphere.artworkOpacity).toBe(0.2);
    expect(theme.atmosphere.animation).toBe("scan");
    expect(theme.background).toBe("custom");
  });
});


describe("universe visual identity", () => {
  it("provides visual metadata without requiring a theme-specific component contract", () => {
    const theme = createTheme({
      id: "demo",
      name: "Demo",
      description: "Demo",
      colors: {},
      words: {},
      visual: {
        codename: "NODE 01",
        motif: "terminal",
      },
    });

    expect(theme.visual.codename).toBe("NODE 01");
    expect(theme.visual.motif).toBe("terminal");
    expect(theme.visual.panelStyle).toBe("standard");
  });
});
