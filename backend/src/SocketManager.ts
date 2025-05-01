import { ExtendedError } from "socket.io";
import { Socket } from "./types";
import { User } from "./users/User";

export class SocketManager {

    private socketUsers: Map<User, Socket[]> = new Map();

    // Middleware that forces the user to be authenticated before connecting using user ids
    middleware = (socket: Socket, next: (reason?: ExtendedError) => void) => {
        const userId = socket.handshake.auth.userId;
        if (!userId) {
            return next(new Error("User ID not provided"));
        }
        User.find({ id: userId }).then(user => {
            if (!user) {
                return next(new Error("User not found"));
            }
            socket.data = user;


            next();
        });
    }



}