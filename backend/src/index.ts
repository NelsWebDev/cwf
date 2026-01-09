import cors from "cors";
import ApiRouter from "./api/routes";
import { express, httpServer, ioServer, prismaClient, socketManager } from "./singletons";
import { bootConfig } from "./utils/config";
bootConfig();
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
express.use("/", ApiRouter);

ioServer.use(socketManager.middleware);

ioServer.on("connection", (socket) => {
  socketManager.onSocketConnection(socket);
});
prismaClient.$connect().then(() => {
  console.log("Connected to the database");
}).catch((error) => {
  console.log(error);
});