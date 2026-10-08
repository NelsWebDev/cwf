import { config as loadEnv } from "dotenv";
import { express, httpServer, prismaClient } from "./singletons";
import { startGraphQL } from "./graphql";
loadEnv({
  path: "../../.env"
});



const HTTP_PORT = process.env.HTTP_PORT || 3000;

express.get("/domain", (req, res) => {
  res.send(req.hostname);
});

express.get("/api/health", (_, res) => {
  console.log("Health check received");
  res.sendStatus(200);
});

express.get("/api", (_, res) => {
  const url = process.env.FRONTEND_URL;
  if (url) res.redirect(url);
  else res.sendStatus(404);
});

startGraphQL().then(() => {
  httpServer.listen(HTTP_PORT, () => {
    console.log(
      `Server is running on port ${HTTP_PORT} at http://localhost:${HTTP_PORT}`,
    );
    console.log(`GraphQL endpoint: http://localhost:${HTTP_PORT}/api/graphql`);
  });
});

prismaClient.$connect().then(() => {
  console.log("Connected to the database");
}).catch((error:Error) => {
  console.log(error);
});
