import { ReactElement, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { AuthService, Socket, User } from "../../types";
import { AuthServiceContext } from "../Contexts";



const AuthServiceProvider = ({ children }: { children: ReactElement }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [user, setUser] = useState<Omit<User, "isCardCzar">>();
    const socket: Socket = useMemo(() => io(import.meta.env.VITE_API_URL, {
        autoConnect: localStorage.getItem("userId") ? true : false,
        auth: { userId: localStorage.getItem("userId") || "" },
    }), []);
    const [disconnected, setDisconnected] = useState(false);

    // useEffect(() => {
    //     fetch(import.meta.env.VITE_API_URL + "/health").then(async (res) => {
    //         alert(res.headers.get("RequestID"));
    //         if (!res.headers.has("RequestID")) {
    //             throw new Error("Request didn't come from the app");
    //         }
    //         if (!res.ok) {
    //             throw new Error("API is not healthy");
    //         }
    //     }).catch((e) => {
    //         if (import.meta.env.PROD) {
    //             window.location.href = import.meta.env.VITE_API_URL as string;
    //             return;
    //         }
    //         const message = e.message ? (e.message as string).includes("Failed to fetch") ? "Backend down" : e.message : "Failed to connect to API";
    //         setErrorMessage(message);
    //         console.log(e);
    //     });
    // }, []);

    useEffect(() => {
        if (user?.id) {
            localStorage.setItem("userId", user.id);
        }

    }, [user?.id]);

    const login = async (username: string, password: string) => {
        setIsAuthenticating(true);
        setErrorMessage("");

        try {
            const res = await fetch(import.meta.env.VITE_API_URL + "/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            });
            const json = await res.json();
            if (res.ok) {
                setUser(json.user);
                socket.auth = { userId: json.user?.id };
                socket.connect();
            } else {
                setErrorMessage(json.error);
                setIsAuthenticated(false);
                setIsAuthenticating(false);
            }
        }
        catch (error) {
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            if (!navigator.onLine) {
                setErrorMessage("Network error: Please check your internet connection");
            }
            else {
                setErrorMessage("An unknown error occurred. Please try again");
            }
        }
    }

    useEffect(() => {
        socket.on("myProfile", setUser);
        socket.on("connect", () => {
            console.log("connected to socket");
            setIsAuthenticated(true);
            setIsAuthenticating(false);
            setErrorMessage("");
        });
        socket.on("connect_error", (err) => {
            setErrorMessage(err.message);
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            localStorage.removeItem("userId");
        });
        socket.on('disconnect', () => {
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            setDisconnected(true);
            setErrorMessage("Disconnected from server");
        });

        return () => {
            socket.off("myProfile");
            socket.off("connect");
            socket.off("connect_error");
            socket.off("players");
            socket.off("playerJoined");
            socket.off("playerLeft");
            socket.off("serverMessage");
        }
    }, [socket]);

    const logout = () => {
        socket.emit("logout");
        socket.disconnect();
        setIsAuthenticated(false);
        setIsAuthenticating(false);
        setUser(undefined);
        localStorage.removeItem("userId");
        setErrorMessage("You are logged out");
    }

    const kickPlayer = (userId: string) => {
        socket.emit("kickPlayer", userId);
    }

    const reconnect = () => {
        socket.auth = { userId: localStorage.getItem("userId") || "" };
        socket.connect();
    }

    const value: AuthService = {
        isAuthenticated,
        isAuthenticating,
        disconnected,
        login,
        logout,
        kickPlayer,
        reconnect,
        errorMessage,
        user,
        socket,
    }
    return (
        <AuthServiceContext.Provider value={value}>
            {children}
        </AuthServiceContext.Provider>
    )
}


export default AuthServiceProvider;