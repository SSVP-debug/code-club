import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ThemeSelectionPage from "./ThemeSelectionPage";

const navigateMock = vi.fn();
const setThemeMock = vi.fn();
let totalXP = 0;
let currentThemeId = "default";

vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock("../hooks/useTheme", () => ({
    useTheme: () => ({
        setTheme: setThemeMock,
        themeId: currentThemeId,
    }),
}));

vi.mock("../hooks/useAppContext", () => ({
    useAppContext: () => ({ totalXP }),
}));

describe("ThemeSelectionPage — universe library", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        totalXP = 0;
        currentThemeId = "default";
    });

    it("renders all configured universes as a responsive library", () => {
        render(
            <MemoryRouter>
                <ThemeSelectionPage />
            </MemoryRouter>
        );

        expect(screen.getByRole("heading", { name: "Choose your world." })).toBeInTheDocument();
        expect(screen.getAllByRole("article")).toHaveLength(5);
        expect(screen.queryByText("Runtime Error →")).not.toBeInTheDocument();
        expect(screen.getByText("More universes can be discovered as Code Club grows.")).toBeInTheDocument();
    });

    it("keeps free universes available and locks XP-gated universes", () => {
        render(
            <MemoryRouter>
                <ThemeSelectionPage />
            </MemoryRouter>
        );

        expect(screen.getAllByRole("button", { name: "Enter Universe" })).toHaveLength(2);
        expect(screen.getByText("Unlock at 500 XP")).toBeInTheDocument();
        expect(screen.getByText("Unlock at 1,000 XP")).toBeInTheDocument();
        expect(screen.getByText("Unlock at 2,000 XP")).toBeInTheDocument();
    });

    it("filters universes by availability state", () => {
        render(
            <MemoryRouter>
                <ThemeSelectionPage />
            </MemoryRouter>
        );

        expect(screen.getAllByRole("article")).toHaveLength(5);

        fireEvent.click(screen.getByRole("button", { name: "Available" }));
        expect(screen.getAllByRole("article")).toHaveLength(2);
        expect(screen.getByText("Code Heist")).toBeInTheDocument();
        expect(screen.getByText("Breaking Bug")).toBeInTheDocument();
        expect(screen.queryByText("Ghost Protocol")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Locked" }));
        expect(screen.getAllByRole("article")).toHaveLength(3);
        expect(screen.getByText("Ghost Protocol")).toBeInTheDocument();
        expect(screen.getByText("Survival Code")).toBeInTheDocument();
        expect(screen.getByText("Debug Dynasty")).toBeInTheDocument();
        expect(screen.queryByText("Code Heist")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "All" }));
        expect(screen.getAllByRole("article")).toHaveLength(5);
    });

    it("selects an unlocked universe and preserves the destination", () => {
        render(
            <MemoryRouter initialEntries={["/theme-selection?next=%2Fproblems"]}>
                <ThemeSelectionPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getAllByRole("button", { name: "Enter Universe" })[0]);

        expect(setThemeMock).toHaveBeenCalledWith("codeHeist");
        expect(navigateMock).toHaveBeenCalledWith(
            "/theme-confirmation?next=%2Fproblems"
        );
    });
});
