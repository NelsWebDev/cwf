import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import Express from "express";
import { createServer as createHttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { Game } from "./Game";
import { GameUser } from "./session/GameUser";
import { SocketManager } from "./session/SocketManager";
import {
  ClientEmittedEventFunctions,
  ServerEmittedEventFunctions,
} from "./types/shared";
import { bootConfig } from "./utils/config";
bootConfig();

export const express = Express();
export const httpServer = createHttpServer(express);
export const ioServer = new SocketServer<
  ClientEmittedEventFunctions,
  ServerEmittedEventFunctions,
  object,
  GameUser
>(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const prismaAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prismaClient = new PrismaClient({ adapter: prismaAdapter });
export const socketManager = new SocketManager();
export const game = new Game();

export default {
  express,
  httpServer,
  ioServer,
  prismaClient,
  socketManager,
  game,
};
