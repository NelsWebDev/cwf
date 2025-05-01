import { createServer as createHttpServer } from "http";
import {Server as SocketServer} from "socket.io";
import { PrismaClient } from "@prisma/client";
import Express from "express";
import { ClientEmittedEventFunctions, ServerEmittedEventFunctions } from "./types/shared";
import { User } from "./users/User";
import { SocketManager } from "./SocketManager";

export const express = Express();
export const httpServer = createHttpServer(express);
export const ioServer = new SocketServer<ClientEmittedEventFunctions, ServerEmittedEventFunctions, {}, User>(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

export const prismaClient = new PrismaClient();

export const socketManager = new SocketManager();

export default {
    express, httpServer, ioServer, prismaClient, socketManager
}