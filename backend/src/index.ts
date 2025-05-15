import { config as loadEnv } from "dotenv";
import { express, httpServer, ioServer, socketManager } from "./singletons";
import ApiRouter from "./api/routes";
import cors from "cors";
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
express.use("/api", ApiRouter);

ioServer.use(socketManager.middleware);

ioServer.on("connection", (socket) => {
  socketManager.onSocketConnection(socket);
});
