import cors from "cors";
import { config as loadEnv } from "dotenv";
import { static as expressStaticMiddleware } from "express";
import path from "path";
import ViteExpress from "vite-express";
import ApiRouter from "./api/routes";
import { express, httpServer, ioServer, prismaClient, socketManager, } from "./singletons";
loadEnv();
const HTTP_PORT = Number(process.env.PORT || 3000);
const isInHostinger = !!process.env.HOSTINGER
if (isInHostinger) {
  const dir = path.join(process.cwd(), "dist/public");
  express.use(expressStaticMiddleware(dir));
}
else {
  ViteExpress.bind(express, httpServer);
}

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

express.get("/health", async (_, res) => {
  console.log("Health check received");
  res.sendStatus(200);
});

if (isInHostinger) {
  express.get("/:path", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist/public_html/index.html"));
  });
}
ioServer.use(socketManager.middleware);

ioServer.on("connection", (socket) => {
  socketManager.onSocketConnection(socket);
});
prismaClient.$connect().then(() => {
  console.log("Connected to the database");
}).catch((error) => {
  console.log(error);
});