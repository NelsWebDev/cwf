import cors from "cors";
import { config as loadEnv } from "dotenv";
import { static as static_ } from "express";
import path from "path";
import ApiRouter from "./api/routes";
import { express, httpServer, ioServer, prismaClient, socketManager } from "./singletons";
loadEnv();
const HTTP_PORT = process.env.PORT || 3000;
httpServer.listen(HTTP_PORT, () => {
  console.log(
    `Server is running on port ${HTTP_PORT} at http://localhost:${HTTP_PORT}`,
  );
});

express.use(
  cors({
    origin: "*",
  }),
);

const publicDir = path.join(__dirname, "public");
express.use("/api", ApiRouter);
express.use(static_(publicDir));

express.get("/health", async (_, res) => {
  console.log("Health check received");
  res.sendStatus(200);
});

ioServer.use(socketManager.middleware);

ioServer.on("connection", (socket) => {
  socketManager.onSocketConnection(socket);
});
prismaClient.$connect().then(() => {
  console.log("Connected to the database");
}).catch((error) => {
  console.log(error);
});