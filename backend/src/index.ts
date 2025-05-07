import { config as loadEnv } from "dotenv";
import { express, httpServer, ioServer, socketManager } from "./singletons";
import ApiRouter from "./api/routes";
import cors from "cors";
import path from "path";
import Express from "express";
loadEnv();
httpServer.listen(process.env.HTTP_PORT, () => {
  console.log(
    `Server is running on port ${process.env.HTTP_PORT} at http://localhost:${process.env.HTTP_PORT}`,
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


express.use(Express.static(path.join(__dirname, "public")));
