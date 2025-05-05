import { createServer as createHttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { PrismaClient } from "@prisma/client";
import Express from "express";
import {
  ClientEmittedEventFunctions,
  ServerEmittedEventFunctions,
} from "./types/shared";
import { GameUser } from "./session/GameUser";
import { SocketManager } from "./session/SocketManager";
import { Game } from "./Game";

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

export const prismaClient = new PrismaClient();
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
