import { config as loadEnv } from "dotenv";
import ViteExpress from "vite-express";
import { fileURLToPath } from "node:url";
import { express, httpServer, prismaClient } from "./singletons";
import { startGraphQL } from "./graphql";
import { resolve } from "node:path";
import { getCachedCardImage } from "./utils/cardImages";
loadEnv({
  path: "../../.env",
});

const webRoot = fileURLToPath(new URL("../../web/", import.meta.url));
const staticOutput = fileURLToPath(new URL("../public/", import.meta.url));
const viteConfigFile = resolve(webRoot, "vite.config.ts");

ViteExpress.config({
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  viteConfigFile,
  inlineViteConfig: {
    root: webRoot,
    build: { outDir: staticOutput },
  },
});

const HTTP_PORT = Number(process.env.HTTP_PORT ?? 3000);

express.get("/api", (_, res) => {
  const {FRONTEND_URL} = process.env;
  FRONTEND_URL ? res.redirect(FRONTEND_URL) : res.sendStatus(400)
});

// Lets browsers load custom card images through the server, for URLs only the server can reach.
express.get("/api/card-image", async (req, res) => {
  const url = req.query.url;
  if (typeof url !== "string" || !url) {
    res.sendStatus(400);
    return;
  }
  try {
    const { data, contentType } = await getCachedCardImage(url);
    res
      .set({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      })
      .send(data);
  } catch (error) {
    console.warn(`Card image proxy failed for ${url}:`, error instanceof Error ? error.message : error);
    res.sendStatus(502);
  }
});

async function startServer() {
  await startGraphQL();
  await ViteExpress.bind(express, httpServer);

  httpServer.listen(HTTP_PORT, () => {
    console.log(
      `Server is running on port ${HTTP_PORT} at http://localhost:${HTTP_PORT}`,
    );
    console.log(`GraphQL endpoint: http://localhost:${HTTP_PORT}/api/graphql`);
  });
}

startServer()
  .catch((error: unknown) => {
    console.error("Failed to start the server", error);
    process.exitCode = 1;
  });

prismaClient
  .$connect()
  .then(() => console.log("Connected to the database"))
  .catch((error: unknown) => {
    console.error("Failed to connect to the database", error);
  });