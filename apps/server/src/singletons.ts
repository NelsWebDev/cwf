import { config as loadEnv } from "dotenv";
import { createServer as createHttpServer } from "http";
import { PrismaClient } from "./prisma/generated/client";
import Express from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";

const envLocation = path.resolve(import.meta.dirname, "../../../.env");
loadEnv({ path: envLocation });

export const express = Express();
export const httpServer = createHttpServer(express);

export const prismaClient = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

export default {
  express,
  httpServer,
  prismaClient,
};
