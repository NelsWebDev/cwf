import { createContext, useContext } from "react";
import type { Account } from "./api";

export type DeckAuth = {
  account: Account | undefined;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const DeckAuthContext = createContext<DeckAuth | undefined>(undefined);

export const useDeckAuth = () => {
  const context = useContext(DeckAuthContext);
  if (!context) throw new Error("useDeckAuth must be used within DeckAuthProvider");
  return context;
};
