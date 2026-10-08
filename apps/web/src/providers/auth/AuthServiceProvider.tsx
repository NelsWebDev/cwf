import { type ReactElement, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import type { Subscription } from "rxjs";
import type { AuthService, User } from "../../types";
import LoginPage from "./LoginPage";
import { AuthServiceContext } from "../Contexts";
import { CLOSE_CODE_FORBIDDEN, USER_ID_KEY, closeCodeOf, wsClient } from "../../graphql/client";
import {
    KICK_PLAYER_MUTATION,
    LOGIN_MUTATION,
    LOGOUT_MUTATION,
    UPDATE_USERNAME_MUTATION,
    MY_PROFILE_SUBSCRIPTION,
} from "../../graphql/operations";
import { getErrorMessage } from "../../utils";


const AuthServiceProvider = ({ children }: { children: ReactElement }) => {
    const client = useApolloClient();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [user, setUser] = useState<Omit<User, "isCardCzar">>();
    const [disconnected, setDisconnected] = useState(false);
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
                localStorage.removeItem(USER_ID_KEY);
                setUser(undefined);
                setErrorMessage("Invalid session. Please login again");
                return;
            }
            setDisconnected(true);
            setErrorMessage("Disconnected from server");
        });

        if (localStorage.getItem(USER_ID_KEY)) {
            connect();
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
            setUser(data.login);
            localStorage.setItem(USER_ID_KEY, data.login.id);
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
        localStorage.removeItem(USER_ID_KEY);
        setErrorMessage("You are logged out");
    }

    // Resolves to an error message, or undefined on success.
    const updateUsername = async (username: string) => {
        try {
            const { data } = await client.mutate({ mutation: UPDATE_USERNAME_MUTATION, variables: { username } });
            if (data) setUser(data.updateUsername);
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
        setIsAuthenticating(true);
        connect();
    }

    const value: AuthService = {
        isAuthenticated,
        isAuthenticating,
        disconnected,
        login,
        logout,
        updateUsername,
        kickPlayer,
        reconnect,
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
