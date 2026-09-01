import { config as loadEnv } from "dotenv";
import { express, httpServer, ioServer, prismaClient, socketManager } from "./singletons";
import ApiRouter from "./api/routes";
import cors from "cors";
import path from "path";
import ViteExpress from "vite-express";
loadEnv({
  path: "../../.env"
})
const HTTP_PORT = process.env.HTTP_PORT || 3000;

ViteExpress.bind(express, httpServer);

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
express.use("/api", ApiRouter);

ioServer.use(socketManager.middleware);

ioServer.on("connection", (socket) => {
  socketManager.onSocketConnection(socket);
});
prismaClient.$connect().then(() => {
  console.log("Connected to the database");
}).catch((error:Error) => {
  console.log(error);
});
