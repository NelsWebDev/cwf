import {Prisma, User as PrismaUser} from '@prisma/client';
import { ioServer, prismaClient } from '../singletons';
import _ from 'lodash';
export class User {
    private constructor(private readonly data: PrismaUser) {
    }

    get id(): string {
        return this.data.id;
    }
    get email(): string {
        return this.data.email;
    }
    get username(): string {
        return this.data.username;
    }
    
    static fromPrisma(user: PrismaUser) {
        return new User(user);
    }

    static async find(where: Prisma.UserWhereInput) : Promise<User | undefined> {
        const user = await prismaClient.user.findFirst({
            where,
        });
        if(user) return new User(user);
        return undefined;
    }
    static async findOrThrow(where: Prisma.UserWhereInput) {
        const user = await User.find(where);
        if(!user) throw new Error('User not found');
        return user;
    }

    static async exists(where: Prisma.UserWhereInput) : Promise<boolean> {
        return prismaClient.user.count({
            where,
        }).then(count => count > 0);
    }

    static async fetchOnlineUsers() {
        const sockets = await ioServer.sockets.fetchSockets();
        return _.uniqBy(sockets, socket => socket.handshake.auth.userId).map(socket => socket.data);
    }
    
    async getConnectedSockets() {
        const sockets = await ioServer.sockets.fetchSockets();
        return sockets.filter(socket => socket.handshake.auth.userId === this.id);
    }

    async isOnline() {
        const sockets = await this.getConnectedSockets();
        return sockets.length > 0;
    }
    async disconnect() {
        const sockets = await this.getConnectedSockets();
        for(const socket of sockets) {
            socket.disconnect();
        }
    }

    toJSON() {
        return {
            id: this.id,
            email: this.email,
            username: this.username,
        };
    }
}