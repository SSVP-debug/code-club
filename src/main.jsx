import * as Sentry from "@sentry/react";
import { ErrorBoundary } from "@sentry/react";

import { ThemeProvider } from "./context/ThemeContext";
import { BWModeProvider } from "./context/BWModeContext";

import AchievementToastContainer from "./components/ui/AchievementToastContainer";
import GlobalErrorFallback from "./components/GlobalErrorFallback";
import React from "react";
import { HelmetProvider } from "react-helmet-async";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import { AuthProvider } from "./context/authContext";
import { GuestProvider } from "./context/GuestProvider";
import { PremiumProvider } from "./context/PremiumContext";
import AppContextProvider from "./context/appContext";

import { Toaster } from "react-hot-toast";

import "./index.css";
import { registerServiceWorker } from "./utils/registerServiceWorker";


// ─────────────────────────────────────────────────────────────
// Sentry Initialization
// ─────────────────────────────────────────────────────────────

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,

    environment: import.meta.env.MODE,

    // Only report errors in production
    enabled: import.meta.env.MODE === "production",

    tracesSampleRate: 0.2,

    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),

      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
  });
}


registerServiceWorker();

// ─────────────────────────────────────────────────────────────
// React App Render
// ─────────────────────────────────────────────────────────────

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <HelmetProvider>
    <ThemeProvider>
      <BrowserRouter>
        <BWModeProvider>
        <AuthProvider>
          <GuestProvider>
          <PremiumProvider>
          <AppContextProvider>

            <ErrorBoundary
              fallback={<GlobalErrorFallback />}
            >
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: "#18181b",
                    color: "#ffffff",
                    border: "1px solid #3f3f46",
                    borderRadius: "12px",
                    fontSize: "14px",
                  },

                  success: {
                    iconTheme: {
                      primary: "var(--color-verdict-accept, #2dd4bf)",
                      secondary: "#000",
                    },
                  },

                  error: {
                    iconTheme: {
                      primary: "var(--color-verdict-reject, #ff5d5d)",
                      secondary: "#fff",
                    },
                  },
                }}
              />
              <AchievementToastContainer />

              <App />

            </ErrorBoundary>

          </AppContextProvider>
          </PremiumProvider>
          </GuestProvider>
        </AuthProvider>
        </BWModeProvider>
      </BrowserRouter>
    </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);