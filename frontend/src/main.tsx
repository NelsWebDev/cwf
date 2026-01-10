import { ColorSchemeScript, createTheme, MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@mantine/core/styles.css";

import { ModalsProvider } from "@mantine/modals";
import AuthServiceProvider from "./providers/auth/AuthServiceProvider";
import GameServiceProvider from "./providers/GameServiceProvider";
import AppRoutes from "./routes/AppRoutes";

const theme = createTheme({
  fontFamily: "Roboto, sans-serif",
  fontFamilyMonospace: "Roboto Mono, monospace",
  headings: { fontFamily: "Roboto, sans-serif" },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ColorSchemeScript defaultColorScheme="auto" />
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <BrowserRouter>
          <AuthServiceProvider>
            <GameServiceProvider>
              <AppRoutes />
            </GameServiceProvider>
          </AuthServiceProvider>
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>
);
