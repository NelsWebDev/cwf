import { type ReactElement, useEffect, useRef, useState } from "react";
import { CombinedGraphQLErrors } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import type { Subscription } from "rxjs";
import type { AuthService, User } from "../../types";
import LoginPage from "./LoginPage";
import { AuthServiceContext } from "../Contexts";
import { CLOSE_CODE_FORBIDDEN, TOKEN_KEY, closeCodeOf, wsClient } from "../../graphql/client";
import {
    KICK_PLAYER_MUTATION,
    LOGIN_MUTATION,
    LOGOUT_MUTATION,
    UPDATE_USERNAME_MUTATION,
    UPDATE_DISCORD_NAME_MUTATION,
    MY_PROFILE_SUBSCRIPTION,
    REFRESH_TOKEN_MUTATION,
    REJOIN_MUTATION,
} from "../../graphql/operations";
import { getErrorMessage } from "../../utils";


const AuthServiceProvider = ({ children }: { children: ReactElement }) => {
    const client = useApolloClient();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [user, setUser] = useState<Omit<User, "isCardCzar">>();
    const [disconnected, setDisconnected] = useState(false);
    const [usernameTaken, setUsernameTaken] = useState(false);
    const connection = useRef<Subscription | undefined>(undefined);
    // Set while we are deliberately closing the connection so the close isn't reported as a disconnect.
    const closingOnPurpose = useRef(false);

    // The profile subscription doubles as the session connection: the websocket is open while it is active.
    const connect = () => {
        connection.current?.unsubscribe();
        closingOnPurpose.current = false;
        connection.current = client
            .subscribe({ query: MY_PROFILE_SUBSCRIPTION, fetchPolicy: "no-cache" })
            .subscribe({
                next: ({ data }) => {
                    if (data) setUser(data.myProfile);
                },
                error: () => {
                    // Reported through the websocket client's "closed" event.
                },
            });
    }

    // Re-establishes a saved session from the stored token, without asking for the game password again.
    const restoreSession = async (username?: string) => {
        setIsAuthenticating(true);
        setErrorMessage("");
        try {
            const { data } = await client.mutate({
                mutation: REJOIN_MUTATION,
                variables: username ? { username } : {},
            });
            if (!data) throw new Error("Failed to rejoin");
            localStorage.setItem(TOKEN_KEY, data.rejoin.token);
            setUser(data.rejoin.user);
            setUsernameTaken(false);
            connect();
        } catch (error) {
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            const code = CombinedGraphQLErrors.is(error) ? error.errors[0]?.extensions?.code : undefined;
            if (code === "USERNAME_TAKEN") {
                setUsernameTaken(true);
                setErrorMessage(username ? "That name is already in use. Pick another one" : "Your name is no longer available. Pick a new one");
            } else if (code === "UNAUTHENTICATED") {
                localStorage.removeItem(TOKEN_KEY);
                setUsernameTaken(false);
                setUser(undefined);
                setErrorMessage("Your session expired. Please login again");
            } else if (code === "BAD_USER_INPUT") {
                setUsernameTaken(true);
                setErrorMessage(getErrorMessage(error));
            } else {
                // Network or server trouble: keep the token so the user can retry.
                setDisconnected(true);
                setErrorMessage("Disconnected from server");
            }
        }
    }

    const disconnect = () => {
        closingOnPurpose.current = true;
        connection.current?.unsubscribe();
        connection.current = undefined;
    }

    useEffect(() => {
        const offConnected = wsClient.on("connected", () => {
            console.log("connected to server");
            setIsAuthenticated(true);
            setIsAuthenticating(false);
            setDisconnected(false);
            setErrorMessage("");
        });
        const offClosed = wsClient.on("closed", (event) => {
            if (closingOnPurpose.current) {
                return;
            }
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            if (closeCodeOf(event) === CLOSE_CODE_FORBIDDEN) {
                // The server no longer knows this session (e.g. it was removed for inactivity); try to restore it.
                void restoreSession();
                return;
            }
            setDisconnected(true);
            setErrorMessage("Disconnected from server");
        });

        if (localStorage.getItem(TOKEN_KEY)) {
            void restoreSession();
        }

        return () => {
            offConnected();
            offClosed();
            connection.current?.unsubscribe();
            connection.current = undefined;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (username: string, password: string) => {
        setIsAuthenticating(true);
        setErrorMessage("");
        try {
            const { data } = await client.mutate({ mutation: LOGIN_MUTATION, variables: { username, password } });
            if (!data) {
                throw new Error("Login failed");
            }
            setUser(data.login.user);
            localStorage.setItem(TOKEN_KEY, data.login.token);
            connect();
        }
        catch (error) {
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            if (!navigator.onLine) {
                setErrorMessage("Network error: Please check your internet connection");
            }
            else {
                setErrorMessage(getErrorMessage(error));
            }
        }
    }

    const logout = async () => {
        closingOnPurpose.current = true;
        try {
            await client.mutate({ mutation: LOGOUT_MUTATION });
        }
        catch (error) {
            console.error("Failed to log out", error);
        }
        disconnect();
        setIsAuthenticated(false);
        setIsAuthenticating(false);
        setDisconnected(false);
        setUser(undefined);
        localStorage.removeItem(TOKEN_KEY);
        setUsernameTaken(false);
        setErrorMessage("You are logged out");
    }

    // Token claims carry the names, so refresh it after they change to keep restored sessions current.
    const refreshToken = async () => {
        try {
            const { data } = await client.mutate({ mutation: REFRESH_TOKEN_MUTATION });
            if (data) localStorage.setItem(TOKEN_KEY, data.refreshToken);
        } catch (error) {
            console.error("Failed to refresh session token", error);
        }
    }

    // Resolves to an error message, or undefined on success.
    const updateUsername = async (username: string) => {
        try {
            const { data } = await client.mutate({ mutation: UPDATE_USERNAME_MUTATION, variables: { username } });
            if (data) {
                setUser(data.updateUsername);
                await refreshToken();
            }
            return undefined;
        } catch (error) {
            return getErrorMessage(error);
        }
    }

    const updateDiscordName = async (discordName: string) => {
        try {
            const { data } = await client.mutate({ mutation: UPDATE_DISCORD_NAME_MUTATION, variables: { discordName } });
            if (data) {
                setUser(data.updateDiscordName);
                await refreshToken();
            }
            return undefined;
        } catch (error) {
            return getErrorMessage(error);
        }
    }

    const kickPlayer = (userId: string) => {
        client.mutate({ mutation: KICK_PLAYER_MUTATION, variables: { userId } }).catch((error) => {
            console.error("Failed to kick player", error);
        });
    }

    const reconnect = () => {
        void restoreSession();
    }

    const chooseUsername = (username: string) => {
        void restoreSession(username);
    }

    const value: AuthService = {
        isAuthenticated,
        isAuthenticating,
        disconnected,
        login,
        logout,
        updateUsername,
        updateDiscordName,
        kickPlayer,
        reconnect,
        usernameTaken,
        chooseUsername,
        errorMessage,
        user,
    }
    return (
        <AuthServiceContext.Provider value={value}>
            {isAuthenticated ? children : <LoginPage />}
        </AuthServiceContext.Provider>
    )
}


export default AuthServiceProvider;
