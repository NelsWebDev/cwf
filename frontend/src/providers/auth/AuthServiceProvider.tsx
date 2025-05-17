import { ReactElement, useEffect, useMemo, useState } from "react";
import { AuthService, LoginResponse, Socket, User } from "../../types";
import { io } from "socket.io-client";
import LoginPage from "./LoginPage";
import { AuthServiceContext } from "../Contexts";

const isAPIOnline = async () => {
    return new Promise(async (resolve) => {
        try {
            const res = await fetch(import.meta.env.VITE_API_URL + "/health", {
                method: "GET",
            });
            res.status === 200 ? resolve(true) : resolve(false);
        }
        catch (e) {
            resolve(false);
        }
        resolve(false);
    })
};

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

    useEffect(() => {
        if(user?.id) {
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
            if (res.status === 200) {
                const data  : LoginResponse= await res.json();
                setUser(data.user);
                socket.auth = { userId: data.user?.id };
                socket.connect();
            } else {
                const data = await res.json();
                setErrorMessage(data.error);
                setIsAuthenticated(false);
                setIsAuthenticating(false);
            }
        }
        catch {
            setIsAuthenticated(false);
            setIsAuthenticating(false);
            if(!navigator.onLine) {
                setErrorMessage("Network error: Please check your internet connection");
            } 
            else if(!await isAPIOnline()){
                setErrorMessage("Game Server is offline and will attempt to restart. Wait 30 second, refresh the page and try again.");
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
            {isAuthenticated ? children : <LoginPage />}
        </AuthServiceContext.Provider>
    )
}


export default AuthServiceProvider;