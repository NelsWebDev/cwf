import { ExtendedError, Server } from "socket.io";
import { ClientEmittedEventFunctions, RoundStatus, ServerEmittedEventFunctions, Socket } from "../types";
import { GameUser } from "./GameUser";
import { game, ioServer } from "../singletons";
import { AllEventHandlers } from "../events";

export class SocketManager {
    gameUsers: Map<string, GameUser> = new Map();
    constructor() {
        this.middleware = this.middleware.bind(this);
    }
    middleware(socket:Socket, next: (err?: ExtendedError) => void) {
        const userId = socket.handshake.auth.userId;
        if (!userId) {
            return next(new Error("Authentication error"));
        }

        if (!this.gameUsers.has(userId)) {
            return next(new Error("Invalid session. Please login again"));
        }

        const user = this.gameUsers.get(userId);

        socket.data = user;
        return next();
    }
    async kickByUserId(userId: string) {
        if(!this.gameUsers.has(userId)) {
            return;
        }
        const user = this.gameUsers.get(userId);
        return user.kick();
    }
    
    userIsOnline(userId: string) {
        if(!this.gameUsers.has(userId)) {
            return false;
        }
        return this.gameUsers.get(userId).isActive;
    }

    public async onSocketConnection(socket:Socket) {
        const user = socket.data;

        if(this.activeUsers.length < 3) {
            ioServer.emit("closeModal");
        }
        user.isActive = true;
        await socket.join(user.id);
        const sockets = await user.fetchSockets();
        if(sockets.length === 1) {
            socket.broadcast.emit("playerJoined", user.toJSON());
        }
        socket.emit("myProfile", user.toJSON());
        this.registerEventHandlers(socket);
        socket.on("disconnect", () => {
            this.onUserDisconnect(user);
        });
    }

    private onLastUserDisconnect(user: GameUser) {
        user.isActive = false;
        ioServer.emit("playerLeft", user.id);
        if(game.currentRound?.cardCzarId === user.id && game.currentRound?.status ===  RoundStatus.WAITING_FOR_PLAYERS) {
             this.gameUsers.forEach((gameUser) => {
                if(gameUser.isActive) {
                    gameUser.undoPlay();
                }
             });
             game.nextRound();
        }
    }

    private async onUserDisconnect(user: GameUser) {
        const sockets = await user.fetchSockets();
        if (sockets.length === 0) {
           this.onLastUserDisconnect(user);
        }
    }

    get activeUsers() {
        return this.usersArray.filter(user => user.isActive);
    }
    
    get usersArray() {
        return [...Array.from(this.gameUsers.values())];
    }

    usernameAvailable(username: string) {
        return !this.usersArray.some(user => user.username.toLowerCase() === username.toLowerCase());
    }

    registerUser(username: string) {
        if(!this.usernameAvailable(username)) {
            throw new Error("Username already in use");
        }
        const newUser = new GameUser(username);
        this.gameUsers.set(newUser.id, newUser);
        return newUser;
    }

    registerEventHandlers(socket: Socket) {
        for (const [handlerName, handler] of Object.entries(AllEventHandlers)) {
            const unfixedEventName = handlerName.replace(/^on/, "");
            const realEventName = unfixedEventName.charAt(0).toLowerCase() + unfixedEventName.slice(1) as keyof ClientEmittedEventFunctions;
            socket.on(realEventName, (...args: any[]) => {
                try {
                    // @ts-ignore
                    handler(socket, ...args);
                } catch (error) {
                    socket.emit("serverMessage", {
                        title: "Whoops!",
                        message: `${error.message}`,
                    });
                    console.error(`Error in event handler ${handlerName}:`, error);
                }
            });

        }
    }
}