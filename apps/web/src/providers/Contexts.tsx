import { createContext } from "react";
import type { AuthService, GameService, ModalService } from "../types";

export const ModalServiceContext = createContext<ModalService|undefined>(undefined);
export const AuthServiceContext = createContext<AuthService | undefined>(undefined);
export const GameServiceContext = createContext<GameService | undefined>(undefined);
export type ThemeOption = "auto" | "light" | "dark" | "purple";
export const ThemeOptionContext = createContext<{
  themeOption: ThemeOption;
  setThemeOption: (themeOption: ThemeOption) => void;
} | undefined>(undefined);
