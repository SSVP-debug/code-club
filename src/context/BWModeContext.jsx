import { useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { loadBWModePreference, saveBWModePreference } from "../utils/bwModeStorage";
import { BWModeContext } from "./BWModeContextObject";

// Class name toggled on <html>. Kept in one place so the CSS in index.css
// and this provider never drift out of sync.
export const BW_MODE_CLASS = "bw-mode";

// Black & White Mode is intentionally a landing-page preference. Once a
// visitor enters the product, the selected Universe owns the visual system.
// The preference is retained so returning to the landing page restores it.
const BW_MODE_ROUTE = "/";

export function BWModeProvider({ children }) {
    const [bwMode, setBwMode] = useState(() => loadBWModePreference());
    const { pathname } = useLocation();

    // Only the landing page owns this preference visually. useLayoutEffect
    // removes the class before paint when navigating into the product, so
    // a saved White Mode preference can never leak into a Universe page.
    useLayoutEffect(() => {
        const isLandingPage = pathname === BW_MODE_ROUTE;
        document.documentElement.classList.toggle(
            BW_MODE_CLASS,
            isLandingPage && bwMode
        );
    }, [pathname, bwMode]);

    const toggleBWMode = () => {
        setBwMode((prev) => {
            const next = !prev;
            saveBWModePreference(next);
            return next;
        });
    };

    const value = useMemo(
        () => ({ bwMode, toggleBWMode }),
        [bwMode]
    );

    return (
        <BWModeContext.Provider value={value}>
            {children}
        </BWModeContext.Provider>
    );
}