import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DECK_TOKEN_KEY, deckApi, setUnauthorizedHandler, type Account } from "./api";
import { DeckAuthContext, type DeckAuth } from "./deckAuthContext";

export const DeckAuthProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<Account>();
  const [loading, setLoading] = useState(
    () => !!localStorage.getItem(DECK_TOKEN_KEY) || !!new URLSearchParams(window.location.hash.slice(1)).get("googleToken"),
  );

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("googleToken");
    if (!token) return;
    localStorage.setItem(DECK_TOKEN_KEY, token);
    window.history.replaceState({}, document.title, window.location.pathname);
    deckApi.me().then(({ account }) => setAccount(account)).catch(() => localStorage.removeItem(DECK_TOKEN_KEY)).finally(() => setLoading(false));
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(DECK_TOKEN_KEY);
    setAccount(undefined);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (localStorage.getItem(DECK_TOKEN_KEY)) {
      deckApi
        .me()
        .then(({ account }) => setAccount(account))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
    return () => setUnauthorizedHandler(undefined);
  }, [clear]);

  const value = useMemo<DeckAuth>(() => {
    const start = ({ token, account }: { token: string; account: Account }) => {
      localStorage.setItem(DECK_TOKEN_KEY, token);
      setAccount(account);
    };
    return {
      account,
      loading,
      login: async (email, password) => start(await deckApi.login(email, password)),
      register: async (email, password) => start(await deckApi.register(email, password)),
      googleLogin: (token) => {
        localStorage.setItem(DECK_TOKEN_KEY, token);
        setLoading(true);
        void deckApi.me().then(({ account }) => setAccount(account)).catch(clear).finally(() => setLoading(false));
      },
      logout: async () => {
        await deckApi.logout().catch(() => undefined);
        clear();
      },
    };
  }, [account, loading, clear]);

  return <DeckAuthContext.Provider value={value}>{children}</DeckAuthContext.Provider>;
};
