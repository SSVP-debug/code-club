import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppContext } from "../../context/AppContextObject";
import StreakBadge from "./StreakBadge";

vi.mock("./StreakCalendarPopover", () => ({
  default: () => <div data-testid="streak-calendar-popover" />,
}));

function renderBadge(streak) {
  return render(
    <AppContext.Provider value={{ activityDates: [], longestStreak: 0 }}>
      <StreakBadge streak={streak} />
    </AppContext.Provider>
  );
}

describe("StreakBadge", () => {
  it("shows the streak badge when the current streak is zero", () => {
    renderBadge(0);
    expect(screen.getByRole("button", { name: "0-day streak" })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("keeps showing positive streak counts", () => {
    renderBadge(7);
    expect(screen.getByRole("button", { name: "7-day streak" })).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();
  });
});
