import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const mockTheme = {
  id: "codeHeist",
  colors: {
    primary: "#facc15",
    secondary: "#18181b",
    border: "#3f3f46",
    accent: "#eab308",
    background: "#090a0d",
    surface: "#111318",
    surfaceElevated: "#181a20",
    muted: "#a1a1aa",
    glow: "#facc15",
    gradient: "linear-gradient(135deg, #facc15 0%, #a16207 100%)",
  },
  atmosphere: {
    artworkOpacity: 0.12,
    artworkPosition: "center",
    overlayOpacity: 0.74,
    glowOpacity: 0.16,
    gridOpacity: 0.08,
    scanlineOpacity: 0.025,
    vignetteOpacity: 0.74,
    animation: "scan",
  },
  background: "codeHeist",
};

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({ theme: mockTheme, themeId: "codeHeist" }),
}));

vi.mock("./themeBackgrounds", () => ({
  THEME_BACKGROUNDS: { codeHeist: "/code-heist.webp" },
}));

import ThemeSkin from "./ThemeSkin";

describe("ThemeSkin", () => {
  it("exposes semantic theme tokens and atmosphere metadata", () => {
    render(
      <ThemeSkin>
        <div data-testid="content">content</div>
      </ThemeSkin>
    );

    const content = document.querySelector("[data-testid='content']");
    expect(content).not.toBeNull();

    const skin = content.parentElement;
    expect(skin.dataset.theme).toBe("codeHeist");
    expect(skin.style.getPropertyValue("--theme-primary")).toBe("#facc15");
    expect(skin.style.getPropertyValue("--theme-background")).toBe("#090a0d");

    const atmosphere = document.querySelector(".universe-atmosphere");
    expect(atmosphere).not.toBeNull();
    expect(atmosphere.getAttribute("data-theme-background")).toBe("codeHeist");
    expect(atmosphere.getAttribute("data-animation")).toBe("scan");
  });
});
